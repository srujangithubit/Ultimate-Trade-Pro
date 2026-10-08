# Ultimate Trade Pro

Ultimate Trade Pro is a full-stack trading workspace with trade journaling,
performance analytics, backtesting, community features, AI-report integrations,
and optional live MetaTrader 5 synchronization.

The repository contains the active local application plus deployment and
observability templates. Credentials, dependency directories, build output,
local uploads, and runtime logs are intentionally excluded.

## Quick start: core application

The core application needs PostgreSQL, Redis, the NestJS API, and the Next.js
frontend. MT5 is optional.

### Prerequisites

- Windows 10/11, Git, Node.js 20+, npm, and Docker Desktop with Compose.
- Python 3.10+ only if the MT5 bridge is needed.
- A MetaTrader 5 terminal and broker account only for live MT5 features.

### Fresh Windows setup

From PowerShell:

```powershell
git clone https://github.com/srujangithubit/Ultimate-Trade-Pro.git
Set-Location Ultimate-Trade-Pro

Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item trading-platform-frontend\.env.example trading-platform-frontend\.env.local
```

Replace the placeholder JWT and internal-service values in `backend\.env` and
`.env`. Keep these files local.

Install the active application dependencies:

```powershell
Set-Location backend
npm ci
npx prisma generate

Set-Location ..\trading-platform-frontend
npm ci
```

Start PostgreSQL and Redis from the repository root. Compose reads the root
`.env`; the required JWT variables must therefore be present before this
command:

```powershell
Set-Location ..
$env:JWT_SECRET = "replace-this-local-secret"
$env:JWT_REFRESH_SECRET = "replace-this-local-refresh-secret"
$env:MT5_INTERNAL_API_KEY = "replace-this-local-mt5-key"
docker compose up -d postgres redis
docker compose ps
```

The project does not currently contain Prisma Migrate directories. For a
disposable fresh development database, synchronize the Prisma schema with:

```powershell
Set-Location backend
npx prisma db push
```

`db push` is for development and can change database structure without
creating a migration history. Do not use it as a production deployment process.
The checked-in SQL files under `database/schema/` and
`backend/prisma/migrations/` are supplemental/manual SQL, not Prisma Migrate
history.

Start the API in one terminal:

```powershell
Set-Location backend
npm run start:dev
```

Start the frontend in another:

```powershell
Set-Location trading-platform-frontend
npm run dev
```

Open <http://localhost:3002>.

## Full setup, including MT5

Copy the MT5 template:

```powershell
Copy-Item mt5-server\.env.example mt5-server\.env
Set-Location mt5-server
npm ci
Set-Location ..
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r mt5-server\python-bridge\requirements.txt
```

Set `MT5_INTERNAL_API_KEY` to the same value used by the backend. Set
`MASTER_MT5_LOGIN`, `MASTER_MT5_PASSWORD`, and `MASTER_MT5_SERVER` only in the
local `mt5-server\.env` when automatic master-account authentication is needed.

Keep MetaTrader 5 open and logged into the intended broker account. Start the
Python bridge first:

```powershell
Set-Location mt5-server\python-bridge
..\..\.venv\Scripts\python.exe websocket_server.py
```

Then start the Node bridge in a separate terminal:

```powershell
Set-Location mt5-server
npm start
```

The MT5 bridge can be reachable while reporting
`mt5Authenticated: false`; that means the process is running but the terminal
or account authentication failed.

## Architecture

```text
Browser
  |
  +--> Next.js frontend (:3002)
          |
          +--> NestJS REST/WebSocket API (:3000)
          |       +--> PostgreSQL 16 / Prisma
          |       +--> Redis 7
          |       +--> auth, journal, analytics, backtesting, community
          |
          +--> MT5 Node bridge (:3001)
                    |
                    +--> Python WebSocket bridge (:8765)
                              |
                              +--> MetaTrader 5 terminal -> broker
```

