# Audit and Logging

How to record audit events, log errors, and attach request context. Simple usage only.

## Audit events

Use audit for compliance and security (who did what, when):

```typescript
await client.log.audit('user.login', 'authentication', {
  userId: user?.id,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

await client.log.audit('post.created', 'content', {
  userId: user?.id,
  postId: 'post-123',
});
```

Log important actions: login/logout, permission checks, create/update/delete of sensitive data.

## Error logs

Always include context. In Express, use request context so IP, method, path, userAgent, correlationId, and userId are added automatically:

```typescript
await client.log
  .forRequest(req)
  .error('Operation failed', error instanceof Error ? error.stack : undefined);
```

Without Express, add context manually:

```typescript
await client.log
  .withContext({ jobId: 'sync-123', userId })
  .error('Sync failed', error instanceof Error ? error.stack : undefined);
```

Do not log errors without context (no bare `log.error('Failed')`).

## Info and debug

```typescript
await client.log.info('User accessed dashboard', { userId: user?.id });
await client.log.debug('Processing request', { requestId: req.id });
```

With request context (Express):

```typescript
await client.log.forRequest(req).info('Users list accessed');
```

## RFC 7807 and errors

When you use the recommended Express pattern ([errors.md](errors.md)), route errors are formatted as RFC 7807 Problem Details and logged with full context by `handleRouteError`. Use that instead of ad-hoc error logging in route handlers where possible.

## When to use what

| Need | Use |
|------|-----|
| Compliance/security events | `client.log.audit(action, resource, context)` |
| Errors in Express routes | `handleRouteError` + `forRequest(req)` when logging manually |
| General info/debug | `client.log.info` / `client.log.debug` with context |
| Request-scoped context | `client.log.forRequest(req)` then `.info()` / `.error()` |

**Log destination:** By default logs go to Redis and/or the controller. To receive logs in your own code (e.g. save to your DB), use [event emission mode](configuration.md#optional-event-emission-mode) in [configuration.md](configuration.md).

See [errors.md](errors.md) for Express error handling and [configuration.md](configuration.md) for log level and audit options.
