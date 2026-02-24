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
from data_fetcher import get_ticks

logger = logging.getLogger(__name__)

HEARTBEAT_INTERVAL = 10  # seconds
TICK_POLL_INTERVAL = 0.5  # seconds


class MT5WebSocketServer:
    """WebSocket server that streams MT5 data to Node.js backend."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.mt5 = MT5Client()
        self.clients: set[ServerConnection] = set()
        self._subscriptions: dict[str, set] = {}  # symbol -> set of clients
        self._running = False

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
                await self._process_message(ws, message)
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
                success = self.mt5.connect(
                    server=data["server"],
                    login=int(data["login"]),
                    password=data["password"],
                )
                await ws.send(json.dumps({"type": "auth", "success": success}))

            elif action == "disconnect":
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
                info = self.mt5.get_account_info()
                await ws.send(
                    json.dumps(
                        {"type": "account_info", "data": info.to_dict() if info else None}
                    )
                )

            elif action == "positions":
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
                trades = self.mt5.get_trade_history(days=days)
                await ws.send(
                    json.dumps(
                        {
                            "type": "trade_history",
                            "data": [t.to_dict() for t in trades],
                        }
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
        while self._running:
            for symbol, clients in list(self._subscriptions.items()):
                if not clients:
                    continue
                ticks = get_ticks(symbol, count=1)
                if ticks:
                    msg = json.dumps({
                        "type": "tick",
                        "symbol": symbol,
                        "data": ticks[-1],
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
