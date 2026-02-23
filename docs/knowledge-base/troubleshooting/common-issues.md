# Common Issues

## Login Problems
| Issue | Solution |
|-------|----------|
| Can't sign in | Check email/password; click "Forgot Password" to reset |
| Email not verified | Check spam folder; resend from Settings → Profile |
| 2FA code rejected | Sync authenticator app clock; use recovery code if locked out |
| Session expired | Tokens expire after 15 minutes; re-login or enable "Remember Me" |

## Platform Performance
| Issue | Solution |
|-------|----------|
| Slow loading | Clear browser cache; disable extensions; use Chrome/Firefox |
| Charts not rendering | Enable JavaScript; update browser; disable hardware acceleration |
| Data not updating | Check internet connection; refresh page; try hard refresh (Ctrl+Shift+R) |

---

# Broker Connection Issues

## Connection Failed
1. Verify API credentials are correct
2. Check broker's service status page
3. Ensure API access is enabled on your broker account
4. For IB: Verify IB Gateway/TWS is running

## Sync Not Working
1. Check sync logs: Settings → Broker Connections → Sync Logs
2. Verify trades exist in the target date range
3. Click "Sync Now" for manual trigger
4. Duplicates are automatically skipped

## Rate Limit Errors
Normal behavior — brokers limit API call frequency. The platform automatically retries with exponential back-off. Wait a few minutes.

---

# Contact Support

If you can't resolve your issue:

- **Email:** support@tradingplatform.com (response within 24 hours)
- **Live Chat:** Available Mon–Fri 9 AM – 6 PM EST (Pro tier and above)
- **Community:** [Discord](https://discord.gg/tradingplatform)

When contacting support, include:
- Account email
- Browser and OS version
- Steps to reproduce the issue
- Error messages or screenshots
