# Backtesting Guide

Master the backtesting engine to test your strategies against historical data.

---

## Overview

Backtesting lets you simulate trades on historical price data without risking real money. You control the timeline, place trades at any point, and see exactly how your strategy would have performed.

---

## Creating a Session

### Required Parameters

| Field | Description | Example |
|-------|-------------|---------|
| **Session Name** | Descriptive name for the backtest | "AAPL Breakout Q1 2024" |
| **Instrument** | Ticker symbol | AAPL, TSLA, EUR/USD |
| **Asset Class** | Type of instrument | Stock, Forex, Crypto, Futures, Options, Index |
| **Starting Balance** | Virtual account balance | $10,000 |
| **Start Date** | When the backtest begins | 2024-01-01 |
| **End Date** | When the backtest ends | 2024-12-31 |

### Optional Parameters
- **Playbook** — Associate a trading playbook to track strategy performance
- **Playback Speed** — Default 1x; adjustable from 1x to 10x

---

## Using the Playback Controls

| Control | Action |
|---------|--------|
| **▶ Play** | Start advancing through candles |
| **⏸ Pause** | Freeze to analyze the chart |
| **⏩ Speed** | Adjust playback speed (1x – 10x) |
| **⏭ Skip** | Jump to next day/session |
| **📸 Snapshot** | Save a point-in-time snapshot |

---

## Placing Trades

1. **Pause** the playback at your desired entry point
2. Click **"Buy"** (long) or **"Sell"** (short)
3. Configure:
   - **Quantity** — Number of shares/contracts/units
   - **Stop Loss** — Automatic exit price for risk management
   - **Take Profit** — Automatic exit price for profit target
4. **Confirm** the trade
5. The trade appears in the **Positions** panel

### Managing Open Positions
- **Modify** — Adjust stop loss or take profit on open positions
- **Close** — Manually exit a position at current price
- **Partial Close** — Close a portion of the position

---

## Session Management

| Status | Description |
|--------|-------------|
| **Active** | Currently in progress |
| **Paused** | Temporarily stopped |
| **Completed** | Reached end date |
| **Archived** | Stored for reference |

---

## Snapshots

Snapshots capture the state of your session at a specific point including account balance, open positions, and trade count. Use them to:
- Mark key decision points
- Compare performance at different stages
- Create review checkpoints

---

## Tips for Effective Backtesting

1. **Don't peek ahead** — Use the playback controls to simulate real-time decision making
2. **Set your rules first** — Create a playbook before starting
3. **Track every trade** — Let the platform calculate your P&L automatically
4. **Use realistic position sizes** — Don't overleverage your virtual account
5. **Test multiple instruments** — Validate your strategy across different markets
6. **Review completed sessions** — Analyze what worked and what didn't in Analytics
