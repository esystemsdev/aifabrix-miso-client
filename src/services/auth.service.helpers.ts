import { AuthStrategy, UserInfo } from "../types/config.types";
import { CacheService } from "./cache.service";
import { getCacheTtlFromToken } from "./auth-cache-helpers";

export interface TokenCacheData {
  authenticated: boolean;
  timestamp: number;
}

export interface UserInfoCacheData {
  user: UserInfo;
  timestamp: number;
}

export function buildAuthStrategyWithToken(
  token: string,
  authStrategy: AuthStrategy | undefined,
  defaultAuthStrategy: AuthStrategy | undefined,
): AuthStrategy {
  const authStrategyToUse = authStrategy || defaultAuthStrategy;
  return authStrategyToUse
    ? { ...authStrategyToUse, bearerToken: token }
    : { methods: ["bearer"], bearerToken: token };
}

export async function getCachedUserInfo(
  cache: CacheService,
  cacheKey: string | null,
): Promise<UserInfo | null> {
  if (!cacheKey) return null;
  const cached = await cache.get<UserInfoCacheData>(cacheKey);
  return cached ? cached.user : null;
}

export async function cacheUserInfo(
  cache: CacheService,
  cacheKey: string | null,
  user: UserInfo,
  userTTL: number,
): Promise<void> {
  if (!cacheKey) return;
  await cache.set<UserInfoCacheData>(
    cacheKey,
    { user, timestamp: Date.now() },
    userTTL,
  );
}

export async function getCachedTokenValidation(
  cache: CacheService,
  cacheKey: string,
): Promise<boolean | null> {
  const cached = await cache.get<TokenCacheData>(cacheKey);
  return cached ? cached.authenticated : null;
}

export async function cacheTokenValidation(
  cache: CacheService,
  cacheKey: string,
  token: string,
  authenticated: boolean,
  tokenValidationTTL: number,
  minValidationTTL: number,
): Promise<void> {
  const ttl = getCacheTtlFromToken(token, tokenValidationTTL, minValidationTTL);
  await cache.set<TokenCacheData>(
    cacheKey,
    { authenticated, timestamp: Date.now() },
    ttl,
  );
}

export function mapUserInfo(user: {
  id: string;
  username: string;
  email: string;
}): UserInfo {
  return { id: user.id, username: user.username, email: user.email };
}

export function generateCorrelationId(clientId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const clientPrefix = clientId.substring(0, 10);
  return `${clientPrefix}-${timestamp}-${random}`;
}
