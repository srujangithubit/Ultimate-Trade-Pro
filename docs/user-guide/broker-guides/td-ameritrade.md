# TD Ameritrade Connection Guide

## Prerequisites
- An active TD Ameritrade brokerage account
- A registered TD Ameritrade Developer application

## Step 1: Register a Developer App
1. Go to [TD Ameritrade Developer](https://developer.tdameritrade.com/)
2. Sign in with your TD Ameritrade credentials
3. Click **"My Apps"** → **"Add a New App"**
4. Fill in:
   - **App Name** — "Trading Platform Sync"
   - **Callback URL** — `https://app.tradingplatform.com/callbacks/tdameritrade`
5. Copy the **Consumer Key (API Key)**

## Step 2: Connect in Trading Platform
1. Go to **Settings → Broker Connections**
2. Click **"Connect Broker"**
3. Select **"TD Ameritrade"**
4. Click **"Authorize with TD Ameritrade"**
5. You'll be redirected to TD Ameritrade's login page
6. Log in and grant access
7. You'll be redirected back to the platform

## Step 3: Verify Connection
- Status should show **"Connected"**
- Click **"Sync Now"** to import recent trades
- Check your Trade Journal for imported trades

## Troubleshooting
- **OAuth redirect error** — Ensure the callback URL matches exactly
- **Token expired** — The platform auto-refreshes tokens; if issues persist, reconnect
- **Missing trades** — TD Ameritrade API returns trades from the last 60 days by default

## Supported Data
| Data | Supported |
|------|-----------|
| Trade history | ✅ |
| Open positions | ✅ |
| Account balances | ✅ |
| Real-time quotes | ✅ (Pro+) |
| Order placement | ❌ (read-only) |

> **Note:** TD Ameritrade merged with Charles Schwab. Ensure your account is accessible via the TD Ameritrade API.
