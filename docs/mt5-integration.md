# MetaTrader 5 integration

## Data flow

```text
TradePro frontend
        |
        v
NestJS backend and/or MT5 Node bridge (:3001)
        |
        v
Python WebSocket bridge (:8765)
        |
        v
MetaTrader 5 terminal on Windows
        |
        v
Broker
```

The Node bridge exposes browser REST/WebSocket routes and forwards MT5
operations to the Python bridge. The Python bridge uses the `MetaTrader5`
package and requires a Windows terminal installation.

## Requirements

- Windows with MetaTrader 5 installed.
- The terminal must be open and logged into the intended broker account.
- Python 3.10+ and the packages in
  `mt5-server/python-bridge/requirements.txt`.
- Node.js 18+ for the Node bridge.
- Matching broker server, login, and password values.

## Configure

```powershell
Copy-Item mt5-server\.env.example mt5-server\.env
```

Set `MT5_INTERNAL_API_KEY` to the same non-placeholder value used by the
backend. Set `MASTER_MT5_LOGIN`, `MASTER_MT5_PASSWORD`, and
`MASTER_MT5_SERVER` only when automatic master-account authentication is
required. Never commit these values.

## Start order

From the repository root:

```powershell
Set-Location mt5-server\python-bridge
..\..\.venv\Scripts\python.exe websocket_server.py
```

In a second terminal:

```powershell
Set-Location mt5-server
npm start
```

The frontend uses `NEXT_PUBLIC_MT5_API_URL` and
`NEXT_PUBLIC_MT5_WS_URL`. The browser WebSocket endpoint is
`ws://localhost:3001/ws/mt5`.

## Verification

```powershell
Invoke-WebRequest http://localhost:3001/health
```

The response reports whether the Node process is connected to Python and
whether MT5 authentication succeeded. A reachable service with
`mt5Authenticated: false` means the bridge is running but the terminal rejected
or has not completed authentication.

## Common failures

- **Python connection refused:** start the Python bridge first and verify port
  `8765`.
- **Authorization failed:** verify the broker server, account login/password,
  terminal profile, and that the terminal is running.
- **Broker/server mismatch:** use the exact server name shown in the MT5
  terminal account connection screen.
- **Node reconnect loop:** compare `MT5_PYTHON_WS_URL` and the Python listening
  address, then inspect both process logs.
- **Frontend WebSocket failure:** verify port `3001`, the frontend MT5 URLs,
  and the shared internal API key.
- **Windows firewall/permissions:** allow local Node/Python processes and keep
  the terminal available to the Python package.

Live synchronization cannot be validated without a running terminal and valid
broker credentials.
