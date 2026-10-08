# pyright: reportAttributeAccessIssue=false
"""
MT5 Client - MetaTrader 5 connection and operations handler.
"""

import MetaTrader5 as mt5
from models import AccountInfo, TradePosition, ClosedTrade
from encryption import decrypt_credentials
import logging
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load .env from parent directory (mt5-server/.env)
_env_path = Path(__file__).resolve().parent.parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

logger = logging.getLogger(__name__)


class MT5Client:
    """Handles connection and operations with MetaTrader 5 terminal."""

    def __init__(self):
        self._connected = False
        self._account_info = None
        # Store master credentials for reliable switch-back after account queries.
        # Prefer environment variables so they can never be overwritten by a slave
        # connect/login call.
        env_login = os.environ.get("MASTER_MT5_LOGIN")
        env_password = os.environ.get("MASTER_MT5_PASSWORD")
        env_server = os.environ.get("MASTER_MT5_SERVER")
        if env_login and env_password and env_server:
            self._master_login: int | None = int(env_login)
            self._master_password: str | None = env_password
            self._master_server: str | None = env_server
            logger.info(
                "Master credentials loaded from environment: login=%s server=%s",
                env_login, env_server,
            )
        else:
            self._master_login = None
            self._master_password = None
            self._master_server = None
        # Auto-initialize if MT5 terminal is already running
        self._try_auto_connect()

    def _try_auto_connect(self) -> bool:
        """Try to connect to an already-running MT5 terminal.

        If master credentials are stored, always ensure we end up on the
        master account — not whichever account the terminal happens to be
        logged into (which could be a slave after a replication).
        """
        if not mt5.initialize():
            return False

        # If we have stored master credentials, switch to master account
        # to guarantee the monitor always polls the correct account.
        if self._master_login and self._master_password and self._master_server:
            info = mt5.account_info()
            if info and info.login != self._master_login:
                logger.info(
                    "Terminal on account %d, switching to master %d...",
                    info.login, self._master_login,
                )
                if not mt5.login(self._master_login,
                                 password=self._master_password,
                                 server=self._master_server):
                    logger.error(
                        "Failed to switch to master %d@%s: %s",
                        self._master_login, self._master_server, mt5.last_error(),
                    )
                    # Still connected, just on the wrong account
                    self._connected = True
                    return True

        info = mt5.account_info()
        if info:
            self._connected = True
            logger.info("Connected to MT5 account %d on %s", info.login, info.server)
            return True
        return False

    def ensure_connected(self) -> bool:
        """Ensure MT5 is initialized and connected. Re-initialize if needed."""
        if self._connected:
            # Verify the connection is still alive
            info = mt5.terminal_info()
            if info is not None:
                return True
            logger.warning("MT5 connection lost, attempting to re-initialize...")
            self._connected = False

        # Try to re-initialize
        return self._try_auto_connect()

    def connect(self, server: str, login: int, password: str) -> bool:
        """Connect to MT5 terminal with given credentials."""
        # Shut down any existing connection first to avoid stale auth state
        if self._connected:
            mt5.shutdown()
            self._connected = False

        # Pass credentials directly to initialize() so the terminal
        # doesn't try to auto-login with cached/stale credentials.
        if not mt5.initialize(login=login, server=server, password=password):
            logger.error("MT5 initialization failed: %s", mt5.last_error())
            # Fallback: try bare initialize + explicit login
            if not mt5.initialize():
                logger.error("MT5 bare initialize also failed: %s", mt5.last_error())
                return False
            authorized = mt5.login(login, password=password, server=server)
            if not authorized:
                logger.error("MT5 login failed: %s", mt5.last_error())
                mt5.shutdown()
                return False

        self._connected = True
        # Only set master credentials if not already loaded from env vars
        if not self._master_login:
            self._master_login = login
            self._master_password = password
            self._master_server = server
        logger.info("Connected to MT5 account %d on %s", login, server)
        return True

    def connect_encrypted(self, encrypted_credentials: str, key: str) -> bool:
        """Connect using encrypted credentials."""
        creds = decrypt_credentials(encrypted_credentials, key)
        return self.connect(creds["server"], creds["login"], creds["password"])

    def disconnect(self):
        """Disconnect from MT5 terminal."""
        if self._connected:
            mt5.shutdown()
            self._connected = False
            logger.info("Disconnected from MT5")

    @staticmethod
    def _get_filling_mode(symbol_info):
        """Auto-detect the correct filling mode for a symbol."""
        filling = symbol_info.filling_mode
        # Bit flags: 1 = FOK, 2 = IOC, both can be set
        if filling & 1:  # FOK supported
            return mt5.ORDER_FILLING_FOK
        if filling & 2:  # IOC supported
            return mt5.ORDER_FILLING_IOC
        return mt5.ORDER_FILLING_RETURN

    @property
    def is_connected(self) -> bool:
        return self._connected

    def get_account_info(self) -> AccountInfo | None:
        """Retrieve current account information."""
        if not self.ensure_connected():
            return None

        info = mt5.account_info()
        if info is None:
            logger.error("Failed to get account info: %s", mt5.last_error())
            return None

        return AccountInfo(
            login=info.login,
            server=info.server,
            balance=info.balance,
            equity=info.equity,
            profit=getattr(info, "profit", info.equity - info.balance),
            margin=info.margin,
            free_margin=info.margin_free,
            leverage=info.leverage,
            currency=info.currency,
            name=info.name,
        )

    def query_account(self, login: int, password: str | None, server: str) -> AccountInfo | None:
        """Temporarily switch to another account, fetch its info, then switch back.

        This allows querying equity/balance for slave accounts on different
        brokers without needing a separate MT5 terminal instance.
        """
        if not self.ensure_connected():
            return None

        # Remember the current account so we can switch back
        current = mt5.account_info()
        original_login = current.login if current else None
        original_server = current.server if current else None

        try:
            # Switch to the target account
            authorized = (
                mt5.login(login, password=password, server=server)
                if password
                else mt5.login(login, server=server)
            )
            if not authorized:
                logger.warning("Cannot login to account %d@%s: %s", login, server, mt5.last_error())
                return None

            info = mt5.account_info()
            if info is None:
                return None

            return AccountInfo(
                login=info.login,
                server=info.server,
                balance=info.balance,
                equity=info.equity,
                profit=getattr(info, "profit", info.equity - info.balance),
                margin=info.margin,
                free_margin=info.margin_free,
                leverage=info.leverage,
                currency=info.currency,
                name=info.name,
            )
        finally:
            # Switch back to the original (master) account WITH password
            if self._master_login and self._master_password and self._master_server:
                if not mt5.login(self._master_login, password=self._master_password, server=self._master_server):
                    logger.error("Failed to switch back to master account %d@%s", self._master_login, self._master_server)
                    self._try_auto_connect()
            elif original_login and original_server:
                # Fallback if master creds not stored
                if not mt5.login(original_login, server=original_server):
                    logger.error("Failed to switch back to account %d@%s", original_login, original_server)
                    self._try_auto_connect()

    def get_positions(self) -> list[TradePosition]:
        """Get all open positions for the currently connected account."""
        if not self.ensure_connected():
            return []

        positions = mt5.positions_get()
        if positions is None:
            return []

        return [
            TradePosition(
                ticket=pos.ticket,
                symbol=pos.symbol,
                type=pos.type,
                volume=pos.volume,
                price_open=pos.price_open,
                price_current=pos.price_current,
                profit=pos.profit,
                swap=pos.swap,
                sl=pos.sl,
                tp=pos.tp,
                time=pos.time,
                magic=pos.magic,
                comment=pos.comment,
            )
            for pos in positions
        ]

    def query_positions(self, login: int, password: str | None, server: str) -> list[TradePosition] | None:
        """Temporarily switch to another account, fetch its positions, then switch back.

        Returns None on login failure so the caller can distinguish
        "login failed" from "no open positions" (empty list).
        """
        if not self.ensure_connected():
            return None

        try:
            # Switch to the target account
            authorized = (
                mt5.login(login, password=password, server=server)
                if password
                else mt5.login(login, server=server)
            )
            if not authorized:
                logger.warning("Cannot login to account %d@%s for positions: %s", login, server, mt5.last_error())
                return None

            positions = mt5.positions_get()
            if positions is None:
                return []

            return [
                TradePosition(
                    ticket=pos.ticket,
                    symbol=pos.symbol,
                    type=pos.type,
                    volume=pos.volume,
                    price_open=pos.price_open,
                    price_current=pos.price_current,
                    profit=pos.profit,
                    swap=pos.swap,
                    sl=pos.sl,
                    tp=pos.tp,
                    time=pos.time,
                    magic=pos.magic,
                    comment=pos.comment,
                )
                for pos in positions
            ]
        finally:
            # Switch back to the master account
            if self._master_login and self._master_password and self._master_server:
                if not mt5.login(self._master_login, password=self._master_password, server=self._master_server):
                    logger.error("Failed to switch back to master account %d@%s", self._master_login, self._master_server)
                    self._try_auto_connect()

    # ─── Trade Execution Methods ─────────────────────────────────────

    def place_order(
        self,
        symbol: str,
        direction: str,
        volume: float,
        price: float = 0.0,
        sl: float = 0.0,
        tp: float = 0.0,
        slippage: int = 5,
        magic: int = 123456,
        comment: str = "TradePro_Sync",
        login: int | None = None,
        password: str | None = None,
        server: str | None = None,
    ) -> dict | None:
        """Place a market order. If login/password/server are provided,
        temporarily switch to that account first (for slave execution)."""
        if not self.ensure_connected():
            return None

        original_login = None
        original_server = None

        # Switch to target account if credentials provided
        if login and password and server:
            current = mt5.account_info()
            original_login = current.login if current else None
            original_server = current.server if current else None
            if not mt5.login(login, password=password, server=server):
                logger.error("Cannot login to %d@%s for order: %s", login, server, mt5.last_error())
                return {"retcode": -1, "comment": f"Login failed: {mt5.last_error()}"}

        try:
            # Ensure the symbol is available
            info = mt5.symbol_info(symbol)
            if info is None:
                return {"retcode": -1, "comment": f"Symbol {symbol} not found"}
            if not info.visible:
                mt5.symbol_select(symbol, True)

            order_type = mt5.ORDER_TYPE_BUY if direction.upper() == "BUY" else mt5.ORDER_TYPE_SELL

            # Use current market price if none given
            if price <= 0:
                tick = mt5.symbol_info_tick(symbol)
                if tick is None:
                    return {"retcode": -1, "comment": f"Cannot get tick for {symbol}"}
                price = tick.ask if direction.upper() == "BUY" else tick.bid

            # Auto-detect filling mode from symbol properties
            filling_mode = self._get_filling_mode(info)

            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": float(volume),
                "type": order_type,
                "price": float(price),
                "deviation": slippage,
                "magic": magic,
                "comment": comment,
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": filling_mode,
            }
            if sl > 0:
                request["sl"] = float(sl)
            if tp > 0:
                request["tp"] = float(tp)

            result = mt5.order_send(request)
            if result is None:
                return {"retcode": -1, "comment": f"order_send failed: {mt5.last_error()}"}

            res = {
                "retcode": result.retcode,
                "order": result.order,
                "deal": result.deal,
                "volume": result.volume,
                "price": result.price,
                "comment": result.comment,
                "request_id": result.request_id,
            }
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                logger.info("Order placed: %s %s %.2f lots @ %.5f → ticket %d",
                            direction, symbol, volume, result.price, result.order)
            else:
                logger.warning("Order rejected: retcode=%d comment=%s", result.retcode, result.comment)
            return res
        finally:
            # Switch back to master account with stored credentials
            if original_login and original_server:
                if self._master_login and self._master_password and self._master_server:
                    if not mt5.login(self._master_login, password=self._master_password, server=self._master_server):
                        logger.error("Failed to switch back to master %d@%s", self._master_login, self._master_server)
                        self._try_auto_connect()
                else:
                    if not mt5.login(original_login, server=original_server):
                        logger.error("Failed to switch back to %d@%s", original_login, original_server)
                        self._try_auto_connect()

    def close_position(
        self,
        ticket: int,
        volume: float | None = None,
        slippage: int = 5,
        login: int | None = None,
        password: str | None = None,
        server: str | None = None,
    ) -> dict | None:
        """Close an open position by ticket. Optionally partial close with volume."""
        if not self.ensure_connected():
            return None

        original_login = None
        original_server = None

        if login and password and server:
            current = mt5.account_info()
            original_login = current.login if current else None
            original_server = current.server if current else None
            if not mt5.login(login, password=password, server=server):
                logger.error("Cannot login to %d@%s for close: %s", login, server, mt5.last_error())
                return {"retcode": -1, "comment": f"Login failed: {mt5.last_error()}"}

        try:
            position = mt5.positions_get(ticket=ticket)
            if not position or len(position) == 0:
                return {"retcode": -1, "comment": f"Position {ticket} not found"}

            pos = position[0]
            close_vol = volume if volume and volume > 0 else pos.volume

            # Opposite direction to close
            close_type = mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY
            tick = mt5.symbol_info_tick(pos.symbol)
            if tick is None:
                return {"retcode": -1, "comment": f"Cannot get tick for {pos.symbol}"}
            close_price = tick.bid if pos.type == 0 else tick.ask

            sym_info = mt5.symbol_info(pos.symbol)
            filling_mode = self._get_filling_mode(sym_info) if sym_info else mt5.ORDER_FILLING_RETURN

            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": pos.symbol,
                "volume": float(close_vol),
                "type": close_type,
                "position": ticket,
                "price": float(close_price),
                "deviation": slippage,
                "magic": pos.magic,
                "comment": "TradePro_Close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": filling_mode,
            }

            result = mt5.order_send(request)
            if result is None:
                return {"retcode": -1, "comment": f"close order_send failed: {mt5.last_error()}"}

            res = {
                "retcode": result.retcode,
                "order": result.order,
                "deal": result.deal,
                "volume": result.volume,
                "price": result.price,
                "comment": result.comment,
            }
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                logger.info("Position %d closed: %.2f lots @ %.5f", ticket, close_vol, result.price)
            else:
                logger.warning("Close rejected: retcode=%d comment=%s", result.retcode, result.comment)
            return res
        finally:
            if original_login and original_server:
                if self._master_login and self._master_password and self._master_server:
                    if not mt5.login(self._master_login, password=self._master_password, server=self._master_server):
                        logger.error("Failed to switch back to master %d@%s", self._master_login, self._master_server)
                        self._try_auto_connect()
                else:
                    if not mt5.login(original_login, server=original_server):
                        logger.error("Failed to switch back to %d@%s", original_login, original_server)
                        self._try_auto_connect()

    def modify_position(
        self,
        ticket: int,
        sl: float | None = None,
        tp: float | None = None,
        login: int | None = None,
        password: str | None = None,
        server: str | None = None,
    ) -> dict | None:
        """Modify SL/TP of an open position."""
        if not self.ensure_connected():
            return None

        original_login = None
        original_server = None

        if login and password and server:
            current = mt5.account_info()
            original_login = current.login if current else None
            original_server = current.server if current else None
            if not mt5.login(login, password=password, server=server):
                logger.error("Cannot login to %d@%s for modify: %s", login, server, mt5.last_error())
                return {"retcode": -1, "comment": f"Login failed: {mt5.last_error()}"}

        try:
            position = mt5.positions_get(ticket=ticket)
            if not position or len(position) == 0:
                return {"retcode": -1, "comment": f"Position {ticket} not found"}

            pos = position[0]
            request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "symbol": pos.symbol,
                "position": ticket,
                "sl": float(sl) if sl is not None else float(pos.sl),
                "tp": float(tp) if tp is not None else float(pos.tp),
            }

            result = mt5.order_send(request)
            if result is None:
                return {"retcode": -1, "comment": f"modify order_send failed: {mt5.last_error()}"}

            res = {
                "retcode": result.retcode,
                "order": result.order,
                "comment": result.comment,
            }
            if result.retcode == mt5.TRADE_RETCODE_DONE:
                logger.info("Position %d modified: SL=%.5f TP=%.5f", ticket,
                            sl if sl else pos.sl, tp if tp else pos.tp)
            else:
                logger.warning("Modify rejected: retcode=%d comment=%s", result.retcode, result.comment)
            return res
        finally:
            if original_login and original_server:
                if self._master_login and self._master_password and self._master_server:
                    if not mt5.login(self._master_login, password=self._master_password, server=self._master_server):
                        logger.error("Failed to switch back to master %d@%s", self._master_login, self._master_server)
                        self._try_auto_connect()
                else:
                    if not mt5.login(original_login, server=original_server):
                        logger.error("Failed to switch back to %d@%s", original_login, original_server)
                        self._try_auto_connect()

    def get_symbol_info(self, symbol: str) -> dict | None:
        """Get symbol information."""
        if not self.ensure_connected():
            return None

        info = mt5.symbol_info(symbol)
        if info is None:
            return None

        return {
            "name": info.name,
            "bid": info.bid,
            "ask": info.ask,
            "spread": info.spread,
            "digits": info.digits,
            "volume_min": info.volume_min,
            "volume_max": info.volume_max,
            "volume_step": info.volume_step,
        }

    def get_trade_history(self, days: int = 30) -> list[ClosedTrade]:
        """Get closed/completed trades from account history.

        Fetches deals from the last N days and pairs entry (IN) deals
        with their corresponding exit (OUT) deals to build a list of
        complete trades with entry time, exit time, entry price, exit price,
        instrument, direction, profit, etc.
        """
        if not self.ensure_connected():
            return []

        # MT5 Python API requires naive (timezone-unaware) datetimes
        date_from = datetime.utcnow() - timedelta(days=days)
        date_to = datetime.utcnow() + timedelta(days=1)

        deals = mt5.history_deals_get(date_from, date_to)
        if deals is None or len(deals) == 0:
            return []

        # Separate entry (IN) and exit (OUT) deals
        entries: dict[int, object] = {}  # order -> deal
        exits: list[object] = []

        for deal in deals:
            # Skip balance/commission-only deals (no symbol)
            if not deal.symbol:
                continue
            if deal.entry == 0:  # DEAL_ENTRY_IN
                entries[deal.order] = deal
            elif deal.entry == 1:  # DEAL_ENTRY_OUT
                exits.append(deal)

        # Match exit deals with their entry deals by position_id
        # Build mapping: position_id -> entry deal
        position_entries: dict[int, object] = {}
        for deal in deals:
            if not deal.symbol:
                continue
            if deal.entry == 0:  # IN
                position_entries[deal.position_id] = deal

        closed_trades: list[ClosedTrade] = []
        for exit_deal in exits:
            entry_deal = position_entries.get(exit_deal.position_id)
            if entry_deal is None:
                # Entry may be outside the date range; still show what we can
                closed_trades.append(ClosedTrade(
                    ticket_in=0,
                    ticket_out=exit_deal.ticket,
                    symbol=exit_deal.symbol,
                    type="SELL" if exit_deal.type == 0 else "BUY",  # exit is opposite
                    volume=exit_deal.volume,
                    entry_price=0.0,
                    exit_price=exit_deal.price,
                    entry_time=0,
                    exit_time=exit_deal.time,
                    profit=exit_deal.profit,
                    swap=exit_deal.swap,
                    commission=exit_deal.commission,
                    fee=exit_deal.fee,
                    comment=exit_deal.comment,
                    magic=exit_deal.magic,
                ))
            else:
                closed_trades.append(ClosedTrade(
                    ticket_in=entry_deal.ticket,
                    ticket_out=exit_deal.ticket,
                    symbol=entry_deal.symbol,
                    type="BUY" if entry_deal.type == 0 else "SELL",
                    volume=entry_deal.volume,
                    entry_price=entry_deal.price,
                    exit_price=exit_deal.price,
                    entry_time=entry_deal.time,
                    exit_time=exit_deal.time,
                    profit=exit_deal.profit,
                    swap=exit_deal.swap,
                    commission=entry_deal.commission + exit_deal.commission,
                    fee=entry_deal.fee + exit_deal.fee,
                    comment=entry_deal.comment,
                    magic=entry_deal.magic,
                ))

        # Sort by exit time descending (most recent first)
        closed_trades.sort(key=lambda t: t.exit_time, reverse=True)
        return closed_trades
