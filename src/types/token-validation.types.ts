/**
 * Token validation types for local JWKS-based JWT verification
 * @module token-validation.types
 */

import { JWTPayload } from "jose";

/** Token type for validation routing */
export type TokenType = "keycloak" | "delegated" | "auto";

/** Keycloak server configuration for local token validation */
export interface KeycloakConfig {
  /** Keycloak server URL (e.g., "https://keycloak.example.com") */
  authServerUrl: string;
  /** Keycloak realm name */
  realm: string;
  /** Client ID for audience validation (optional) */
  clientId?: string;
  /** Client secret for confidential clients (optional) */
  clientSecret?: string;
  /** Enable audience validation (default: false) */
  verifyAudience?: boolean;
}

/** Configuration for delegated OAuth providers */
export interface DelegatedProviderConfig {
  /** Provider identifier (e.g., "google", "github") */
  key: string;
  /** Expected issuer claim value */
  issuer: string;
  /** JWKS endpoint URL */
  jwksUri: string;
  /** Expected audience (optional) */
  audience?: string;
}

/** Function to look up delegated provider by issuer */
export type DelegatedProviderLookup = (
  issuer: string,
) => Promise<DelegatedProviderConfig | null>;

/** Options for token validation */
export interface TokenValidationOptions {
  /** Force token type detection */
  tokenType?: TokenType;
  /** Delegated provider config or lookup function */
  delegatedProvider?: DelegatedProviderConfig | DelegatedProviderLookup;
  /** Skip audience validation */
  skipAudienceValidation?: boolean;
  /** Skip validation result cache (for high-security scenarios) */
  skipResultCache?: boolean;
}

/** Result of token validation */
export interface TokenValidationResult {
  /** Whether token is valid */
  valid: boolean;
  /** Detected or specified token type */
  tokenType: TokenType;
  /** Decoded token payload (if valid) */
  payload?: TokenPayload;
  /** Error message (if invalid) */
  error?: string;
  /** Provider key for delegated tokens */
  providerKey?: string;
  /** True if result came from cache */
  cached?: boolean;
}

/** JWT payload with common claims */
export interface TokenPayload extends JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Issuer */
  iss: string;
  /** User email (optional) */
  email?: string;
  /** Preferred username (optional) */
  preferredUsername?: string;
  /** Display name (optional) */
  name?: string;
  /** Keycloak realm roles (optional) */
  realmAccess?: { roles: string[] };
  /** Keycloak resource/client roles (optional) */
  resourceAccess?: Record<string, { roles: string[] }>;
}

/** Internal cache entry for validation results */
export interface ValidationCacheEntry {
  /** Cached result */
  result: TokenValidationResult;
  /** Expiration timestamp */
  expiresAt: number;
}

