/**
 * Token validation service for local JWKS-based JWT verification
 * Supports Keycloak and delegated OAuth providers with dual-layer caching
 */

import {
  jwtVerify,
  decodeJwt,
  createRemoteJWKSet,
  JWTVerifyGetKey,
} from "jose";
import {
  TokenType,
  TokenValidationOptions,
  TokenValidationResult,
  TokenPayload,
  KeycloakConfig,
  DelegatedProviderConfig,
  ValidationCacheEntry,
} from "../types/token-validation.types";
import { resolveKeycloakUrl } from "../utils/controller-url-resolver";

export class TokenValidationService {
  // JWKS cache: jwksUri -> { keySet, expiresAt }
  private jwksCache = new Map<
    string,
    { keySet: JWTVerifyGetKey; expiresAt: number }
  >();
  private readonly JWKS_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  // Validation result cache: tokenHash -> { result, expiresAt }
  private resultCache = new Map<string, ValidationCacheEntry>();
  private readonly RESULT_CACHE_TTL_MS = 60 * 1000; // 1 minute

  private keycloakConfig?: KeycloakConfig;

  constructor(keycloakConfig?: KeycloakConfig) {
    this.keycloakConfig = keycloakConfig;
  }

  /**
   * Set or update Keycloak configuration
   * @param config - Keycloak configuration
   */
  setKeycloakConfig(config: KeycloakConfig): void {
    this.keycloakConfig = config;
  }

