"""
MT5 Client - MetaTrader 5 connection and operations handler.
"""

import MetaTrader5 as mt5
from models import AccountInfo, TradePosition, ClosedTrade
from encryption import decrypt_credentials
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)


class MT5Client:
    """Handles connection and operations with MetaTrader 5 terminal."""

    def __init__(self):
        self._connected = False
        self._account_info = None
        # Auto-initialize if MT5 terminal is already running
        if mt5.initialize():
            info = mt5.account_info()
            if info:
                self._connected = True
                logger.info("Connected to MT5 account %d on %s", info.login, info.server)

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

    @property
    def is_connected(self) -> bool:
        return self._connected

    def get_account_info(self) -> AccountInfo | None:
        """Retrieve current account information."""
        if not self._connected:
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
            margin=info.margin,
            free_margin=info.margin_free,
            leverage=info.leverage,
            currency=info.currency,
            name=info.name,
        )

    def get_positions(self) -> list[TradePosition]:
        """Get all open positions."""
        if not self._connected:
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

    def get_symbol_info(self, symbol: str) -> dict | None:
        """Get symbol information."""
        if not self._connected:
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
        if not self._connected:
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
