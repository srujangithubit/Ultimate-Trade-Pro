# Ultimate Trade Pro

Ultimate Trade Pro is a full-stack trading workspace for trade journaling,
performance analytics, strategy/backtesting workflows, community features, and
optional live MetaTrader 5 synchronization.

> This repository contains the application source and deployment templates.
> Broker credentials, API keys, local uploads, dependencies, and build output
> are intentionally excluded.

## Architecture

```text
Browser
  |
  +--> Next.js frontend (:3002)
          |
          +--> NestJS REST/WebSocket API (:3000)
          |       +--> PostgreSQL 16 / Prisma
          |       +--> Redis 7
          |       +--> analytics, journal, backtesting, community, AI reports
          |
          +--> MT5 Node bridge (:3001)
                    |
                    +--> Python WebSocket bridge (:8765)
                              |
                              +--> MetaTrader 5 terminal (Windows)
```

## Main components

- `backend/`: primary NestJS API, Prisma schema/migrations, authentication,
  journaling, analytics, backtesting, community, and trade-sync modules.
- `trading-platform-frontend/`: Next.js 16 frontend using React, TypeScript,
  Tailwind CSS, Zustand, React Query, Recharts, Lightweight Charts, and
  Three.js.
- `mt5-server/`: Express/WebSocket bridge that forwards browser requests to the
  Python MT5 integration.
- `mt5-server/python-bridge/`: Python `websockets` service using the
  `MetaTrader5` package.
- `docker-compose.yml`: local PostgreSQL, Redis, API, and observability stack.
- `infrastructure/`: Kubernetes, Helm, monitoring, and disaster-recovery
  configuration.
- `docs/api/openapi.yaml`: API description maintained in the repository.

`trading-platform-backend/` is an additional NestJS application tree retained
from the local project. The actively used local API is `backend/`.

## Requirements

- Git
- Node.js 20 or newer (the backend Dockerfile uses Node 20)
- npm
- Docker Desktop with Compose
- Python 3.10 or newer for the MT5 bridge
- A Windows MetaTrader 5 terminal for live MT5 features

## Quick start

### 1. Configure secrets

Copy the templates and replace placeholders locally:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item trading-platform-frontend\.env.example trading-platform-frontend\.env.local
Copy-Item mt5-server\.env.example mt5-server\.env
```

Use long random values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
`MT5_INTERNAL_API_KEY`. Never commit any `.env` file.

### 2. Install dependencies

```powershell
Set-Location backend
npm ci
npx prisma generate

Set-Location ..\trading-platform-frontend
npm ci

Set-Location ..\mt5-server
npm ci

Set-Location python-bridge
..\..\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

If no virtual environment exists, create one with
`py -m venv .venv` and use `.venv\Scripts\python.exe`.

### 3. Start infrastructure

From the repository root:

```powershell
$env:JWT_SECRET="local-development-secret"
$env:JWT_REFRESH_SECRET="local-development-refresh-secret"
$env:MT5_INTERNAL_API_KEY="local-development-mt5-key"
docker compose up -d postgres redis
docker compose ps
```

PostgreSQL is published on `localhost:5433`; Redis is published on
`localhost:6379`.

### 4. Apply the database schema

```powershell
Set-Location backend
npx prisma generate
npx prisma migrate deploy
```

The repository currently contains SQL migration files under
`backend/prisma/migrations`. Use `npx prisma db push` only for disposable
development databases.

### 5. Start the services

Open separate terminals:

```powershell
# API
Set-Location backend
npm run start:prod
```

```powershell
# Frontend
Set-Location trading-platform-frontend
npx next start --port 3002
```

```powershell
# MT5 Node bridge
Set-Location mt5-server
npm start
```

```powershell
# Python MT5 bridge
Set-Location mt5-server\python-bridge
..\..\.venv\Scripts\python.exe websocket_server.py
```

Open the application at <http://localhost:3002>.

## Development commands

### Backend

```powershell
Set-Location backend
npm run start:dev
npm run build
npm test
npm run test:e2e
npm run lint
```

Swagger is served at <http://localhost:3000/api>. Liveness is available at
`GET /health`; readiness is available at `GET /ready`.

