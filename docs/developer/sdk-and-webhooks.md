# API Client SDK Guide

## JavaScript / TypeScript SDK

### Installation
```bash
npm install @tradingplatform/sdk
```

### Initialization
```typescript
import { TradingPlatformClient } from '@tradingplatform/sdk';

const client = new TradingPlatformClient({
  baseUrl: 'https://api.tradingplatform.com/v1',
  apiKey: 'your-api-key', // or use token-based auth
});
```

### Authentication
```typescript
// Sign in and store token
const { access_token } = await client.auth.signin({
  email: 'trader@example.com',
  password: 'SecureP@ss1',
});
client.setToken(access_token);
```

### Backtesting
```typescript
// Create session
const session = await client.backtesting.createSession({
  sessionName: 'AAPL Test',
  instrument: 'AAPL',
  assetClass: 'stock',
  startingBalance: 10000,
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});

// Place trade
await client.backtesting.createTrade(session.id, {
  direction: 'long',
  entryPrice: 185.50,
  quantity: 50,
  stopLoss: 183.00,
  takeProfit: 192.00,
  entryDatetime: '2024-03-15T14:30:00Z',
});

// List sessions
const sessions = await client.backtesting.listSessions({ page: 1, limit: 20 });
```

### Trades
```typescript
// Log trade
await client.trades.create({
  instrument: 'TSLA',
  assetClass: 'stock',
  direction: 'short',
  entryPrice: 245.00,
  exitPrice: 230.00,
  quantity: 20,
  entryDatetime: '2024-05-01T09:31:00Z',
  exitDatetime: '2024-05-01T15:55:00Z',
});

// List with filters
const trades = await client.trades.list({
  instrument: 'TSLA',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
```

### Analytics
```typescript
const overview = await client.analytics.getOverview({ period: '30d' });
console.log(`Win Rate: ${overview.winRate}%`);
console.log(`Profit Factor: ${overview.profitFactor}`);
```

---

## Python SDK

### Installation
```bash
pip install tradingplatform-sdk
```

### Usage
```python
from tradingplatform import TradingPlatformClient

client = TradingPlatformClient(
    base_url="https://api.tradingplatform.com/v1"
)

# Authenticate
token = client.auth.signin(email="trader@example.com", password="SecureP@ss1")
client.set_token(token["access_token"])

# Create backtest session
session = client.backtesting.create_session(
    session_name="AAPL Test",
    instrument="AAPL",
    asset_class="stock",
    starting_balance=10000,
    start_date="2024-01-01",
    end_date="2024-12-31",
)

# Get analytics
overview = client.analytics.get_overview(period="30d")
print(f"Win Rate: {overview['winRate']}%")
print(f"Total P&L: ${overview['totalPnl']}")
```

---

# Webhook Documentation

## Overview
Webhooks deliver real-time event notifications to your server via HTTP POST requests.

## Configuring Webhooks
1. Go to **Settings → Developer → Webhooks**
2. Click **"Add Endpoint"**
3. Enter your HTTPS URL
4. Select events to subscribe to
5. Copy the **signing secret** for verification

## Available Events

| Event | Trigger |
|-------|---------|
| `trade.created` | New trade logged |
| `trade.updated` | Trade modified |
| `trade.closed` | Trade exit recorded |
| `session.created` | New backtest session |
| `session.completed` | Session reached end date |
| `broker.sync.completed` | Broker sync finished |
| `broker.sync.failed` | Broker sync errored |
| `subscription.created` | New subscription |
| `subscription.canceled` | Subscription canceled |
| `subscription.payment.failed` | Payment failed |

## Payload Format
```json
{
  "id": "evt_abc123",
  "type": "trade.created",
  "timestamp": "2024-06-15T10:30:00Z",
  "data": {
    "tradeId": "uuid",
    "instrument": "AAPL",
    "direction": "long",
    "entryPrice": 185.50,
    "quantity": 50
  }
}
```

## Signature Verification
Every webhook includes an `X-Webhook-Signature` header. Verify it using HMAC-SHA256:

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

## Retry Policy
Failed deliveries (non-2xx response) are retried up to 5 times with exponential back-off: 1 min, 5 min, 30 min, 2 hours, 24 hours.
