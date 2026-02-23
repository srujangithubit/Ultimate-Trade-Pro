# Interactive Brokers Connection Guide

## Prerequisites
- An active Interactive Brokers account
- IB Gateway or TWS (Trader Workstation) installed
- API access enabled in your IB account settings

## Step 1: Enable API Access in IB
1. Open **TWS** or **IB Gateway**
2. Go to **Edit → Global Configuration → API → Settings**
3. Check **"Enable ActiveX and Socket Clients"**
4. Set the **Socket Port** (default: 7496 for live, 7497 for paper)
5. Add our server IP to the **Trusted IPs** list
6. Click **Apply**

## Step 2: Generate API Credentials
1. Log in to [IB Account Management](https://www.interactivebrokers.com/sso/Login)
2. Go to **Settings → API → API Keys**
3. Click **"Create API Key"**
4. Set permissions to **Read-Only** (recommended for trade sync)
5. Copy the **API Key** and **Secret**

## Step 3: Connect in Trading Platform
1. Go to **Settings → Broker Connections**
2. Click **"Connect Broker"**
3. Select **"Interactive Brokers"**
4. Enter your **API Key** and **Secret**
5. Select **Account Type** (Live or Paper)
6. Click **"Connect"**

## Step 4: Verify Connection
- Status should show **"Connected"**
- Click **"Sync Now"** to import recent trades
- Check **Sync Logs** for any errors

## Troubleshooting
- **Connection refused** — Ensure IB Gateway/TWS is running and API is enabled
- **Invalid credentials** — Regenerate API key in IB Account Management
- **No trades imported** — Check that trades exist in the date range; verify account permissions
- **Rate limit errors** — IB limits API calls; the platform auto-retries

## Supported Data
| Data | Supported |
|------|-----------|
| Trade history | ✅ |
| Open positions | ✅ |
| Account balances | ✅ |
| Real-time quotes | ✅ (Pro+) |
| Order placement | ❌ (read-only) |
