# Authentication

How to work with tokens, validate them, get user info, and handle login/logout. Minimal examples only.

## Get token from request

```typescript
const token = client.getToken(req);  // Reads Authorization: Bearer <token>
```

Use this in middleware or route handlers to obtain the user JWT. `getToken(req)` only reads **`req.headers.authorization`** (with or without a `Bearer ` prefix).

### Custom header or cookie (e.g. `miso_token`)

If your platform sends the token under a different name (e.g. header `miso_token` or a cookie), read it yourself and pass the string to the SDK:

```typescript
const token = req.headers['miso_token'] ?? req.cookies?.miso_token ?? null;
if (token) {
  const isValid = await client.validateToken(token);
  const user = await client.getUser(token);
}
```

The SDK accepts the token string for `validateToken`, `getUser`, `logout`, etc.; it does not read custom headers or cookies for you.

## Validate token

```typescript
const isValid = await client.validateToken(token);
if (!isValid) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

Results are cached by user (default TTL 15 min). See [redis.md](redis.md).

## Get user info

```typescript
const user = await client.getUser(token);
if (user) {
  console.log(user.username, user.id);
}
```

Returns user object or `null` if invalid.

## Login

Get a login URL and redirect the user to Keycloak. The controller validates the redirect URL against your app.

```typescript
const response = await client.login({
  redirect: 'https://myapp.com/dashboard',  // Where to send user after login
  state: 'optional-csrf-state',
});
// Redirect browser to response.loginUrl
window.location.href = response.loginUrl;
```

After authentication, the controller redirects the user to your `redirect` URL.

## Logout

Invalidate the user token and clear token-validation cache:

```typescript
await client.logout({ token });
```

## Token refresh

Exchange a refresh token for a new access token:

```typescript
const response = await client.refreshToken(refreshToken);
if (response) {
  console.log(response.accessToken, response.expiresIn);
}
```

Returns `null` on error.

## Summary

| Need | Method |
|------|--------|
| Token from request | `client.getToken(req)` |
| Check if token valid | `client.validateToken(token)` |
| User info | `client.getUser(token)` |
| Login URL | `client.login({ redirect, state? })` |
| Logout | `client.logout({ token })` |
| Refresh token | `client.refreshToken(refreshToken)` |

See [quick-start.md](quick-start.md) for init and [authorization.md](authorization.md) for roles and permissions.
