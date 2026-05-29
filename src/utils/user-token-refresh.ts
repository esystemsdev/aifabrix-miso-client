import jwt from "jsonwebtoken";

interface TokenStorageMap {
  [key: string]: unknown;
}

const ACCESS_TOKEN_KEY = "miso_token";
// Legacy compatibility: browser cookie-first baseline no longer requires storing refresh token locally.
const REFRESH_TOKEN_KEY = "miso:user-refresh-token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "miso_token_expires_at";

export interface RefreshCallbackResult {
  token: string;
  expiresIn?: number;
  expiresAt?: string;
  // Optional for compatibility with environments that still rotate refresh tokens.
  refreshToken?: string;
}

function asNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readValue(storage: TokenStorageMap, key: string): unknown {
  return storage[key];
}

function writeValue(
  storage: TokenStorageMap,
  key: string,
  value: unknown,
): void {
  storage[key] = value;
}

function removeValue(storage: TokenStorageMap, key: string): void {
  delete storage[key];
}

function firstString(storage: TokenStorageMap, key: string): string | null {
  const raw = readValue(storage, key);
  if (typeof raw === "string" && raw.trim() !== "") return raw;
  return null;
}

function decodeTokenClaims(token: string): Record<string, unknown> | null {
  try {
    return jwt.decode(token) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

export function normalizeExpiresAt(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  const numeric = asNumber(value);
  if (numeric !== null) {
    const epochMs = numeric > 1e12 ? numeric : numeric * 1000;
    const date = new Date(epochMs);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  if (typeof value === "string") {
    const normalized = value.endsWith("Z")
      ? value.replace(/Z$/, "+00:00")
      : value;
    const date = new Date(normalized);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  return null;
}

export function getJwtExpiresAt(token: string): Date | null {
  if (!token) return null;
  const claims = decodeTokenClaims(token);
  if (!claims) return null;
  return (
    normalizeExpiresAt(claims.exp) ||
    normalizeExpiresAt(claims.expiresAt) ||
    normalizeExpiresAt(claims.expires_at)
  );
}

export function getEffectiveUserTokenRefreshBuffer(
  expiresAt: unknown,
  defaultBufferSeconds = 300,
  issuedAt?: unknown,
  now = new Date(),
): number {
  const normalizedDefault = Math.max(0, Math.floor(defaultBufferSeconds));
  const expiresAtDate = normalizeExpiresAt(expiresAt);
  if (!expiresAtDate) return normalizedDefault;

  const issuedAtDate = normalizeExpiresAt(issuedAt) || now;
  const lifetimeSeconds = Math.floor(
    (expiresAtDate.getTime() - issuedAtDate.getTime()) / 1000,
  );
  if (lifetimeSeconds <= 0) return normalizedDefault;

  const adaptive = Math.floor(lifetimeSeconds * 0.1);
  const bounded = Math.min(300, Math.max(15, adaptive));
  return Math.max(normalizedDefault, bounded);
}

export function getUserTokenRefreshDueAt(
  expiresAt: unknown,
  defaultBufferSeconds = 300,
  issuedAt?: unknown,
  now = new Date(),
): Date | null {
  const expiresAtDate = normalizeExpiresAt(expiresAt);
  if (!expiresAtDate) return null;
  const buffer = getEffectiveUserTokenRefreshBuffer(
    expiresAtDate,
    defaultBufferSeconds,
    issuedAt,
    now,
  );
  return new Date(expiresAtDate.getTime() - buffer * 1000);
}

export function isUserTokenRefreshDue(
  expiresAt: unknown,
  defaultBufferSeconds = 300,
  issuedAt?: unknown,
  now = new Date(),
): boolean {
  const dueAt = getUserTokenRefreshDueAt(
    expiresAt,
    defaultBufferSeconds,
    issuedAt,
    now,
  );
  if (!dueAt) return false;
  return dueAt.getTime() <= now.getTime();
}

export function isUserTokenExpired(
  expiresAt: unknown,
  now = new Date(),
): boolean {
  const expiresAtDate = normalizeExpiresAt(expiresAt);
  if (!expiresAtDate) return false;
  return expiresAtDate.getTime() <= now.getTime();
}

function storeAccessTokenInternal(
  storage: TokenStorageMap,
  token: string,
  expiresAt?: unknown,
): TokenStorageMap {
  const previous = firstString(storage, ACCESS_TOKEN_KEY);
  const nextExpiresAt = normalizeExpiresAt(expiresAt);

  writeValue(storage, ACCESS_TOKEN_KEY, token);
  if (nextExpiresAt) {
    writeValue(
      storage,
      ACCESS_TOKEN_EXPIRES_AT_KEY,
      nextExpiresAt.toISOString(),
    );
    return storage;
  }

  if (previous && previous !== token) {
    removeValue(storage, ACCESS_TOKEN_EXPIRES_AT_KEY);
  }
  return storage;
}

function storeRefreshTokenInternal(
  storage: TokenStorageMap,
  token: string,
): TokenStorageMap {
  writeValue(storage, REFRESH_TOKEN_KEY, token);
  return storage;
}

function clearStoredAccessTokenInternal(
  storage: TokenStorageMap,
): TokenStorageMap {
  removeValue(storage, ACCESS_TOKEN_KEY);
  removeValue(storage, ACCESS_TOKEN_EXPIRES_AT_KEY);
  return storage;
}

function clearStoredRefreshTokenInternal(
  storage: TokenStorageMap,
): TokenStorageMap {
  removeValue(storage, REFRESH_TOKEN_KEY);
  return storage;
}

function clearStoredSessionTokensInternal(
  storage: TokenStorageMap,
): TokenStorageMap {
  clearStoredAccessTokenInternal(storage);
  clearStoredRefreshTokenInternal(storage);
  return storage;
}

function getStoredRefreshTokenInternal(
  storage: TokenStorageMap,
): string | null {
  return firstString(storage, REFRESH_TOKEN_KEY);
}

function getUserTokenExpiresAt(storage: TokenStorageMap): Date | null {
  const fromMetadata = firstString(storage, ACCESS_TOKEN_EXPIRES_AT_KEY);
  if (fromMetadata) {
    const parsed = normalizeExpiresAt(fromMetadata);
    if (parsed) return parsed;
  }

  const token = firstString(storage, ACCESS_TOKEN_KEY);
  if (!token) return null;
  return getJwtExpiresAt(token);
}

export class UserTokenRefreshManager {
  private stores = new Map<string, TokenStorageMap>();

  private callbacks = new Map<
    string,
    () => Promise<RefreshCallbackResult | null>
  >();

  registerRefreshCallback(
    userId: string,
    callback: () => Promise<RefreshCallbackResult | null>,
  ): void {
    this.callbacks.set(userId, callback);
  }

  unregisterRefreshCallback(userId: string): void {
    this.callbacks.delete(userId);
  }

  private getStore(userId: string): TokenStorageMap {
    let store = this.stores.get(userId);
    if (!store) {
      store = {};
      this.stores.set(userId, store);
    }
    return store;
  }

  storeAccessToken(userId: string, token: string, expiresAt?: unknown): void {
    storeAccessTokenInternal(this.getStore(userId), token, expiresAt);
  }

  storeRefreshToken(userId: string, token: string): void {
    storeRefreshTokenInternal(this.getStore(userId), token);
  }

  clearUserTokens(userId: string): void {
    clearStoredSessionTokensInternal(this.getStore(userId));
  }

  getAccessToken(userId: string): string | null {
    return firstString(this.getStore(userId), ACCESS_TOKEN_KEY);
  }

  getRefreshToken(userId: string): string | null {
    return getStoredRefreshTokenInternal(this.getStore(userId));
  }

  getExpiresAt(userId: string): Date | null {
    return getUserTokenExpiresAt(this.getStore(userId));
  }

  async refreshIfDue(
    userId: string,
    defaultBufferSeconds = 300,
    now = new Date(),
  ): Promise<RefreshCallbackResult | null> {
    const callback = this.callbacks.get(userId);
    if (!callback) return null;

    const store = this.getStore(userId);
    const token = firstString(store, ACCESS_TOKEN_KEY);
    if (!token) return null;

    const claims = decodeTokenClaims(token);
    const expiresAt = getUserTokenExpiresAt(store);
    const issuedAt = claims?.iat ?? claims?.issuedAt ?? claims?.issued_at;
    if (
      expiresAt &&
      !isUserTokenRefreshDue(expiresAt, defaultBufferSeconds, issuedAt, now)
    ) {
      return null;
    }

    try {
      const refreshed = await callback();
      if (refreshed?.token) {
        storeAccessTokenInternal(store, refreshed.token, refreshed.expiresAt);
        if (refreshed.refreshToken) {
          storeRefreshTokenInternal(store, refreshed.refreshToken);
        }
      }
      return refreshed;
    } catch {
      return null;
    }
  }
}
