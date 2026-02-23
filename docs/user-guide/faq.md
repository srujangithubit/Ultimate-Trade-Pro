# Frequently Asked Questions

## Account & Billing

**Q: Is there a free plan?**
Yes! The Free tier includes up to 5 backtesting sessions, 50 journal trades per month, and basic analytics. Upgrade to Pro for unlimited access.

**Q: How do I upgrade my subscription?**
Go to **Settings → Billing → Upgrade Plan**, select your tier, and complete checkout via Stripe.

**Q: Can I cancel my subscription?**
Yes. Go to **Settings → Billing → Cancel**. Your access continues until the end of the current billing period. No refunds for partial periods.

**Q: What payment methods are accepted?**
Visa, Mastercard, American Express, and regional cards supported by Stripe.

---

## Backtesting

**Q: What instruments can I backtest?**
Stocks, Forex, Crypto, Futures, Options, and Indexes. Data availability varies by instrument and timeframe.

**Q: How far back does historical data go?**
Up to 20 years for major stocks and indices, 5 years for crypto, and 10 years for forex. Depends on the data provider.

**Q: Can I backtest multiple instruments in one session?**
Currently, each session is for a single instrument. Create separate sessions for different instruments and compare them in Analytics.

**Q: Does the platform account for slippage and commissions?**
Yes. Fees and commissions are tracked per trade and deducted from your P&L calculation.

---

## Trade Journal

**Q: Can I import trades from my broker?**
Yes! We support CSV imports from Interactive Brokers, TD Ameritrade, Alpaca, and a generic CSV format.

**Q: How many tags can I create?**
Up to 50 tags per account. Use categories (setup, mistake, timeframe, custom) to stay organized.

**Q: Can I attach screenshots to trades?**
Yes. Upload images directly when creating or editing a trade. They're stored securely in the cloud.

---

## Broker Connections

**Q: Which brokers are supported?**
Interactive Brokers, Alpaca, and TD Ameritrade. More brokers are added regularly.

**Q: Is my broker data secure?**
Yes. Credentials are encrypted at rest using AES-256. We never store plain-text passwords. API keys use read-only access where possible.

**Q: How often do trades sync?**
Every 5 minutes by default. You can trigger a manual sync anytime or adjust the interval in broker settings.

---

## Analytics

**Q: How is win rate calculated?**
`(Number of profitable trades / Total closed trades) × 100`. Only closed trades with an exit price are included.

**Q: What does profit factor mean?**
`Gross Profits / Gross Losses`. A value above 1.0 means you're profitable overall. Above 2.0 is considered excellent.

**Q: Can I export my analytics data?**
Yes. Use the **Export** button on the Analytics page to download a CSV of your performance data.

---

## Technical

**Q: What browsers are supported?**
Chrome, Firefox, Safari, and Edge (latest 2 versions). Mobile browsers are supported with responsive layout.

**Q: Is there a mobile app?**
Not yet, but the web app is fully responsive and works well on mobile browsers.

**Q: Is my data backed up?**
Yes. We run daily automated backups with 30-day retention. Data is stored redundantly across multiple availability zones.
