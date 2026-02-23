# Video Script 1: Platform Overview

**Duration:** ~5 minutes
**Goal:** Introduce the platform's core features and navigation

---

## INTRO (0:00 – 0:30)

**NARRATION:**
> "Welcome to the Trading Platform — your all-in-one solution for backtesting strategies, journaling trades, and analyzing performance. In this quick overview, I'll walk you through everything the platform offers so you can hit the ground running."

**SCREEN:** Show animated logo intro, then landing page.

---

## DASHBOARD TOUR (0:30 – 1:30)

**NARRATION:**
> "After signing in, you land on the Dashboard. At the top, you'll see your key performance metrics — win rate, total P&L, and profit factor. Below that is your equity curve showing account growth over time. On the left sidebar, you have quick access to Backtesting, Trade Journal, Analytics, Playbooks, and Settings."

**SCREEN:** Pan across dashboard sections, highlight each metric with cursor. Click through sidebar items briefly.

---

## BACKTESTING OVERVIEW (1:30 – 2:30)

**NARRATION:**
> "The Backtesting module lets you simulate trades on historical data. Create a session, pick a stock, set your date range and starting balance, then step through candles one by one — or use the playback controls to fast-forward. Place trades as if you were there in real time."

**SCREEN:** Click Backtesting → New Session → show filled form → Create → show chart with playback controls. Place a quick demo trade.

---

## TRADE JOURNAL OVERVIEW (2:30 – 3:15)

**NARRATION:**
> "The Trade Journal is where every trade lives. Log trades manually, import from CSV, or let them sync automatically from your broker. Each trade can have notes, tags, and chart screenshots for later review."

**SCREEN:** Click Trade Journal → show trade list → click into a trade → show notes, tags, screenshots.

---

## ANALYTICS OVERVIEW (3:15 – 4:00)

**NARRATION:**
> "Analytics turns your raw trades into actionable insights. See your win rate, profit factor, drawdown, and Sharpe ratio. The equity curve chart shows your account growth, and you can break down performance by setup, instrument, or time period."

**SCREEN:** Click Analytics → scroll through overview metrics → show equity curve → show daily P&L heatmap.

---

## PLAYBOOKS & BROKER (4:00 – 4:45)

**NARRATION:**
> "Playbooks let you document your trading strategies with structured entry rules, exit rules, and risk parameters. Track performance per playbook to see which strategies actually work. And with broker integrations, your live trades sync automatically — no manual entry needed."

**SCREEN:** Click Playbooks → show a playbook card → click into it. Then Settings → Broker Connections → show connected broker.

---

## OUTRO (4:45 – 5:00)

**NARRATION:**
> "That's the Trading Platform in a nutshell. In the next video, we'll create your first backtesting session step by step. Hit subscribe and let's get started!"

**SCREEN:** Show end card with next video thumbnail and subscribe button.

---

# Video Script 2: Creating Your First Backtest

**Duration:** ~10 minutes
**Goal:** Step-by-step walkthrough of creating and running a full backtesting session

---

## INTRO (0:00 – 0:30)

**NARRATION:**
> "In this tutorial, you'll create your first backtesting session from scratch. We'll pick a stock, set up the session, place trades using the chart playback, and review the results. Let's jump in."

**SCREEN:** Show Backtesting page.

---

## CREATING THE SESSION (0:30 – 2:30)

**NARRATION:**
> "Click 'New Session'. For the session name, let's call this 'AAPL Breakout Test'. Select AAPL as the instrument, asset class is Stock. Set the start date to January 1st 2024, end date December 31st 2024. Starting balance — let's go with $10,000. For the playbook, we'll skip that for now. Click 'Create Session'."

**SCREEN:** Fill in each field as narrated. Pause briefly on each field. Click Create.

---

## UNDERSTANDING THE CHART (2:30 – 4:00)

**NARRATION:**
> "The chart loads with AAPL's historical data starting from January 2024. You'll see candlestick bars, volume below, and the toolbar at the top. On the right, notice your account balance, open positions (empty for now), and the trade history panel. At the bottom are the playback controls — play, pause, speed slider, and skip."

**SCREEN:** Annotate each area — chart, balance panel, positions, trade history, playback bar.

---

## PLAYING BACK DATA (4:00 – 5:30)

**NARRATION:**
> "Hit the play button. Candles start appearing one by one, simulating real-time price action. You can adjust the speed — let's crank it up to 5x to move faster. When you spot a setup you like, hit pause."

**SCREEN:** Click Play → show candles advancing → adjust speed slider → Pause at an interesting pattern.

---

## PLACING YOUR FIRST TRADE (5:30 – 7:00)

