# API Endpoint Reference

Complete reference for all Trading Platform API endpoints.

> **Base URL:** `https://api.tradingplatform.com/v1`
> **Auth:** All endpoints except `/auth/*` require a Bearer JWT token.

---

## Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/signup` | Register a new account | No |
| `POST` | `/auth/signin` | Login with email & password | No |
| `POST` | `/auth/refresh` | Refresh access token | No |
| `POST` | `/auth/forgot-password` | Request password reset email | No |
| `POST` | `/auth/reset-password` | Reset password with token | No |
| `POST` | `/auth/verify-email` | Verify email address | No |

## Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/users/me` | Get current user profile | Yes |
| `PATCH` | `/users/me` | Update profile | Yes |
| `PUT` | `/users/me/preferences` | Update preferences | Yes |

## Backtesting

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/backtesting/sessions` | List sessions (paginated) | Yes |
| `POST` | `/backtesting/sessions` | Create a session | Yes |
| `GET` | `/backtesting/sessions/:id` | Get session details | Yes |
| `PATCH` | `/backtesting/sessions/:id` | Update session | Yes |
| `DELETE` | `/backtesting/sessions/:id` | Delete session | Yes |
| `GET` | `/backtesting/sessions/:id/trades` | List session trades | Yes |
| `POST` | `/backtesting/sessions/:id/trades` | Place a trade | Yes |
| `GET` | `/backtesting/sessions/:id/positions` | List open positions | Yes |

## Trade Journal

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/trades` | List trades (paginated, filterable) | Yes |
| `POST` | `/trades` | Log a new trade | Yes |
| `GET` | `/trades/:id` | Get trade details | Yes |
| `PATCH` | `/trades/:id` | Update a trade | Yes |
| `DELETE` | `/trades/:id` | Delete a trade | Yes |
| `POST` | `/trades/import` | Import trades from CSV | Yes |
| `GET` | `/trades/tags` | List trade tags | Yes |
| `POST` | `/trades/tags` | Create a tag | Yes |

## Playbooks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/playbooks` | List playbooks | Yes |
| `POST` | `/playbooks` | Create a playbook | Yes |
| `GET` | `/playbooks/:id` | Get playbook + performance | Yes |
| `PATCH` | `/playbooks/:id` | Update playbook | Yes |
| `DELETE` | `/playbooks/:id` | Delete playbook | Yes |

## Analytics

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/analytics/overview` | Performance overview | Yes |
| `GET` | `/analytics/equity-curve` | Equity curve data | Yes |
| `GET` | `/analytics/daily-performance` | Daily P&L breakdown | Yes |

## Broker Connections

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/brokers` | List available brokers | Yes |
| `GET` | `/brokers/connections` | List user connections | Yes |
| `POST` | `/brokers/connections` | Connect a broker | Yes |
| `POST` | `/brokers/connections/:id/sync` | Trigger manual sync | Yes |

## Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/notifications` | List notifications | Yes |
| `POST` | `/notifications/:id/read` | Mark as read | Yes |

## Subscriptions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/subscriptions` | Get current subscription | Yes |
| `POST` | `/subscriptions/checkout` | Create Stripe checkout | Yes |
| `POST` | `/subscriptions/cancel` | Cancel subscription | Yes |
| `GET` | `/subscriptions/invoices` | List invoices | Yes |

## Market Data

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/market-data/symbols` | Search symbols | Yes |
| `GET` | `/market-data/historical` | Get OHLCV candles | Yes |

---

## Pagination

Paginated endpoints accept `page` (default `1`) and `limit` (default `20`, max `100`) query parameters and return:

```json
{
  "data": [...],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

## Filtering

The `/trades` endpoint supports query parameter filters: `instrument`, `direction`, `startDate`, `endDate`.
The `/backtesting/sessions` endpoint supports: `status`.
The `/analytics/overview` endpoint supports: `period` (`7d`, `30d`, `90d`, `1y`, `all`).