### Frontend

```powershell
Set-Location trading-platform-frontend
npm run dev
npm run build
npm run lint
```

The development server uses port `3002` as configured in `package.json`.

### MT5 bridge

```powershell
Set-Location mt5-server
npm run dev
```

The Python bridge listens on `ws://localhost:8765`; the Node bridge listens on
`http://localhost:3001` and exposes its health endpoint at `/health`.

## Database and Redis

The primary Prisma schema is `backend/prisma/schema.prisma`. Important model
groups include users/sessions, trading accounts, trades, playbooks, backtesting
sessions, market candles, community content, and MT5 synchronization records.

Useful commands:

```powershell
docker compose logs -f postgres
docker compose logs -f redis
docker compose exec postgres pg_isready -U postgres -d trading_platform
docker compose exec redis redis-cli ping
Set-Location backend
npx prisma migrate status
npx prisma studio
```

## MT5 integration

MT5 support is optional for the rest of the application. Install MetaTrader 5
on Windows, sign in to the intended account, and keep the terminal running.
The Python bridge uses the official `MetaTrader5` Python package and the Node
bridge forwards REST/WebSocket traffic to it.

Configure `MASTER_MT5_LOGIN`, `MASTER_MT5_PASSWORD`, and `MASTER_MT5_SERVER`
only in the local `mt5-server/.env`. Do not put those values in source,
README files, CI variables committed to Git, or issue reports.

The browser-facing MT5 routes include:

- `GET /health`
- `POST /api/mt5/connect`
- `POST /api/mt5/disconnect`
- `GET /api/mt5/account`
- `GET /api/mt5/positions`
- `GET /api/mt5/history?days=30`
- `GET /api/mt5/status`

The browser WebSocket endpoint is `ws://localhost:3001/ws/mt5`. If MT5
authentication fails, the bridge can still be running while reporting
`mt5Authenticated: false`; verify the terminal login, broker server, account
permissions, and that the terminal is open.

## Docker and deployment

The Compose file includes PostgreSQL, Redis, the API build, and monitoring
services such as Prometheus, Grafana, Loki, Tempo, and exporters. Start the
local stack with:

```powershell
docker compose up -d
docker compose ps
docker compose logs -f api
docker compose down
```

The `backend/Dockerfile` builds the NestJS API. Kubernetes manifests are under
`infrastructure/k8s/`, and the Helm chart is under
`infrastructure/helm/trading-platform/`. The Kubernetes secret manifest is a
template only; provide real values through cluster secret management.

## Troubleshooting

- **Port in use:** `Get-NetTCPConnection -State Listen`; stop the owning
  process or change the corresponding service port.
- **PostgreSQL failure:** check `docker compose ps`, inspect
  `docker compose logs postgres`, and verify `DATABASE_URL` uses port `5433`
  for the local Compose mapping.
- **Redis failure:** check `docker compose logs redis` and
  `docker compose exec redis redis-cli ping`.
- **Prisma failure:** run `npx prisma generate`, then
  `npx prisma migrate status`; confirm PostgreSQL is healthy.
- **Frontend cannot reach API:** verify `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_WS_URL`, and that port `3000` is listening.
- **WebSocket failure:** verify both MT5 services, `MT5_PYTHON_WS_URL`, and
  the shared `MT5_INTERNAL_API_KEY`.
- **MT5 disconnected:** keep the Windows terminal open and recheck account
  credentials, broker server, and terminal authorization.
- **Missing environment variable:** compare local files with the three
  `.env.example` templates and restart the affected service.

## Testing and quality

The backend uses Jest and has targeted unit/e2e tests. The frontend uses
Next.js ESLint configuration and Playwright dependencies. Run the commands in
the development sections after installing dependencies. Full MT5 verification
requires a configured Windows terminal and valid broker account.

## Security

Secrets are intentionally excluded through `.gitignore`. Templates contain
placeholders only. Rotate any credential that has ever been stored in a local
file, shell history, log, screenshot, or chat attachment before using a shared
or production environment.

## License

This repository does not currently declare an explicit open-source license.

## Author

**Srujan Javaregowda**<br>
<https://github.com/srujangithubit>
