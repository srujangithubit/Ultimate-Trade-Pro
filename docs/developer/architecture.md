# Architecture Overview

## System Architecture

```mermaid
graph TB
    subgraph Client["Frontend (Next.js)"]
        UI["React Components"]
        Charts["TradingView Charts"]
        WS["WebSocket Client"]
    end

    subgraph API["Backend (NestJS)"]
        Auth["Auth Module"]
        Users["Users Module"]
        BT["Backtesting Module"]
        TJ["Trade Journal Module"]
        PB["Playbooks Module"]
        AN["Analytics Module"]
        BR["Broker Module"]
        NT["Notifications Module"]
        SUB["Subscriptions Module"]
    end

    subgraph Data["Data Layer"]
        PG["PostgreSQL 15+"]
        TS["TimescaleDB"]
        Redis["Redis Cache"]
    end

    subgraph External["External Services"]
        Stripe["Stripe (Payments)"]
        SendGrid["SendGrid (Email)"]
        Polygon["Polygon.io (Market Data)"]
        S3["AWS S3 (Storage)"]
        Sentry["Sentry (Errors)"]
        IB["Interactive Brokers"]
        Alpaca["Alpaca"]
        TDA["TD Ameritrade"]
    end

    Client --> API
    WS <-.-> API
    API --> Data
    API --> External
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js + React + TypeScript | UI, routing, SSR |
| **Charting** | TradingView Lightweight Charts | Candlestick/line charts |
| **Backend** | NestJS + TypeScript | REST API, WebSocket |
| **ORM** | Prisma | Database access |
| **Database** | PostgreSQL 15+ | Primary data store |
| **Time-series** | TimescaleDB | Historical price data |
| **Cache** | Redis | Session cache, rate limiting |
| **Auth** | JWT + bcrypt | Authentication |
| **Payments** | Stripe | Subscriptions, checkout |
| **Email** | SendGrid | Transactional emails |
| **Market Data** | Polygon.io | OHLCV data, symbol search |
| **Storage** | AWS S3 | Screenshots, exports |
| **Monitoring** | Sentry + Prometheus + Grafana | Errors, metrics, dashboards |
| **CI/CD** | GitHub Actions | Build, test, deploy |
| **Infrastructure** | Kubernetes (AWS EKS) | Container orchestration |

## Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as API Gateway
    participant Auth as Auth Guard
    participant Ctrl as Controller
    participant Svc as Service
    participant DB as PostgreSQL

    C->>GW: HTTP Request + JWT
    GW->>Auth: Validate Token
    Auth-->>GW: User Context
    GW->>Ctrl: Route to Controller
    Ctrl->>Svc: Business Logic
    Svc->>DB: Query/Mutation
    DB-->>Svc: Result
    Svc-->>Ctrl: Response DTO
    Ctrl-->>C: JSON Response
```

## Module Dependencies

```mermaid
graph LR
    Auth --> Users
    Backtesting --> Users
    Backtesting --> Playbooks
    TradeJournal --> Users
    TradeJournal --> Playbooks
    Analytics --> TradeJournal
    BrokerModule --> Users
    BrokerModule --> TradeJournal
    Notifications --> Users
    Subscriptions --> Users
    Subscriptions --> Stripe
```

## Data Flow

1. **User signs up** → Auth Module → Creates user record → Sends verification email
2. **Creates backtest session** → Backtesting Module → Fetches historical data from Polygon.io → Stores session
3. **Places trades** → Backtesting Module → Calculates P&L (DB trigger) → Updates balance
4. **Imports CSV** → Trade Journal Module → Parses CSV → Creates trade records → Auto-calculates P&L
5. **Broker sync** → Broker Module → Calls broker API → Maps trades → Imports to journal
6. **Views analytics** → Analytics Module → Queries materialized views → Returns metrics

## Directory Structure

```
backtesting/
├── backend/                    # Primary NestJS API
│   ├── src/
│   │   ├── auth/              # Authentication (JWT, guards, strategies)
│   │   ├── database/          # Database config and seeds
│   │   ├── prisma/            # Prisma service
│   │   └── main.ts            # Application entry point
│   ├── prisma/
│   │   └── schema.prisma      # Prisma schema
│   └── test/                  # E2E tests
├── trading-platform-backend/   # Extended backend
│   └── src/modules/
│       ├── auth/              # Auth module
│       └── users/             # Users module
├── trading-platform-frontend/  # Next.js frontend
│   ├── app/                   # App router pages
│   └── public/                # Static assets
├── database/
│   ├── schema/                # SQL migrations
│   ├── seeds/                 # Seed data
│   └── docs/                  # DB documentation
└── docs/                      # This documentation
```