## Services and ports

| Service | Port | Purpose |
|---|---:|---|
| Next.js frontend | 3002 | Browser application |
| NestJS API | 3000 | REST, Socket.IO, Swagger, metrics |
| MT5 Node bridge | 3001 | MT5 REST and browser WebSocket bridge |
| Python MT5 bridge | 8765 | WebSocket service for MetaTrader 5 |
| PostgreSQL 16 | 5433 | Local database published by Compose |
| Redis 7 | 6379 | Cache and distributed state |
| Grafana (optional) | 3003 | Observability dashboard |
| Prometheus (optional) | 9090 | Metrics collection |
| Loki (optional) | 3100 | Log storage |
| Tempo (optional) | 3200/4318 | Trace storage/OTLP |

## Repository structure

- `backend/`: active NestJS API and Prisma schema.
- `trading-platform-frontend/`: active Next.js 16 frontend.
- `mt5-server/`: active Node and Python MT5 bridges.
- `database/`: legacy/manual PostgreSQL schema, indexes, and development seed
  scripts; inspect before applying to an existing database.
- `infrastructure/`: Docker monitoring, Kubernetes manifests, and Helm chart.
- `docs/api/openapi.yaml`: checked-in API reference.
- `trading-platform-backend/`: secondary/legacy NestJS tree retained from the
  original local project; it is not the active API used by the local startup
  sequence.

## Environment variables

Use the three service templates rather than inventing variable names.

| Variable | Service | Required | Purpose |
|---|---|---:|---|
| `DATABASE_URL` | backend | Yes | PostgreSQL connection string |
| `JWT_SECRET` | backend | Yes | Access-token signing secret |
| `JWT_REFRESH_SECRET` | backend | Yes | Refresh-token signing secret |
| `MT5_INTERNAL_API_KEY` | backend/MT5 | Yes for MT5 | Service-to-service authentication |
| `REDIS_HOST`, `REDIS_PORT` | backend | Optional | Redis connection settings |
| `REDIS_URL` | backend | Optional | Preferred Redis connection URL |
| `CORS_ORIGIN_ALLOWLIST` | backend | Optional | Comma-separated browser origins |
| `FMP_API_KEY` | frontend | Optional | Financial Modeling Prep calendar data |
| `POLYGON_API_KEY` | backend | Optional | Polygon integration |
| `STRIPE_SECRET_KEY` | backend | Optional | Stripe integration |
| `STRIPE_WEBHOOK_SECRET` | backend | Optional | Stripe webhook verification |
| `MASTER_MT5_LOGIN` | MT5 | Optional | Master MT5 account login |
| `MASTER_MT5_PASSWORD` | MT5 | Optional | Master MT5 account password |
| `MASTER_MT5_SERVER` | MT5 | Optional | Broker/server name |

The complete variable lists are in `backend/.env.example`,
`trading-platform-frontend/.env.example`, and `mt5-server/.env.example`.

## Database

Compose runs PostgreSQL 16 as database `trading_platform`, user `postgres`,
password `postgres`, published as `localhost:5433`. The active Prisma schema is
`backend/prisma/schema.prisma`.

Useful commands:

```powershell
docker compose logs -f postgres
docker compose exec postgres pg_isready -U postgres -d trading_platform
Set-Location backend
npx prisma validate
npx prisma generate
npx prisma db push
npx prisma studio
```

`npx prisma migrate deploy` is not currently applicable because this repository
has no Prisma Migrate directory history. Do not run `prisma migrate reset` on
any database containing data; it is destructive. The SQL files in
`database/schema/` and `backend/prisma/migrations/` require deliberate,
ordered application with `psql` when their changes are needed.

## Running and testing

Backend commands are defined in `backend/package.json`:

```powershell
Set-Location backend
npm run start:dev
npm run build
npm test
npm run test:e2e
npm run lint
npm run format
```

