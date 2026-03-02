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

Audit completeness rules in SDK:

- Audit events are always emitted regardless of configured log level.
- Empty audit inputs are normalized for traceability:
  - empty `action` -> `unknown_action`
  - empty `resource` -> `unknown_resource`

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

## Info, warn, and debug

```typescript
await client.log.info('User accessed dashboard', { userId: user?.id });
await client.log.warn('Unusual activity detected', { signal: 'multiple_failed_attempts' });
await client.log.debug('Processing request', { requestId: req.id });
```

Level threshold behavior:

- `logLevel=debug`: debug/info/warn/error/audit
- `logLevel=info`: info/warn/error/audit
- `logLevel=warn`: warn/error/audit
- `logLevel=error`: error/audit

With request context (Express):

```typescript
await client.log.forRequest(req).info('Users list accessed');
```

## RFC 7807 and errors

When you use the recommended Express pattern ([errors.md](errors.md)), route errors are formatted as RFC 7807 Problem Details and logged with full context by `handleRouteError`. Use that instead of ad-hoc error logging in route handlers where possible.

The SDK HTTP error adapter accepts both common structured formats:

- SDK format: `statusCode`
- RFC 7807 format: `status` + `detail`

This preserves structured error context for mixed controller/Express response sources.

## Trace propagation

When async logger context contains trace identifiers, outbound controller requests automatically include:

- `x-correlation-id`
- `x-request-id` (if available)

Existing headers are preserved and are not overwritten.

## Migration note

If you previously encoded warnings as `info` (for example `info + originalLevel=warn` in context), you can now switch to native `client.log.warn(...)`.

## When to use what

| Need | Use |
|------|-----|
| Compliance/security events | `client.log.audit(action, resource, context)` |
| Errors in Express routes | `handleRouteError` + `forRequest(req)` when logging manually |
| General info/warn/debug | `client.log.info` / `client.log.warn` / `client.log.debug` with context |
| Request-scoped context | `client.log.forRequest(req)` then `.info()` / `.error()` |

**Log destination:** By default logs go to Redis and/or the controller. To receive logs in your own code (e.g. save to your DB), use [event emission mode](configuration.md#optional-event-emission-mode) in [configuration.md](configuration.md).

See [errors.md](errors.md) for Express error handling and [configuration.md](configuration.md) for log level and audit options.
