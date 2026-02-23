# Getting Started with Trading Platform

Welcome to the Trading Platform — your all-in-one solution for backtesting strategies, journaling trades, and analyzing performance.

---

## 1. Create Your Account

1. Go to [https://app.tradingplatform.com](https://app.tradingplatform.com)
2. Click **"Sign Up"**
3. Enter your email and create a password (minimum 6 characters)
4. Optionally add a display name
5. Check your inbox and click the **verification link**
6. You're in!

---

## 2. Explore the Dashboard

After signing in, you'll land on the **Dashboard**. Here's what you'll see:

| Section | What It Shows |
|---------|---------------|
| **Performance Summary** | Win rate, total P&L, profit factor at a glance |
| **Recent Trades** | Your latest journal entries |
| **Equity Curve** | Visual chart of your account growth |
| **Active Sessions** | Any backtesting sessions in progress |
| **Quick Actions** | Buttons for New Backtest, Log Trade, Import CSV |

---

## 3. Your First Backtesting Session

1. Click **"Backtesting"** in the sidebar
2. Click **"+ New Session"**
3. Fill in the details:
   - **Session name:** "My First Backtest"
   - **Instrument:** AAPL
   - **Asset class:** Stock
   - **Start date:** 2024-01-01
   - **End date:** 2024-12-31
   - **Starting balance:** $10,000
4. Click **"Create Session"**

### Running the Backtest
1. The chart loads with historical AAPL data starting Jan 1, 2024
2. Click the **▶ Play** button to start candle-by-candle playback
3. Use the **speed slider** to control playback speed (1x → 10x)
4. When you spot a trade setup:
   - Click **"Buy"** or **"Sell"**
   - Set your **entry price**, **quantity**, **stop loss**, and **take profit**
   - Confirm the trade
5. Watch your **P&L** and **balance** update in real-time
6. Click **⏸ Pause** anytime to analyze the chart

---

## 4. Log a Trade in Your Journal

Even without backtesting, you can manually log trades:

1. Click **"Trade Journal"** in the sidebar
2. Click **"+ New Trade"**
3. Fill in:
   - Instrument, direction (long/short), entry & exit prices
   - Quantity, fees, stop loss, take profit
   - Add notes and tags for later analysis
4. Click **"Save Trade"**

### Importing Trades from CSV
1. Click **"Import"** in the Trade Journal
2. Select your broker from the dropdown
3. Upload your CSV file
4. Review the preview table
5. Click **"Import"** — done!

---

## 5. Analyze Your Performance

Navigate to **"Analytics"** to see:

- **Win Rate** — percentage of profitable trades
- **Profit Factor** — ratio of gross profits to gross losses
- **Equity Curve** — growth chart over time
- **Daily P&L** — heat map of daily performance
- **Performance by Setup** — which strategies work best
- **Drawdown Analysis** — maximum peak-to-trough decline

Use the **period filter** (7d, 30d, 90d, 1y, All) to adjust the time range.

---

## 6. Build a Playbook

A playbook defines your trading strategy in a structured, repeatable format.

1. Click **"Playbooks"** in the sidebar
2. Click **"+ New Playbook"**
3. Define:
   - **Name** and **description**
   - **Entry rules** — conditions that must be met before entering
   - **Exit rules** — when to take profit or cut losses
   - **Risk parameters** — max risk per trade, max daily loss
   - **Instruments** and **timeframes** this strategy applies to
4. Click **"Save Playbook"**
5. Assign the playbook to backtesting sessions to track its performance

---

## 7. Connect Your Broker

Automatically sync live trades from your broker:

1. Go to **Settings → Broker Connections**
2. Click **"Connect Broker"**
3. Select your broker (Interactive Brokers, Alpaca, TD Ameritrade, etc.)
4. Enter your API credentials
5. Click **"Connect"**
6. Trades will sync automatically every 5 minutes

---

## Next Steps

- 📖 Read the [Feature Tutorials](./features/) for in-depth guides
- ❓ Check the [FAQ](./faq.md) for common questions
- 🔧 See [Troubleshooting](./troubleshooting.md) if you hit any issues
- 💡 Review [Best Practices](./best-practices.md) to improve your trading
