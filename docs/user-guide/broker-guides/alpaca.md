# Alpaca Connection Guide

## Prerequisites
- An Alpaca brokerage or paper trading account
- API keys generated from the Alpaca dashboard

## Step 1: Generate API Keys
1. Log in to [Alpaca Dashboard](https://app.alpaca.markets)
2. Go to the **Paper Trading** or **Live Trading** section
3. Click **"Generate New Key"**
4. Copy the **API Key ID** and **Secret Key**
   > ⚠️ The secret key is only shown once — save it securely

## Step 2: Connect in Trading Platform
1. Go to **Settings → Broker Connections**
2. Click **"Connect Broker"**
3. Select **"Alpaca"**
4. Enter your **API Key ID** and **Secret Key**
5. Select **Environment** (Paper or Live)
6. Click **"Connect"**

## Step 3: Verify Connection
- Status should show **"Connected"**
- Click **"Sync Now"** to import trades
- Verify trades appear in your Trade Journal

## Troubleshooting
- **401 Unauthorized** — Re-check API key and secret; keys are environment-specific (paper ≠ live)
- **No trades found** — Ensure you have executed trades in the selected environment
- **Rate limited** — Alpaca allows 200 requests/minute; the platform handles retries automatically

## Supported Data
| Data | Supported |
|------|-----------|
| Trade history | ✅ |
| Open positions | ✅ |
| Account balances | ✅ |
| Real-time quotes | ✅ |
| Order placement | ❌ (read-only) |
