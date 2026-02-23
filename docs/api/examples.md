# API Request & Response Examples

Practical examples for common API operations.

---

## Authentication

### Signup
```bash
curl -X POST https://api.tradingplatform.com/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecureP@ss1",
    "displayName": "Jane Trader"
  }'
```
```json
// 201 Created
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

### Signin
```bash
curl -X POST https://api.tradingplatform.com/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{ "email": "trader@example.com", "password": "SecureP@ss1" }'
```
```json
// 200 OK
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

---

## Backtesting

### Create a Session
```bash
curl -X POST https://api.tradingplatform.com/v1/backtesting/sessions \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionName": "AAPL Breakout Strategy",
    "instrument": "AAPL",
    "assetClass": "stock",
    "startingBalance": 10000.00,
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```
```json
// 201 Created
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sessionName": "AAPL Breakout Strategy",
  "instrument": "AAPL",
  "assetClass": "stock",
  "startingBalance": 10000.00,
  "currentBalance": 10000.00,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "playbackSpeed": 1,
  "status": "active",
  "createdAt": "2024-06-15T10:30:00Z"
}
```

### Place a Trade in a Session
```bash
curl -X POST https://api.tradingplatform.com/v1/backtesting/sessions/<sessionId>/trades \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "long",
    "entryPrice": 185.50,
    "quantity": 50,
    "stopLoss": 183.00,
    "takeProfit": 192.00,
    "entryDatetime": "2024-03-15T14:30:00Z"
  }'
```
```json
// 201 Created
{
  "id": "f1e2d3c4-b5a6-7890-fedc-ba0987654321",
  "direction": "long",
  "entryPrice": 185.50,
  "quantity": 50,
  "stopLoss": 183.00,
  "takeProfit": 192.00,
  "pnlNet": null,
  "entryDatetime": "2024-03-15T14:30:00Z",
  "exitDatetime": null
}
```

---

## Trade Journal

### Log a Trade
```bash
curl -X POST https://api.tradingplatform.com/v1/trades \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "instrument": "TSLA",
    "assetClass": "stock",
    "direction": "short",
    "entryPrice": 245.00,
    "exitPrice": 230.00,
    "quantity": 20,
    "entryDatetime": "2024-05-01T09:31:00Z",
    "exitDatetime": "2024-05-01T15:55:00Z",
    "notes": "Bearish engulfing at resistance",
    "tags": ["swing-trade", "bearish-pattern"]
  }'
```
```json
// 201 Created
{
  "id": "d4c3b2a1-0987-6543-dcba-fedcba098765",
  "instrument": "TSLA",
  "direction": "short",
  "entryPrice": 245.00,
  "exitPrice": 230.00,
  "quantity": 20,
  "pnlGross": 300.00,
  "pnlNet": 300.00,
  "pnlPercentage": 6.12,
  "tradeDurationMinutes": 384,
  "notes": "Bearish engulfing at resistance",
  "tags": ["swing-trade", "bearish-pattern"]
}
```

### Import Trades from CSV
```bash
curl -X POST https://api.tradingplatform.com/v1/trades/import \
  -H "Authorization: Bearer <token>" \
  -F "file=@trades.csv" \
  -F "broker=interactive-brokers"
```
```json
// 200 OK
{
  "imported": 47,
  "skipped": 3,
  "errors": [
    "Row 12: Invalid date format",
    "Row 25: Missing entry price",
    "Row 38: Duplicate trade"
  ]
}
```

---

## Analytics

### Get Performance Overview
```bash
curl https://api.tradingplatform.com/v1/analytics/overview?period=30d \
  -H "Authorization: Bearer <token>"
```
```json
// 200 OK
{
  "totalTrades": 42,
  "winRate": 64.29,
  "profitFactor": 2.15,
  "totalPnl": 3450.00,
  "avgWin": 185.50,
  "avgLoss": -92.30,
  "largestWin": 650.00,
  "largestLoss": -280.00,
  "maxDrawdown": -4.2,
  "sharpeRatio": 1.85,
  "currentStreak": 3
}
```

---

## Playbooks

### Create a Playbook
```bash
curl -X POST https://api.tradingplatform.com/v1/playbooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Morning Breakout",
    "description": "Gap up breakout with volume confirmation",
    "entryRules": [
      { "rule": "Price gaps above previous day high" },
      { "rule": "Volume > 1.5x average in first 5 min" }
    ],
    "exitRules": [
      { "rule": "Take profit at 2R target" },
      { "rule": "Stop loss below gap candle low" }
    ],
    "riskParameters": {
      "maxRiskPerTrade": 1.0,
      "maxDailyLoss": 3.0
    },
    "instruments": ["AAPL", "TSLA", "NVDA"],
    "timeframes": ["5m", "15m"]
  }'
```

---

## Broker Connection

### Connect a Broker
```bash
curl -X POST https://api.tradingplatform.com/v1/brokers/connections \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "brokerId": "b1234567-89ab-cdef-0123-456789abcdef",
    "credentials": {
      "apiKey": "your-api-key",
      "apiSecret": "your-api-secret"
    }
  }'
```

### Trigger Manual Sync
```bash
curl -X POST https://api.tradingplatform.com/v1/brokers/connections/<connectionId>/sync \
  -H "Authorization: Bearer <token>"
```
```json
// 202 Accepted
{
  "syncId": "s1234567-sync-uuid",
  "status": "running",
  "startedAt": "2024-06-15T10:30:00Z"
}
```
