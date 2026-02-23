# Error Codes Reference

All API errors follow a consistent JSON format:

```json
{
  "statusCode": 400,
  "message": "Description of what went wrong",
  "error": "Bad Request"
}
```

Validation errors return an array of messages:

```json
{
  "statusCode": 422,
  "message": [
    "email must be an email",
    "password must be at least 6 characters long"
  ],
  "error": "Unprocessable Entity"
}
```

---

## HTTP Status Codes

| Status | Meaning | When It Occurs |
|--------|---------|----------------|
| `200` | OK | Successful GET, PATCH, or action |
| `201` | Created | Successful POST that creates a resource |
| `202` | Accepted | Async operation started (e.g., broker sync) |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Malformed JSON, missing required fields |
| `401` | Unauthorized | Missing, expired, or invalid JWT token |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | Resource does not exist or belongs to another user |
| `409` | Conflict | Resource already exists (e.g., duplicate email) |
| `422` | Unprocessable Entity | Validation errors on request body |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal Server Error | Unexpected server failure |

---

## Application Error Codes

### Authentication Errors

| Code | Message | Resolution |
|------|---------|------------|
| `AUTH_001` | Credentials incorrect | Check email and password |
| `AUTH_002` | Credentials taken | Email already registered; use signin |
| `AUTH_003` | Token expired | Refresh your access token |
| `AUTH_004` | Invalid refresh token | Re-authenticate with signin |
| `AUTH_005` | Email not verified | Check inbox for verification email |
| `AUTH_006` | 2FA code required | Provide TOTP code |
| `AUTH_007` | Invalid 2FA code | Check authenticator app |
| `AUTH_008` | Password reset token expired | Request a new reset email |

### Backtesting Errors

| Code | Message | Resolution |
|------|---------|------------|
| `BT_001` | Session not found | Verify the session ID |
| `BT_002` | Session is archived | Unarchive or create a new session |
| `BT_003` | Insufficient balance | Reduce position size |
| `BT_004` | Invalid date range | End date must be after start date |
| `BT_005` | Position already open | Close existing position first |

### Trade Journal Errors

| Code | Message | Resolution |
|------|---------|------------|
| `TJ_001` | Trade not found | Verify the trade ID |
| `TJ_002` | Invalid CSV format | Check the import format guide |
| `TJ_003` | Duplicate trade | Trade already exists in journal |
| `TJ_004` | Tag limit reached | Delete unused tags (max 50) |

### Playbook Errors

| Code | Message | Resolution |
|------|---------|------------|
| `PB_001` | Playbook not found | Verify the playbook ID |
| `PB_002` | Name already exists | Use a unique playbook name |

### Broker Errors

| Code | Message | Resolution |
|------|---------|------------|
| `BR_001` | Broker not supported | Check supported broker list |
| `BR_002` | Invalid credentials | Re-enter broker API credentials |
| `BR_003` | Connection failed | Check broker service status |
| `BR_004` | Sync in progress | Wait for current sync to complete |
| `BR_005` | Rate limited by broker | Wait and retry (auto-retried) |

### Subscription Errors

| Code | Message | Resolution |
|------|---------|------------|
| `SUB_001` | Feature not available on free tier | Upgrade your plan |
| `SUB_002` | Usage limit reached | Upgrade or wait for next period |
| `SUB_003` | Payment method required | Add a payment method in billing |
| `SUB_004` | Subscription past due | Update payment method |

---

## Handling Errors in Code

### JavaScript / TypeScript
```javascript
try {
  const res = await fetch('/api/v1/trades', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const error = await res.json();
    if (res.status === 401) {
      // Refresh token or redirect to login
    }
    console.error(`Error ${error.statusCode}: ${error.message}`);
  }
} catch (err) {
  console.error('Network error:', err);
}
```

### Python
```python
import requests

response = requests.get(
    'https://api.tradingplatform.com/v1/trades',
    headers={'Authorization': f'Bearer {token}'}
)

if response.status_code != 200:
    error = response.json()
    print(f"Error {error['statusCode']}: {error['message']}")
```
