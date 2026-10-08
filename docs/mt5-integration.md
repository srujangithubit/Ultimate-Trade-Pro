# MT5 integration

## Components

1. A Windows MetaTrader 5 terminal provides the broker connection.
2. `mt5-server/python-bridge/websocket_server.py` talks to the terminal through
   the `MetaTrader5` Python package on port `8765`.
3. `mt5-server/server.js` provides REST and browser WebSocket access on port
   `3001`.
4. The frontend uses `NEXT_PUBLIC_MT5_API_URL` and
   `NEXT_PUBLIC_MT5_WS_URL`.

## Configuration

Copy `mt5-server/.env.example` to `mt5-server/.env`. Set the shared
`MT5_INTERNAL_API_KEY`. For automatic master-account authentication, also set
the master login, password, and broker server in that file only.

## Startup

```powershell
Set-Location mt5-server\python-bridge
..\..\.venv\Scripts\python.exe websocket_server.py
```

In another terminal:

```powershell
Set-Location mt5-server
npm start
```

Verify `http://localhost:3001/health`. A running bridge with
`mt5Authenticated: false` indicates that the service is reachable but the
terminal rejected or has not completed account authentication.

## Troubleshooting

- Keep the MT5 terminal open and logged into the intended broker server.
- Confirm the login, password, and server name match the broker exactly.
- Check the Python bridge output for MetaTrader initialization errors.
- Check the Node bridge output for WebSocket reconnects.
- Ensure Windows Firewall permits local ports `3001` and `8765`.
- Never paste credentials into source files or commit `.env`.
