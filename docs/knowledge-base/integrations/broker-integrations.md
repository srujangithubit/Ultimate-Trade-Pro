# Interactive Brokers Integration

## Connection Type
API Key (requires IB Gateway or TWS running)

## Setup
1. Enable API access in IB Gateway/TWS settings
2. Generate API key in IB Account Management
3. Connect in Settings → Broker Connections

## Supported Data
Trade history, open positions, account balances, real-time quotes (Pro+)

## Common Issues
- Ensure IB Gateway/TWS is running
- Verify API is enabled in Global Configuration
- Check that socket port matches (7496 live / 7497 paper)

See the full [Interactive Brokers Guide](/docs/user-guide/broker-guides/interactive-brokers.md) for detailed setup steps.

---

# TD Ameritrade Integration

## Connection Type
OAuth 2.0 (authorize through TD Ameritrade website)

## Setup
1. Register a developer app at developer.tdameritrade.com
2. Click "Authorize with TD Ameritrade" in our platform
3. Log in and grant access

## Supported Data
Trade history, open positions, account balances, real-time quotes (Pro+)

## Common Issues
- Ensure callback URL matches exactly
- Tokens auto-refresh; if issues persist, reconnect
- API returns trades from the last 60 days by default

See the full [TD Ameritrade Guide](/docs/user-guide/broker-guides/td-ameritrade.md).

---

# Alpaca Integration

## Connection Type
API Key (Key ID + Secret Key)

## Setup
1. Generate API key in Alpaca dashboard
2. Enter Key ID and Secret in our platform
3. Select environment (Paper or Live)

## Supported Data
Trade history, open positions, account balances, real-time quotes

## Common Issues
- Keys are environment-specific (paper ≠ live)
- Secret key shown only once — save securely
- Rate limit: 200 requests/minute (handled automatically)

See the full [Alpaca Guide](/docs/user-guide/broker-guides/alpaca.md).
