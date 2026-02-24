# MT5 Live Connection Server

This server bridges the trading platform frontend to a running MetaTrader 5 terminal for real-time account data, open positions, and trade history.

## Architecture

```
Frontend (Next.js)  <-->  Node Server (port 3001)  <-->  Python Bridge (port 8765)  <-->  MT5 Terminal
     REST + WebSocket          Express + WS                 websockets + MT5 API
```

## Prerequisites

1. **MetaTrader 5** terminal installed and running on the server machine (Windows only)
2. **Python 3.10+** with the `MetaTrader5` package
3. **Node.js 18+**

## Quick Start

### 1. Start the Python Bridge

```bash
cd python-bridge
pip install -r requirements.txt
python websocket_server.py
```

This starts a WebSocket server on port 8765 that communicates with the MT5 terminal.

### 2. Start the Node Server

```bash
npm install
npm run dev
```

This starts the Express + WebSocket server on port 3001 that the frontend connects to.

### 3. Configure Frontend Environment

Add to your `trading-platform-frontend/.env.local`:

```env
NEXT_PUBLIC_MT5_API_URL=http://localhost:3001
NEXT_PUBLIC_MT5_WS_URL=ws://localhost:3001/ws/mt5
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MT5_NODE_PORT` | `3001` | Node server port |
| `MT5_PYTHON_WS_URL` | `ws://localhost:8765` | Python bridge WebSocket URL |
| `FRONTEND_URL` | - | Frontend URL for CORS |

## API Endpoints

### REST (HTTP)

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/mt5/connect` | Connect to MT5 account |
| `POST` | `/api/mt5/disconnect` | Disconnect from MT5 |
| `GET` | `/api/mt5/account` | Get account info |
| `GET` | `/api/mt5/positions` | Get open positions |
| `GET` | `/api/mt5/history?days=30` | Get trade history |
| `POST` | `/api/mt5/subscribe` | Subscribe to symbol ticks |
| `POST` | `/api/mt5/unsubscribe` | Unsubscribe from ticks |
| `GET` | `/api/mt5/status` | Get connection status |
| `GET` | `/health` | Health check |

### WebSocket (`ws://localhost:3001/ws/mt5`)

**Outgoing messages (server -> client):**
- `status` — Connection status update
- `auth` — Authentication result
- `account_info` — Account data
- `positions` — Open positions
- `trade_history` — Closed trades
- `tick` — Real-time tick data
- `heartbeat` — Keep-alive

**Incoming actions (client -> server):**
- `{ action: "subscribe", symbol: "EURUSD" }`
- `{ action: "unsubscribe", symbol: "EURUSD" }`
- `{ action: "account_info" }`
- `{ action: "positions" }`
- `{ action: "trade_history", days: 30 }`
