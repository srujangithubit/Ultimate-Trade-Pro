# Local setup

This document describes the supported fresh-machine setup for Windows.

## Minimum setup

1. Install Git, Node.js 20+, npm, and Docker Desktop.
2. Clone the repository and copy:
   - `.env.example` to `.env`
   - `backend/.env.example` to `backend/.env`
   - `trading-platform-frontend/.env.example` to
     `trading-platform-frontend/.env.local`
3. Set the JWT and service-key placeholders locally.
4. Run `docker compose up -d postgres redis` from the repository root.
5. Run `npm ci` and `npx prisma generate` in `backend`.
6. Run `npm ci` in `trading-platform-frontend`.
7. Run `npx prisma db push` in `backend` for a disposable development database.
8. Start `npm run start:dev` in `backend`.
9. Start `npm run dev` in `trading-platform-frontend`.
10. Open <http://localhost:3002>.

The project does not currently contain Prisma Migrate directory history, so
`npx prisma migrate deploy` is not a valid fresh-machine command here.

## Full setup

For MT5, install MetaTrader 5 on Windows, copy
`mt5-server/.env.example` to `mt5-server/.env`, and install:

```powershell
Set-Location mt5-server
npm ci
Set-Location ..
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r mt5-server\python-bridge\requirements.txt
```

Start the Python bridge before the Node bridge:

```powershell
Set-Location mt5-server\python-bridge
..\..\.venv\Scripts\python.exe websocket_server.py
```

In another terminal:

```powershell
Set-Location mt5-server
npm start
```

The Python bridge uses port `8765`; the Node bridge uses port `3001`.

## Verification

```powershell
Invoke-WebRequest http://localhost:3000/health
Invoke-WebRequest http://localhost:3001/health
Invoke-WebRequest http://localhost:3002
docker compose exec postgres pg_isready -U postgres -d trading_platform
docker compose exec redis redis-cli ping
```
