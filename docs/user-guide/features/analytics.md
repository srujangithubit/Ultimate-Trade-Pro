# Analytics Guide

Understand your trading performance with powerful analytics and visualizations.

---

## Performance Overview

The analytics dashboard shows key metrics at a glance:

| Metric | Description |
|--------|-------------|
| **Total Trades** | Number of closed trades in the period |
| **Win Rate** | Percentage of profitable trades |
| **Profit Factor** | Gross profits ÷ gross losses (> 1.0 is profitable) |
| **Total P&L** | Net profit/loss after fees |
| **Average Win** | Mean P&L of winning trades |
| **Average Loss** | Mean P&L of losing trades |
| **Largest Win** | Best single trade |
| **Largest Loss** | Worst single trade |
| **Max Drawdown** | Largest peak-to-trough decline (%) |
| **Sharpe Ratio** | Risk-adjusted return measure |
| **Current Streak** | Consecutive wins (+) or losses (−) |

---

## Equity Curve

The equity curve plots your account balance over time. Look for:
- **Steady upward slope** — consistent profitability
- **Flat periods** — no growth, may indicate uncertainty
- **Sharp drops** — drawdown events; investigate the cause
- **Recovery speed** — how quickly you bounce back from losses

---

## Daily Performance

A calendar heat map showing daily P&L. Color-coded:
- 🟢 Green — profitable day
- 🔴 Red — losing day
- ⚪ Gray — no trades

Use this to spot:
- Day-of-week patterns (e.g., losing Mondays)
- Time-of-month cycles
- Seasonal trends

---

## Performance by Setup

If you use playbooks or tag trades by setup type, analytics breaks down performance by each:

| Setup | Trades | Win Rate | Avg P&L | Profit Factor |
|-------|--------|----------|---------|---------------|
| Breakout | 28 | 71% | $142 | 2.8 |
| Pullback | 15 | 53% | $85 | 1.4 |
| Reversal | 9 | 44% | -$23 | 0.8 |

This helps you **double down on winning setups** and **eliminate losing ones**.

---

## Period Filters

Switch between time periods to analyze different windows:

| Filter | View |
|--------|------|
| **7d** | Last 7 days |
| **30d** | Last 30 days |
| **90d** | Last quarter |
| **1y** | Last year |
| **All** | Entire history |

---

## Understanding Key Metrics

### Win Rate
`(Winning Trades / Total Trades) × 100`

A win rate above 50% is good, but a lower win rate can still be profitable if your average win is much larger than your average loss.

### Profit Factor
`Gross Profits / Gross Losses`

- **> 2.0** — Excellent
- **1.5 – 2.0** — Good
- **1.0 – 1.5** — Marginal
- **< 1.0** — Losing money

### Max Drawdown
The largest percentage decline from a peak in your equity curve. Lower is better. Professional traders typically target < 10% max drawdown.

### Sharpe Ratio
`(Average Return − Risk-Free Rate) / Standard Deviation of Returns`

- **> 2.0** — Very good
- **1.0 – 2.0** — Good
- **< 1.0** — Below average

---

## Tips

1. **Focus on process, not outcomes** — A good win rate alone doesn't mean you're trading well
2. **Track profit factor** — It accounts for both win rate AND risk/reward
3. **Monitor drawdown** — Surviving drawdowns is more important than maximizing returns
4. **Compare by playbook** — See which strategies actually make you money
5. **Review monthly** — Look for trends over longer periods