**NARRATION:**
> "I see a breakout setup here. Click 'Buy' to go long. Set quantity to 50 shares. Stop loss at $183 — that's below the recent support. Take profit at $192 — about a 2:1 reward-to-risk ratio. Click 'Confirm'. The trade appears in your Positions panel with entry price and current P&L."

**SCREEN:** Click Buy → fill in quantity, stop loss, take profit → Confirm → show position in panel.

---

## MANAGING THE TRADE (7:00 – 8:30)

**NARRATION:**
> "Resume playback and watch your position. The P&L updates in real-time as the price moves. You can modify your stop loss or take profit at any time by clicking the position. When the price hits your take profit — there it is! The trade closes automatically and moves to your trade history."

**SCREEN:** Resume play → show P&L updating → price hits TP → trade closes → show in history.

---

## REVIEWING RESULTS (8:30 – 9:30)

**NARRATION:**
> "Let's review. Click into the completed trade — you can see entry price, exit price, gross and net P&L, duration, and risk/reward ratio. All calculated automatically. You can add notes about why you took this trade and tag it for later analysis."

**SCREEN:** Click trade in history → show details → add a note → add a tag.

---

## OUTRO (9:30 – 10:00)

**NARRATION:**
> "Congratulations — you just completed your first backtest! Place more trades to build a track record, then head to Analytics to see your overall performance. Next up: importing trades from a CSV file."

**SCREEN:** End card with subscribe and next video.

---

# Video Script 3: Importing Trades from CSV

**Duration:** ~8 minutes
**Goal:** Show how to import trade history from broker CSV exports

---

## INTRO (0:00 – 0:30)

**NARRATION:**
> "If you've been trading with a broker and want to analyze your history on our platform, you can import your trades from a CSV file. I'll show you how in just a few minutes."

---

## EXPORTING FROM YOUR BROKER (0:30 – 2:30)

**NARRATION:**
> "First, export your trade history from your broker. I'll show Interactive Brokers as an example. Log in to Account Management, go to Reports → Flex Queries, create a new query that includes trades, and download as CSV. For Alpaca, go to your dashboard, click Activity, and export. For TD Ameritrade, go to History & Statements and download."

**SCREEN:** Show screenshots/mockups of each broker export process.

---

## IMPORTING INTO THE PLATFORM (2:30 – 5:00)

**NARRATION:**
> "Back in the Trading Platform, go to Trade Journal and click 'Import'. Select your broker format from the dropdown — I'll pick Interactive Brokers. Click 'Choose File' and select your CSV. The platform parses the file and shows a preview table. Check that the columns mapped correctly — date, instrument, direction, entry price, exit price, quantity. Everything looks good."

**SCREEN:** Trade Journal → Import → select broker → upload file → show preview table with green checkmarks.

---

## REVIEWING IMPORT RESULTS (5:00 – 6:30)

**NARRATION:**
> "Click 'Import'. The results show: 47 trades imported successfully, 3 skipped as duplicates, and 0 errors. If there are errors, the platform tells you which rows had issues and why — things like invalid dates or missing required fields."

**SCREEN:** Show import results summary. Click into imported trades in the journal.

---

## GENERIC CSV FORMAT (6:30 – 7:30)

**NARRATION:**
> "If your broker isn't listed, use the Generic CSV option. Your CSV needs these columns: date, instrument, direction, entry_price, exit_price, quantity. Optional columns include fees, stop_loss, take_profit, and notes. Download our CSV template from the import page to get the exact format."

**SCREEN:** Show the generic CSV template. Show a sample CSV file in a text editor.

---

## OUTRO (7:30 – 8:00)

**NARRATION:**
> "That's it — your trade history is now in the platform ready for analysis. Head to Analytics to see your performance metrics. Next video: understanding your analytics dashboard."

---

# Video Script 4: Understanding Your Analytics

**Duration:** ~15 minutes
**Goal:** Deep dive into all analytics features and how to interpret metrics

---

## INTRO (0:00 – 0:45)

**NARRATION:**
> "Your analytics dashboard is where raw data becomes insight. In this video, I'll walk through every metric, chart, and filter — and more importantly, I'll explain what each number actually means for your trading."

---

## OVERVIEW METRICS (0:45 – 3:30)

**NARRATION:**
> "At the top of the Analytics page, you'll see your key metrics. Let's break each one down.
>
> Win rate: 64% — that means 64 out of every 100 trades are profitable. Good, but win rate alone doesn't tell the whole story.
>
> Profit factor: 2.15 — this is gross profits divided by gross losses. Above 2.0 is excellent. This means for every dollar you lose, you make $2.15 back.
>
> Total P&L: $3,450 — your net profit after all fees and commissions.
>
> Sharpe ratio: 1.85 — this measures risk-adjusted returns. Above 1.0 is good, above 2.0 is very good."

