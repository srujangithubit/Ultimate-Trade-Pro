"""
WebSocket Server - Streams real-time MT5 data to connected clients.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets
from websockets.asyncio.server import serve, ServerConnection
from mt5_client import MT5Client
from data_fetcher import get_ticks, get_ohlcv, get_latest_tick

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 10  # seconds
TICK_POLL_INTERVAL = 0.2  # seconds — 5 polls/sec for smooth candle movement


class MT5WebSocketServer:
    """WebSocket server that streams MT5 data to Node.js backend."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.mt5 = MT5Client()
        self.clients: set[ServerConnection] = set()
        self._subscriptions: dict[str, set] = {}  # symbol -> set of clients
        self._running = False
        self._mt5_lock = asyncio.Lock()  # Serialize all MT5 operations

    async def start(self):
        """Start the WebSocket server."""
        logger.info("Starting WebSocket server on %s:%d", self.host, self.port)
        self._running = True
        async with serve(self._handler, self.host, self.port) as server:
            # Run tick streamer and heartbeat alongside the server
            asyncio.create_task(self._tick_streamer())
            asyncio.create_task(self._heartbeat())
            await server.serve_forever()

    async def _handler(self, ws: ServerConnection):
        """Handle incoming WebSocket connections."""
        self.clients.add(ws)
        client_id = id(ws)
        logger.info("Client connected: %s", client_id)

        try:
            async for message in ws:
                await self._process_message(ws, str(message))
        except websockets.ConnectionClosed:
            logger.info("Client disconnected: %s", client_id)
        finally:
            self.clients.discard(ws)
            self._remove_client_subscriptions(ws)

    async def _process_message(self, ws, message: str):
        """Process incoming client messages."""
        try:
            data = json.loads(message)
            action = data.get("action")

            if action == "connect":
                async with self._mt5_lock:
                    success = self.mt5.connect(
                        server=data["server"],
                        login=int(data["login"]),
                        password=data["password"],
                    )
                await ws.send(json.dumps({"type": "auth", "success": success}))

            elif action == "disconnect":
                async with self._mt5_lock:
                    self.mt5.disconnect()
                self._remove_client_subscriptions(ws)
                await ws.send(json.dumps({"type": "disconnected", "success": True}))

            elif action == "subscribe":
                symbol = data["symbol"]
                if symbol not in self._subscriptions:
                    self._subscriptions[symbol] = set()
                self._subscriptions[symbol].add(ws)
                await ws.send(
                    json.dumps({"type": "subscribed", "symbol": symbol})
                )

            elif action == "unsubscribe":
                symbol = data["symbol"]
                if symbol in self._subscriptions:
                    self._subscriptions[symbol].discard(ws)

            elif action == "account_info":
                async with self._mt5_lock:
                    info = self.mt5.get_account_info()
                await ws.send(
                    json.dumps(
                        {"type": "account_info", "data": info.to_dict() if info else None}
                    )
                )

            elif action == "query_account":
                login = int(data["login"])
                password = data.get("password")
                server = data["server"]
                async with self._mt5_lock:
                    info = self.mt5.query_account(login, password, server)
                await ws.send(
                    json.dumps(
                        {"type": "query_account", "login": login, "data": info.to_dict() if info else None}
                    )
                )

            elif action == "query_positions":
                login = int(data["login"])
                password = data.get("password")
                server = data["server"]
                async with self._mt5_lock:
                    positions = self.mt5.query_positions(login, password, server)
                await ws.send(
                    json.dumps(
                        {
                            "type": "query_positions",
                            "login": login,
                            "data": [p.to_dict() for p in positions] if positions is not None else None,
                        }
                    )
                )

            elif action == "place_order":
                async with self._mt5_lock:
                    result = self.mt5.place_order(
                        symbol=data["symbol"],
                        direction=data["direction"],
                        volume=float(data["volume"]),
                        price=float(data.get("price", 0)),
                        sl=float(data.get("sl", 0)),
                        tp=float(data.get("tp", 0)),
                        slippage=int(data.get("slippage", 5)),
                        magic=int(data.get("magic", 123456)),
                        comment=data.get("comment", "TradePro_Sync"),
                        login=int(data["login"]) if data.get("login") else None,
                        password=data.get("password"),
                        server=data.get("server"),
                    )
                await ws.send(
                    json.dumps({"type": "place_order", "data": result})
                )

            elif action == "close_position":
                async with self._mt5_lock:
                    result = self.mt5.close_position(
                        ticket=int(data["ticket"]),
                        volume=float(data["volume"]) if data.get("volume") else None,
                        slippage=int(data.get("slippage", 5)),
                        login=int(data["login"]) if data.get("login") else None,
                        password=data.get("password"),
                        server=data.get("server"),
                    )
                await ws.send(
                    json.dumps({"type": "close_position", "data": result})
                )

            elif action == "modify_position":
                async with self._mt5_lock:
                    result = self.mt5.modify_position(
                        ticket=int(data["ticket"]),
                        sl=float(data["sl"]) if data.get("sl") is not None else None,
                        tp=float(data["tp"]) if data.get("tp") is not None else None,
                        login=int(data["login"]) if data.get("login") else None,
                        password=data.get("password"),
                        server=data.get("server"),
                    )
                await ws.send(
                    json.dumps({"type": "modify_position", "data": result})
                )

            elif action == "positions":
                async with self._mt5_lock:
                    positions = self.mt5.get_positions()
                await ws.send(
                    json.dumps(
                        {
                            "type": "positions",
                            "data": [p.to_dict() for p in positions],
                        }
                    )
                )

            elif action == "trade_history":
                days = data.get("days", 30)
                async with self._mt5_lock:
                    trades = self.mt5.get_trade_history(days=days)
                await ws.send(
                    json.dumps(
                        {
                            "type": "trade_history",
                            "data": [t.to_dict() for t in trades],
                        }
                    )
                )

            elif action == "ohlcv":
                symbol = data.get("symbol", "EURUSD")
                timeframe = data.get("timeframe", "M5")
                bars = data.get("bars", 200)
                async with self._mt5_lock:
                    candles = get_ohlcv(symbol, timeframe, bars)
                await ws.send(
                    json.dumps(
                        {"type": "ohlcv", "symbol": symbol, "timeframe": timeframe, "data": candles},
                        default=str,
                    )
                )

            else:
                await ws.send(
                    json.dumps({"type": "error", "message": f"Unknown action: {action}"})
                )

        except (json.JSONDecodeError, KeyError) as e:
            await ws.send(
                json.dumps({"type": "error", "message": str(e)})
            )

    async def _tick_streamer(self):
        """Stream tick data to subscribed clients."""
        last_ticks: dict[str, tuple] = {}  # symbol -> (bid, ask) to detect changes
        while self._running:
            for symbol, clients in list(self._subscriptions.items()):
                if not clients:
                    continue
                tick = get_latest_tick(symbol)
                if not tick:
                    continue
                # Only broadcast if bid or ask changed
                key = (tick["bid"], tick["ask"])
                if last_ticks.get(symbol) == key:
                    continue
                last_ticks[symbol] = key
                msg = json.dumps({
                    "type": "tick",
                    "symbol": symbol,
                    "data": tick,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }, default=str)
                await asyncio.gather(
                    *[c.send(msg) for c in clients],
                    return_exceptions=True,
                )
            await asyncio.sleep(TICK_POLL_INTERVAL)

    async def _heartbeat(self):
        """Send periodic heartbeats to all connected clients."""
        while self._running:
            if self.clients:
                msg = json.dumps({"type": "heartbeat", "timestamp": datetime.now(timezone.utc).isoformat()})
                await asyncio.gather(
                    *[c.send(msg) for c in self.clients],
                    return_exceptions=True,
                )
            await asyncio.sleep(HEARTBEAT_INTERVAL)

    def _remove_client_subscriptions(self, ws):
        """Remove a client from all subscriptions."""
        for clients in self._subscriptions.values():
            clients.discard(ws)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    server = MT5WebSocketServer()
    asyncio.run(server.start())