Frontend commands are defined in `trading-platform-frontend/package.json`:

```powershell
Set-Location trading-platform-frontend
npm run dev
npm run build
npm run lint
```

For a production-style frontend run `npm run build` first, then
`npx next start --port 3002`. The backend production command also requires
`npm run build` first, then `npm run start:prod`.

The repository has no root orchestration script. Keeping services in separate
terminals avoids introducing a platform-specific task runner and matches the
actual package scripts.

## Health checks and API

- `GET http://localhost:3000/health`: NestJS liveness and memory check.
- `GET http://localhost:3000/ready`: database, memory, and disk readiness
  check. Its disk path is currently `/`, so it is intended for Linux/container
  deployments and may fail on native Windows.
- `GET http://localhost:3001/health`: MT5 Node process, bridge, and
  authentication status.
- `http://localhost:3000/api`: generated Swagger UI.
- `ws://localhost:3001/ws/mt5`: browser-facing MT5 WebSocket.

`docs/api/openapi.yaml` is a checked-in reference. Swagger generated by the
running backend is the authoritative local API surface.

## Docker and observability

`docker compose up -d postgres redis` starts the minimum infrastructure.
`docker compose up -d` also builds/runs the API and starts Prometheus, Grafana,
Loki, Tempo, Promtail, and exporters. The full Compose stack requires the
root-level `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `MT5_INTERNAL_API_KEY`
variables.

```powershell
docker compose ps
docker compose logs -f api
docker compose down
```

Persistent volumes are used for PostgreSQL, Redis, Prometheus, Grafana, and
Tempo data. Do not use `docker compose down -v` unless deleting local data is
intentional.

## Kubernetes, Helm, and CI/CD

Kubernetes manifests are in `infrastructure/k8s/`; the Helm chart is in
`infrastructure/helm/trading-platform/`. They deploy the API only and expect
an external PostgreSQL/Redis service, an image in the configured registry, an
Ingress controller, and externally managed secrets. Do not apply
`infrastructure/k8s/secrets.yaml` unchanged; create a cluster secret with real
values through the cluster's secret-management process.

`.github/workflows/ci.yml` runs the repository CI checks on pushes and pull
requests. The deployment and monitoring workflows are manual or operational
workflows and require a configured registry, cluster, database, and GitHub
secrets. The checked-in deployment manifests are templates, not a turnkey
production environment.

## MT5 troubleshooting

- **Port conflict:** `Get-NetTCPConnection -State Listen`; stop the owning
  process or change the service template.
- **PostgreSQL/Redis unavailable:** run `docker compose ps`, inspect service
  logs, and verify `5433`/`6379`.
- **Prisma error:** run `npx prisma validate`, `npx prisma generate`, then
  verify `DATABASE_URL`; remember that `migrate deploy` is not configured.
- **Frontend cannot reach API:** check `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_WS_URL`, and that port `3000` is listening.
- **Node bridge cannot reach Python:** start Python first and check
  `MT5_PYTHON_WS_URL` and port `8765`.
- **MT5 authorization failure:** keep the terminal open, verify the broker
  server/login/password, and confirm the terminal is authorized for automated
  integration.
- **Missing environment variable:** compare the appropriate `.env` file with
  its `.env.example` template and restart the affected process.

## Known limitations and security

- Live MT5 requires Windows, an installed/running terminal, and valid broker
  credentials; it cannot be fully verified in CI.
- AI, payments, and market-data integrations require their optional external
  credentials.
- The native Windows readiness check may fail because `/ready` checks the Unix
  path `/`.
- Production deployment requires external secret management and database/Redis
  services.
- Never commit `.env` files, broker credentials, API keys, private keys, or
  generated runtime data. Rotate any credential that has appeared in a local
  log or shell history.

## License and author

This repository does not currently declare an explicit open-source license.

**Srujan Javaregowda**
<https://github.com/srujangithubit>
