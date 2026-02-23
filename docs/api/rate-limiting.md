# Rate Limiting

The API enforces rate limits to ensure fair usage and platform stability. Limits vary by subscription tier and endpoint category.

---

## Rate Limit Headers

Every response includes rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1708934400
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in current window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

When the limit is exceeded, the API returns `429 Too Many Requests`:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "error": "Too Many Requests"
}
```

---

## Limits by Subscription Tier

| Tier | Requests / Minute | Requests / Hour | Requests / Day |
|------|-------------------|-----------------|----------------|
| **Free** | 30 | 500 | 5,000 |
| **Pro** | 120 | 3,000 | 50,000 |
| **Team** | 300 | 10,000 | 150,000 |
| **Enterprise** | 1,000 | 50,000 | Unlimited |

## Limits by Endpoint Category

Some endpoint categories have additional specific limits:

| Category | Free | Pro | Team | Enterprise |
|----------|------|-----|------|------------|
| Authentication | 10/min | 10/min | 20/min | 50/min |
| Market Data | 10/min | 60/min | 200/min | 500/min |
| Trade Import (CSV) | 5/hour | 30/hour | 100/hour | 500/hour |
| Broker Sync | 2/min | 10/min | 30/min | 100/min |
| Analytics | 20/min | 60/min | 200/min | 500/min |

---

## Best Practices

1. **Cache responses** — Cache market data and analytics responses that don't change frequently
2. **Use pagination** — Fetch only the data you need with `limit` parameters
3. **Implement exponential back-off** — When receiving `429`, wait and retry with increasing delays
4. **Monitor headers** — Check `X-RateLimit-Remaining` before making bulk requests
5. **Batch operations** — Use bulk endpoints where available to reduce request count

### Exponential Back-off Example (JavaScript)

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const resetAt = response.headers.get('X-RateLimit-Reset');
      const waitMs = resetAt
        ? (parseInt(resetAt) * 1000 - Date.now())
        : Math.pow(2, i) * 1000;

      await new Promise(resolve => setTimeout(resolve, waitMs));
      continue;
    }

    return response;
  }
  throw new Error('Max retries exceeded');
}
```
