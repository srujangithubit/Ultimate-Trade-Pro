# Authentication Guide

This guide covers how to authenticate with the Trading Platform API.

---

## Overview

The API uses **JSON Web Tokens (JWT)** for authentication. After signing in, you receive an `access_token` that must be included in every authenticated request.

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 15 minutes | Authorize API requests |
| Refresh Token | 7 days | Obtain new access tokens |

---

## 1. Register a New Account

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "trader@example.com",
  "password": "SecureP@ss1",
  "displayName": "Jane Trader"
}
```

**Response `201 Created`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Validation Rules
- `email` — must be a valid email; must be unique
- `password` — minimum 6 characters
- `displayName` — optional

---

## 2. Sign In

```http
POST /auth/signin
Content-Type: application/json

{
  "email": "trader@example.com",
  "password": "SecureP@ss1"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 3. Using the Access Token

Include the token in the `Authorization` header for all authenticated requests:

```http
GET /users/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

If the token is missing or expired, the API responds with `401 Unauthorized`.

---

## 4. Refreshing Tokens

When your access token expires, use the refresh token to get a new one without re-entering credentials:

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2..."
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 5. Password Reset Flow

### Step 1: Request Reset Email
```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "trader@example.com"
}
```
> Always returns `200` regardless of whether the email exists (security best practice).

### Step 2: Reset Password
Use the token from the email:
```http
POST /auth/reset-password
Content-Type: application/json

{
  "token": "abc123-reset-token",
  "newPassword": "NewSecureP@ss2"
}
```

---

## 6. Email Verification

After signup, verify your email using the token sent to your inbox:

```http
POST /auth/verify-email
Content-Type: application/json

{
  "token": "abc123-verification-token"
}
```

---

## 7. Two-Factor Authentication (2FA)

2FA can be enabled in user preferences. When enabled, the signin flow requires an additional TOTP code step. The `two_factor_secret` is generated server-side and provided as a QR code URI for authenticator apps.

---

## Security Best Practices

1. **Never expose tokens in URLs** — always use the `Authorization` header
2. **Store tokens securely** — use `httpOnly` cookies or secure in-memory storage
3. **Implement token rotation** — refresh tokens before they expire
4. **Use HTTPS only** — never send tokens over unencrypted connections
5. **Logout properly** — invalidate sessions on the server when logging out
