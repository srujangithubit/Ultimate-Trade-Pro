# Troubleshooting Guide

## Login Issues

### Can't sign in
- **Check email spelling** — Ensure exact match with your registered email
- **Reset password** — Click "Forgot Password" on the login page
- **Clear browser cache** — Old session data can interfere
- **Disable browser extensions** — Ad blockers or privacy extensions may block API calls

### Email verification link expired
- Sign in to your account
- Go to **Settings → Profile**
- Click **"Resend Verification Email"**
- Check spam/junk folders

### 2FA code not working
- Ensure your authenticator app clock is synced
- Use the current TOTP code (refreshes every 30 seconds)
- If locked out, contact support with your recovery code

---

## Backtesting Issues

### Session won't load
- **Check internet connection** — Historical data requires a stable connection
- **Reduce date range** — Very long date ranges may take longer to load
- **Try a different browser** — Clear cache and try Chrome or Firefox
- **Check data availability** — Some instruments may not have data for the selected period

### Chart not displaying
- Ensure JavaScript is enabled
- Disable hardware acceleration in browser settings
- Clear browser cache and reload
- Update your browser to the latest version

### Trades not executing
- Ensure the session is in **Active** status (not Paused or Archived)
- Check that your balance is sufficient for the position size
- Verify the instrument has data for the current timestamp

---

## Trade Journal Issues

### CSV import failing
- **Check file format** — Must be `.csv` with UTF-8 encoding
- **Select the correct broker** format from the dropdown
- **Verify required columns** — Date, instrument, direction, entry price, quantity are required
- **Check date format** — Use `YYYY-MM-DD` or `MM/DD/YYYY`
- **File size limit** — Maximum 10 MB per upload

### Trades not showing in journal
- Check the **date filter** — Your trades may be outside the visible range
- Verify the trade was saved (check for confirmation message)
- Refresh the page

---

## Broker Connection Issues

### Connection failed
1. **Verify API credentials** — Double-check key and secret
2. **Check broker service status** — Visit your broker's status page
3. **Ensure API access is enabled** — Some brokers require explicit API activation
4. **Whitelist IP addresses** — If your broker requires it, add our server IPs (listed in broker guide)

### Sync not importing trades
- **Check sync status** — Go to Settings → Broker Connections → View Sync Logs
- **Verify trade date range** — Sync imports trades from the last 30 days by default
- **Check for duplicate detection** — Already-imported trades are skipped
- **Manual sync** — Click the "Sync Now" button to trigger immediately

### "Rate limited by broker" error
This is normal — brokers limit API call frequency. The platform automatically retries with back-off. Wait a few minutes and the sync will complete.

---

## Performance & Display Issues

### Page loading slowly
- Clear browser cache and cookies
- Disable unnecessary browser extensions
- Check your internet speed (recommend > 10 Mbps)
- Try a wired connection instead of WiFi
- Use the latest Chrome or Firefox

### Charts look blurry
- Set browser zoom to 100%
- Ensure display scaling is set to 100% in OS settings
- Enable hardware acceleration in browser settings

---

## Getting More Help

If none of the above resolves your issue:

1. **Check the [Knowledge Base](../knowledge-base/)** for detailed articles
2. **Email support** — support@tradingplatform.com (response within 24 hours)
3. **Live chat** — Available Mon–Fri 9 AM – 6 PM EST (Pro and above)
4. **Community Discord** — [discord.gg/tradingplatform](https://discord.gg/tradingplatform)

When contacting support, include:
- Your account email
- Browser and OS version
- Steps to reproduce the issue
- Any error messages or screenshots
