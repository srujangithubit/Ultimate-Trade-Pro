# Playbooks Guide

Build structured, repeatable trading strategies with playbooks.

---

## What Is a Playbook?

A playbook is a documented trading strategy that defines:
- **Entry rules** — When to enter a trade
- **Exit rules** — When to take profit or cut losses
- **Risk parameters** — How much to risk per trade
- **Target instruments** — Which markets the strategy applies to
- **Timeframes** — Which chart timeframes to use

Think of it as your trading plan in a structured, trackable format.

---

## Creating a Playbook

1. Navigate to **Playbooks** → **+ New Playbook**
2. Fill in:

### Basic Info
- **Name** — e.g., "Morning Gap Breakout"
- **Description** — Brief explanation of the strategy

### Entry Rules
Define conditions that must be true before entering:
```
1. Price gaps above previous day's high
2. Volume in first 5 minutes > 1.5x 20-day average
3. Relative strength vs. SPY > 0
4. No major earnings or news within 24 hours
```

### Exit Rules
Define when to close the trade:
```
1. Take profit at 2R target
2. Stop loss at low of gap candle
3. Time stop: close by 11:30 AM if neither TP nor SL hit
4. Trail stop to breakeven after 1R profit
```

### Risk Parameters
| Parameter | Value |
|-----------|-------|
| Max risk per trade | 1% of account |
| Max daily loss | 3% of account |
| Max concurrent positions | 3 |
| Position size method | Fixed fractional |

### Instruments & Timeframes
- Instruments: AAPL, TSLA, NVDA, AMZN, META
- Timeframes: 5-minute, 15-minute

---

## Tracking Performance

Once trades are tagged with a playbook (either via backtesting or journal entries), the platform automatically calculates:

| Metric | Description |
|--------|-------------|
| **Total Trades** | Number of trades using this playbook |
| **Win Rate** | Percentage of winners |
| **Average P&L** | Mean profit/loss per trade |
| **Profit Factor** | Gross profits ÷ gross losses |
| **Max Drawdown** | Largest peak-to-trough loss |

---

## Versioning

As you refine your strategy, the platform tracks versions:
- **Version 1** — Original rules
- **Version 2** — Added time stop rule
- **Version 3** — Adjusted position sizing

Each version records what changed and when, so you can see how modifications improved (or hurt) performance.

---

## Using Playbooks in Backtesting

1. Create a new backtesting session
2. Select a **playbook** from the dropdown
3. Follow the playbook's rules as you place trades
4. After the session, compare your actual execution to the playbook's rules
5. Review the playbook's performance metrics

---

## Tips

1. **Start with one playbook** — Master it before creating others
2. **Be specific** — Vague rules lead to inconsistent execution
3. **Quantify risk** — Use exact percentages, not "small" or "moderate"
4. **Backtest first** — Validate the strategy before using real capital
5. **Review quarterly** — Update or retire playbooks based on performance data
6. **Keep it simple** — 3-5 entry rules are usually enough