**SCREEN:** Analytics overview → highlight each metric with callout explanations.

---

## EQUITY CURVE (3:30 – 5:30)

**NARRATION:**
> "The equity curve plots your account balance over time. A healthy curve slopes upward steadily. Watch for sharp drops — those are drawdowns. The steeper and deeper, the more risk you took. You want smooth, consistent growth. Flat periods mean you're not making or losing — you might be sitting on the sidelines or taking small trades."

**SCREEN:** Show equity curve chart. Annotate uptrend, drawdown, and flat periods.

---

## DAILY P&L HEATMAP (5:30 – 7:30)

**NARRATION:**
> "The daily performance heatmap shows your P&L for each trading day. Green means profitable, red means a loss. Bigger squares mean bigger gains or losses. Look for patterns — are you consistently losing on Mondays? Are Fridays your best day? This is where behavioral patterns emerge."

**SCREEN:** Show heatmap calendar. Point out patterns.

---

## PERFORMANCE BY SETUP (7:30 – 10:00)

**NARRATION:**
> "If you've been tagging trades with playbooks or setup types, this is the most powerful view. It breaks down your performance by each strategy. In this example, breakout trades have a 71% win rate and 2.8 profit factor, while reversals are only at 44% with a profit factor under 1. The data is telling you: stop trading reversals and focus on breakouts."

**SCREEN:** Show setup performance table. Highlight best and worst setups.

---

## FILTERS AND TIMEFRAMES (10:00 – 12:00)

**NARRATION:**
> "Use the period filters — 7 days, 30 days, 90 days, 1 year, or all time — to zoom in on different windows. Maybe your last 30 days have been rough but your 90-day trend is positive. Filters help you separate short-term noise from long-term trends."

**SCREEN:** Toggle between period filters, show metrics changing.

---

## DRAWDOWN ANALYSIS (12:00 – 13:30)

**NARRATION:**
> "Max drawdown is the largest peak-to-trough decline in your equity. If your account hit $15,000 then dropped to $13,500 before recovering, that's a 10% drawdown. Professional traders try to keep this under 10-15%. If yours is higher, you may be risking too much per trade."

**SCREEN:** Show drawdown chart with annotations.

---

## ACTIONABLE TAKEAWAYS (13:30 – 14:30)

**NARRATION:**
> "Here's my framework for using analytics: First, check profit factor weekly — is it above 1.5? Second, compare setups — double down on winners, cut the losers. Third, monitor your drawdown — if it exceeds 10%, reduce position size. Fourth, review your equity curve monthly — is the slope going up?"

**SCREEN:** Show bullet points on screen alongside analytics.

---

## OUTRO (14:30 – 15:00)

**NARRATION:**
> "Analytics is where you stop guessing and start knowing. Make it a habit to check these numbers at least weekly. Next up: building a trading playbook."

---

# Video Script 5: Building a Trading Playbook

**Duration:** ~12 minutes
**Goal:** Create a complete trading playbook with rules, risk parameters, and tracking

---

## INTRO (0:00 – 0:30)

**NARRATION:**
> "A playbook is your documented trading strategy — specific, structured, and trackable. In this video, we'll build one from scratch and show you how to measure its performance over time."

---

## WHY PLAYBOOKS MATTER (0:30 – 2:00)

**NARRATION:**
> "Most traders lose money because they don't have a system. They trade on impulse, change their strategy daily, and have no way to measure what works. A playbook solves all three problems. It forces you to write down your rules before you trade, it gives you consistency, and it lets the platform track your results by strategy."

**SCREEN:** Show comparison — random trades vs. playbook-based trades with performance data.

---

## CREATING THE PLAYBOOK (2:00 – 5:00)

**NARRATION:**
> "Go to Playbooks and click 'New Playbook'. Name it 'Morning Gap Breakout'. Description: 'Long stocks that gap above the prior day's high with strong volume.'
>
> Entry rules — add each one:
> 1. Price gaps above previous day's high
> 2. First 5-minute candle volume exceeds 1.5x the 20-day average
> 3. Stock has relative strength vs. SPY
>
> Exit rules:
> 1. Take profit at 2R target
> 2. Stop loss below the low of the gap candle
> 3. Time stop: close by 11:30 AM if neither target hits
>
> Risk parameters: Max 1% risk per trade, max 3% daily loss, max 3 concurrent positions.
>
> Instruments: AAPL, TSLA, NVDA, AMZN, META. Timeframes: 5-minute, 15-minute."

**SCREEN:** Fill in each field step-by-step. Pause on each section.

---

## USING IN BACKTESTING (5:00 – 7:30)