  /**
   * Validate token locally using JWKS
   * @param token - JWT token to validate
   * @param options - Validation options
   * @returns Validation result with payload or error
   */
  async validateTokenLocal(
    token: string,
    options?: TokenValidationOptions,
  ): Promise<TokenValidationResult> {
    try {
      // 1. Check validation result cache (unless skipResultCache)
      if (!options?.skipResultCache) {
        const cached = this.getCachedResult(token);
        if (cached) {
          return { ...cached, cached: true };
        }
      }

      // 2. Perform actual validation
      const result = await this.performValidation(token, options);

      // 3. Cache result (unless skipResultCache or shouldn't cache)
      if (!options?.skipResultCache && this.shouldCacheResult(result)) {
        this.cacheResult(token, result);
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Token validation failed";
      return {
        valid: false,
        tokenType: options?.tokenType || "auto",
        error: errorMessage,
      };
    }
  }

  /**
   * Clear JWKS cache
   * @param jwksUri - Specific URI to clear, or all if not provided
   */
  clearCache(jwksUri?: string): void {
    if (jwksUri) {
      this.jwksCache.delete(jwksUri);
    } else {
      this.jwksCache.clear();
    }
  }

  /**
   * Clear validation result cache
   */
  clearResultCache(): void {
    this.resultCache.clear();
  }

  /**
   * Clear all caches (JWKS + results)
   */
  clearAllCaches(): void {
    this.jwksCache.clear();
    this.resultCache.clear();
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Perform token validation by resolving issuer and validation flow.
   */
  private async performValidation(
    token: string,
    options?: TokenValidationOptions,
  ): Promise<TokenValidationResult> {
    // Decode to get issuer (without verification)
    const decoded = decodeJwt(token);
    const issuer = decoded.iss;

    if (!issuer) {
      return {
        valid: false,
        tokenType: "auto",
        error: "Token missing issuer (iss) claim",
      };
    }

    const tokenType = this.determineTokenType(issuer, options?.tokenType);

    if (tokenType === "keycloak") {
      return this.validateKeycloakToken(token, options);
    }
      return this.validateDelegatedToken(token, issuer, options);

  }

  /**
   * Determine token type based on issuer and optional hint.
   */
  private determineTokenType(issuer: string, hint?: TokenType): TokenType {
    if (hint && hint !== "auto") return hint;

    if (this.keycloakConfig) {
      // Use public URL for issuer matching (tokens contain public URL in iss claim)
      const issuerUrl = this.keycloakConfig.authServerPublicUrl || this.keycloakConfig.authServerUrl;
      const keycloakIssuer = `${issuerUrl}/realms/${this.keycloakConfig.realm}`;
      if (issuer === keycloakIssuer) return "keycloak";
    }

    return "delegated";
  }

  /**
   * Validate Keycloak tokens using JWKS and issuer validation.
   */
  private async validateKeycloakToken(
    token: string,
    options?: TokenValidationOptions,
  ): Promise<TokenValidationResult> {
    if (!this.keycloakConfig) {
      return {
        valid: false,
        tokenType: "keycloak",
        error: "Keycloak not configured",
      };
    }

    // Use resolved URL for JWKS fetching (private on server, public on browser)
    const resolvedKeycloakUrl = resolveKeycloakUrl(this.keycloakConfig);
    const jwksUri = `${resolvedKeycloakUrl}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/certs`;

    // For issuer validation, use public URL (matches token's iss claim)
    // Tokens are always issued with the public URL in the iss claim
    const issuerUrl = this.keycloakConfig.authServerPublicUrl || this.keycloakConfig.authServerUrl;
    const expectedIssuer = `${issuerUrl}/realms/${this.keycloakConfig.realm}`;

    try {
      const jwks = await this.getJWKS(jwksUri);
      const verifyOptions: { issuer: string; audience?: string } = {
        issuer: expectedIssuer,
      };

      if (
        this.keycloakConfig.verifyAudience &&
        this.keycloakConfig.clientId &&
        !options?.skipAudienceValidation
      ) {
        verifyOptions.audience = this.keycloakConfig.clientId;
      }

      const { payload } = await jwtVerify(token, jwks, verifyOptions);

      return {
        valid: true,
        tokenType: "keycloak",
        payload: this.mapPayload(payload),
      };
    } catch (error) {
      return {
        valid: false,
        tokenType: "keycloak",
        error:
          error instanceof Error
            ? error.message
            : "Keycloak token validation failed",
      };
    }
  }

  /**
   * Validate delegated tokens using provider-specific JWKS.
   */
  private async validateDelegatedToken(
    token: string,
    issuer: string,
    options?: TokenValidationOptions,
  ): Promise<TokenValidationResult> {
    let provider: DelegatedProviderConfig | null = null;

    if (typeof options?.delegatedProvider === "function") {
      provider = await options.delegatedProvider(issuer);
    } else if (options?.delegatedProvider) {
      provider = options.delegatedProvider;
    }

    if (!provider) {
      return {
        valid: false,
        tokenType: "delegated",
        error: `No delegated provider configured for issuer: ${issuer}`,
      };
    }

    try {
      const jwks = await this.getJWKS(provider.jwksUri);
      const verifyOptions: { issuer: string; audience?: string } = {
        issuer: provider.issuer,
      };

      if (!options?.skipAudienceValidation && provider.audience) {
        verifyOptions.audience = provider.audience;
      }

      const { payload } = await jwtVerify(token, jwks, verifyOptions);

      return {
        valid: true,
        tokenType: "delegated",
        providerKey: provider.key,
        payload: this.mapPayload(payload),
      };
    } catch (error) {
      return {
        valid: false,
        tokenType: "delegated",
        providerKey: provider.key,
        error:
          error instanceof Error
            ? error.message
            : "Delegated token validation failed",
      };
    }
  }

  /**
   * Normalize JWT payload to TokenPayload structure.
   */
  private mapPayload(payload: Record<string, unknown>): TokenPayload {
    return {
      ...payload,
      sub: payload.sub as string,
      iss: payload.iss as string,
      email: payload.email as string | undefined,
      preferredUsername: payload.preferred_username as string | undefined,
      name: payload.name as string | undefined,
      realmAccess: payload.realm_access as { roles: string[] } | undefined,
      resourceAccess: payload.resource_access as
        | Record<string, { roles: string[] }>
        | undefined,
    };
  }

  /**
   * Fetch or reuse cached JWKS for a given URI.
   */
  private async getJWKS(jwksUri: string): Promise<JWTVerifyGetKey> {
    const cached = this.jwksCache.get(jwksUri);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.keySet;
    }

    const keySet = createRemoteJWKSet(new URL(jwksUri));
    this.jwksCache.set(jwksUri, {
      keySet,
      expiresAt: Date.now() + this.JWKS_CACHE_TTL_MS,
    });

    return keySet;
  }

  /**
   * Create a short hash for caching token validation results.
   */
  private getTokenHash(token: string): string {
    // Use first 16 + last 16 chars as pseudo-hash for cache key
    if (token.length <= 32) return token;
    return `${token.slice(0, 16)}...${token.slice(-16)}`;
  }

  /**
   * Read cached validation result for a token if still valid.
   */
  private getCachedResult(token: string): TokenValidationResult | null {
    const hash = this.getTokenHash(token);
    const entry = this.resultCache.get(hash);

    if (entry && entry.expiresAt > Date.now()) {
      return entry.result;
    }

    // Clean up expired entry
    if (entry) {
      this.resultCache.delete(hash);
    }

    return null;
  }

  /**
   * Cache validation result for a token.
   */
  private cacheResult(token: string, result: TokenValidationResult): void {
    const hash = this.getTokenHash(token);
    this.resultCache.set(hash, {
      result,
      expiresAt: Date.now() + this.RESULT_CACHE_TTL_MS,
    });
  }

  /**
   * Decide whether a validation result should be cached.
   */
  private shouldCacheResult(result: TokenValidationResult): boolean {
    // Cache valid results and definitive invalid results
    // Don't cache config errors (provider not found, etc.)
    if (result.valid) return true;
    if (result.error?.includes("expired")) return true;
    if (result.error?.includes('"exp"')) return true; // jose library format
    if (result.error?.includes("signature")) return true;
    if (result.error?.includes("invalid")) return true;
    return false;
  }
}

