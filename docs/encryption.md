# Encryption

How to encrypt and decrypt sensitive values using the SDK. Simple usage only.

## Setup

Set an encryption key (e.g. in `.env`):

```bash
ENCRYPTION_KEY=your-32-byte-key
```

Or pass `encryptionKey` in config. The controller uses this for local encryption or validation; in production, Key Vault may be used.

## Encrypt

Encrypt a value and get a reference to store (never store plaintext):

```typescript
if (client.encryption) {
  const result = await client.encryption.encrypt(
    "my-secret-api-key",
    "external-api-key",
  );
  // result.value: 'enc://v1:...' or 'kv://...'
  // result.storage: 'local' | 'keyvault'
  await db.settings.update({ apiKeyRef: result.value });
}
```

`parameterName` is an identifier (1–128 chars, alphanumeric, dots, underscores, hyphens). Use the same name when decrypting.

## Decrypt

Decrypt a stored reference back to plaintext:

```typescript
const row = await db.settings.findOne();
const plaintext = await client.encryption.decrypt(
  row.apiKeyRef,
  "external-api-key",
);
```

Use the same `parameterName` as for encryption.

## Errors

Local validation failures throw `EncryptionError` (`INVALID_PARAMETER_NAME` or
`ENCRYPTION_KEY_REQUIRED`). Controller/HTTP failures remain `MisoClientError`;
inspect `statusCode`, `errorResponse?.code` or `errorBody?.code`. The SDK preserves
the controller error and safe diagnostics rather than wrapping it in a generic
encryption failure. See [errors.md](errors.md).

Encryption uses the ordinary client-token request path and does not implicitly
retry with another identity. Set `cache: { encryptionCacheTTL: 0 }` when verifying
actual encrypt/decrypt requests. The [manual test instructions](../tests/manual/README.md#live-encryption)
cover dedicated-app local and managed bootstrap tests, invalid keys and recovery.

## Summary

| Need            | Use                                                   |
| --------------- | ----------------------------------------------------- |
| Encrypt         | `client.encryption.encrypt(plaintext, parameterName)` |
| Decrypt         | `client.encryption.decrypt(value, parameterName)`     |
| Check available | `if (client.encryption)` before use                   |

See [configuration.md](configuration.md) for `ENCRYPTION_KEY` and related options.
