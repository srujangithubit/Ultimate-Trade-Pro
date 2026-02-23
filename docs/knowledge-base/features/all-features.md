# Backtesting

The backtesting module lets you test trading strategies on historical price data without risking real money.

## Key Features
- **Candle-by-candle playback** at adjustable speeds (1x–10x)
- **Place trades** (long/short) with stop loss and take profit
- **Track positions** in real-time with auto-calculated P&L
- **Session snapshots** to save checkpoints
- **Playbook integration** to track strategy performance

## Session Statuses
| Status | Meaning |
|--------|---------|
| Active | Session in progress |
| Paused | Temporarily stopped |
| Completed | Reached end date |
| Archived | Stored for reference |

## Supported Asset Classes
Stocks, Forex, Crypto, Futures, Options, Indexes

## Limits by Plan
| Plan | Sessions | Max Date Range |
|------|----------|---------------|
| Free | 5 active | 6 months |
| Pro | Unlimited | 5 years |
| Team | Unlimited | 20 years |
| Enterprise | Unlimited | Full history |

---

# Trade Journal

Log, review, and analyze every trade you take.

## Key Features
- **Manual trade entry** with full details
- **CSV import** from major brokers
- **Automatic broker sync** for live trades
- **Tags and categories** for organization
- **Screenshots** attached to trades
- **Auto-calculated P&L**, duration, and risk/reward

## Auto-Calculated Fields
When you provide entry and exit prices, the platform calculates:
- Gross P&L, Net P&L (after fees/commissions)
- P&L percentage, Trade duration
- Risk/reward ratio (if stop loss and take profit are set)

---

# Analytics

Transform raw trade data into actionable performance insights.

## Available Metrics
- Win rate, Profit factor, Total P&L
- Average win/loss, Largest win/loss
- Max drawdown, Sharpe ratio
- Current win/loss streak

## Views
- **Equity curve** — Account growth over time
- **Daily P&L heatmap** — Calendar view of daily performance
- **Performance by setup** — Breakdown by playbook/strategy
- **Drawdown chart** — Peak-to-trough analysis

## Period Filters
7 days, 30 days, 90 days, 1 year, All time

---

# Playbooks

Document trading strategies in a structured, trackable format.

## What's in a Playbook?
- **Entry rules** — Conditions to enter trades
- **Exit rules** — Take profit, stop loss, time stops
- **Risk parameters** — Max risk per trade, daily loss limits
- **Instruments** — Target markets
- **Timeframes** — Chart timeframes

## Performance Tracking
Trades tagged with a playbook automatically contribute to its performance metrics: win rate, avg P&L, profit factor, max drawdown.

## Versioning
Edit a playbook to create a new version. Compare version performance to see if changes improved results.