**NARRATION:**
> "Now create a backtesting session and select this playbook from the dropdown. As you place trades, they're automatically associated with the playbook. Follow your rules strictly — the whole point is to test the system, not yourself."

**SCREEN:** Create session with playbook selected → place trades → show playbook association.

---

## TRACKING PERFORMANCE (7:30 – 9:30)

**NARRATION:**
> "After running the backtest, go back to your playbook. You'll see performance metrics: total trades, win rate, average P&L, profit factor, and max drawdown. These numbers update as you add more trades — whether from backtesting, live trading, or manual journal entries."

**SCREEN:** Show playbook performance card with real metrics.

---

## VERSIONING YOUR STRATEGY (9:30 – 11:00)

**NARRATION:**
> "Strategies evolve. Maybe after 50 trades you decide to add a fourth entry criterion, tighten the stop loss, or change the time stop. When you edit the playbook, it creates a new version. You can compare Version 1 performance to Version 2 to see if your changes actually improved results."

**SCREEN:** Edit playbook → show version history → compare v1 vs v2.

---

## OUTRO (11:00 – 12:00)

**NARRATION:**
> "A playbook turns your hunches into a tested, measurable system. Build one, backtest it, track it, and iterate. That's how professional traders improve. Next video: connecting your broker for automatic trade sync."

---

# Video Script 6: Connecting Your Broker

**Duration:** ~10 minutes
**Goal:** Walk through broker connection setup for all supported brokers

---

## INTRO (0:00 – 0:30)

**NARRATION:**
> "Want your live trades to appear in the platform automatically? Connect your broker and your trades will sync every 5 minutes — no manual logging needed. Let me show you how."

---

## SUPPORTED BROKERS (0:30 – 1:30)

**NARRATION:**
> "We currently support three brokers: Interactive Brokers, Alpaca, and TD Ameritrade. Each uses a slightly different connection method. Interactive Brokers and Alpaca use API keys, while TD Ameritrade uses OAuth — you'll authorize through their website."

**SCREEN:** Settings → Broker Connections → show broker cards.

---

## ALPACA SETUP (1:30 – 3:30)

**NARRATION:**
> "Let's start with Alpaca — it's the simplest. Log in to your Alpaca dashboard at app.alpaca.markets. Go to your Paper Trading or Live Trading section. Click 'Generate New Key'. Copy both the API Key ID and Secret Key — the secret is only shown once.
>
> Back in our platform, go to Settings → Broker Connections → Connect → Alpaca. Paste your API Key ID and Secret Key. Select your environment — paper or live. Click Connect."

**SCREEN:** Show Alpaca dashboard → generate key → copy → paste in platform → Connect.

---

## INTERACTIVE BROKERS SETUP (3:30 – 6:00)

**NARRATION:**
> "Interactive Brokers requires a bit more setup. You need IB Gateway or TWS running. Open it and go to Edit → Global Configuration → API → Settings. Check 'Enable ActiveX and Socket Clients'. Note the socket port — 7496 for live, 7497 for paper.
>
> Then log in to IB Account Management online. Go to Settings → API → API Keys → Create. Set permissions to read-only. Copy the key and secret.
>
> Back in our platform, Settings → Broker Connections → Connect → Interactive Brokers. Enter your credentials. Click Connect."

**SCREEN:** Show IB Gateway settings → Account Management → API key creation → platform connection.

---

## TD AMERITRADE SETUP (6:00 – 7:30)

**NARRATION:**
> "TD Ameritrade uses OAuth, so instead of entering credentials directly, you'll authorize through their website. Click Connect → TD Ameritrade → 'Authorize with TD Ameritrade'. You'll be redirected to TD's login page. Sign in, grant access, and you'll be sent back to our platform — connected."

**SCREEN:** Click Connect → redirect → TD login → authorize → redirect back.

---

## VERIFYING AND SYNCING (7:30 – 9:00)

**NARRATION:**
> "Once connected, your status shows as 'Connected' with a green indicator. Click 'Sync Now' to import your recent trades immediately. You can check the sync logs to see how many trades were imported and whether there were any issues. Trades will now auto-sync every 5 minutes."

**SCREEN:** Show connected status → Sync Now → sync logs → trades in journal.

---

## TROUBLESHOOTING (9:00 – 9:30)

**NARRATION:**
> "If your connection fails, check three things: Are your API credentials correct? Is the broker's service up? Does your broker account have API access enabled? Check our troubleshooting guide in the knowledge base for detailed solutions."

---

## OUTRO (9:30 – 10:00)

**NARRATION:**
> "You're all set — your broker is connected and trades flow in automatically. No more manual logging. That completes our tutorial series! Check the knowledge base for more detailed guides on each feature."

**SCREEN:** End card with knowledge base link and subscribe button.
