# Trade Journal Guide

Your trade journal is the central place to log, review, and learn from every trade.

---

## Why Keep a Trade Journal?

- **Track performance** over time with objective metrics
- **Identify patterns** in your winning and losing trades
- **Build discipline** by reviewing each trade's execution
- **Improve strategy** by tagging setups and analyzing results

---

## Logging Trades

### Manual Entry
1. Navigate to **Trade Journal** → **+ New Trade**
2. Fill in the trade details:
   - **Instrument** and **asset class**
   - **Direction** — Long or Short
   - **Entry/exit prices** and **dates**
   - **Quantity**, **fees**, and **commission**
   - **Stop loss** and **take profit**
3. Add **notes** — Why did you take this trade? What was the setup?
4. Add **tags** — Categorize by setup, timeframe, mistake type, etc.
5. Attach **screenshots** of your chart at entry/exit
6. Click **Save**

### Automatic P&L Calculation
When you provide both entry and exit prices, the platform automatically calculates:
- **Gross P&L** — Raw profit/loss from price movement
- **Net P&L** — After fees and commissions
- **P&L %** — Percentage return on the position
- **Trade Duration** — Time from entry to exit in minutes
- **Risk/Reward Ratio** — Based on stop loss and take profit levels

---

## Importing Trades

### Supported Formats
- Interactive Brokers CSV
- TD Ameritrade CSV
- Alpaca CSV
- Generic CSV (customizable column mapping)

### Import Process
1. Click **"Import"**
2. Select your **broker format** from the dropdown
3. **Upload** your CSV file
4. **Preview** the parsed trades
5. **Confirm** the import

The system reports how many trades were imported, skipped (duplicates), and any errors.

---

## Tags & Categories

Organize trades with a flexible tagging system:

| Category | Example Tags |
|----------|-------------|
| **Setup** | breakout, pullback, reversal, gap-fill |
| **Timeframe** | scalp, day-trade, swing, position |
| **Mistake** | fomo, early-exit, no-stop-loss, oversize |
| **Custom** | earnings-play, sector-rotation |

### Creating Tags
1. Go to **Trade Journal** → **Tags**
2. Click **"+ New Tag"**
3. Choose a name, category, and color
4. Tags appear in the tag picker when editing trades

---

## Screenshots

Attach chart screenshots to any trade for visual review:
- Upload images directly from your device
- Images are stored securely in cloud storage (S3)
- View screenshots alongside trade details during review

---

## Filtering & Search

Filter your journal by:
- **Date range** — Start and end dates
- **Instrument** — Specific ticker
- **Direction** — Long or short only
- **Tags** — One or more tags
- **P&L** — Winners only, losers only, or all

---

## Best Practices

1. **Log every trade** — even the ugly ones
2. **Write notes immediately** — your memory of the setup fades
3. **Tag consistently** — use the same tags across trades
4. **Review weekly** — schedule time to review your journal
5. **Screenshot your charts** — a picture is worth a thousand words
