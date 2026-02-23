# Importing Trades

## Supported Import Formats

| Format | Source |
|--------|--------|
| Interactive Brokers CSV | IB Flex Query export |
| TD Ameritrade CSV | History & Statements export |
| Alpaca CSV | Activity export |
| Generic CSV | Custom format with required columns |

## How to Import

1. Go to **Trade Journal** → click **"Import"**
2. Select your **broker format** from the dropdown
3. **Upload** your CSV file (max 10 MB)
4. **Preview** the parsed trades
5. Click **"Import"**

## Generic CSV Format

If your broker isn't listed, use the Generic CSV format with these columns:

| Column | Required | Format |
|--------|----------|--------|
| `date` | ✅ | `YYYY-MM-DD` or `MM/DD/YYYY` |
| `instrument` | ✅ | Ticker symbol (e.g., AAPL) |
| `direction` | ✅ | `long` or `short` |
| `entry_price` | ✅ | Decimal number |
| `exit_price` | Optional | Decimal number |
| `quantity` | ✅ | Decimal number |
| `fees` | Optional | Decimal number |
| `stop_loss` | Optional | Decimal number |
| `take_profit` | Optional | Decimal number |
| `notes` | Optional | Free text |

Download the [CSV template](https://app.tradingplatform.com/templates/generic-trades.csv) for the exact format.

## Troubleshooting Imports

- **"Invalid date format"** — Use `YYYY-MM-DD` or `MM/DD/YYYY`
- **"Missing required field"** — Ensure date, instrument, direction, entry_price, and quantity are present
- **"Duplicate trade"** — Trade already exists in your journal (skipped automatically)
- **File encoding** — Save as UTF-8
