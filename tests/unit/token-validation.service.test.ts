/**
 * Unit tests for TokenValidationService
 */

import { TokenValidationService } from "../../src/services/token-validation.service";
import {
  KeycloakConfig,
  DelegatedProviderConfig,
} from "../../src/types/token-validation.types";

// Mock jose library
jest.mock("jose", () => ({
  jwtVerify: jest.fn(),
  decodeJwt: jest.fn(),
  createRemoteJWKSet: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const jose = require("jose");

describe("TokenValidationService", () => {
  let service: TokenValidationService;
  const keycloakConfig: KeycloakConfig = {
    authServerUrl: "https://keycloak.example.com",
    realm: "test-realm",
    clientId: "test-client",
  };

  const mockKeySet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenValidationService(keycloakConfig);
    jose.createRemoteJWKSet.mockReturnValue(mockKeySet);
  });

  describe("validateTokenLocal", () => {
    describe("Keycloak token validation", () => {
      it("should validate a valid Keycloak token", async () => {
        const token = "valid.keycloak.token";
        const expectedPayload = {
          sub: "user-123",
          iss: "https://keycloak.example.com/realms/test-realm",
          email: "user@example.com",
          preferred_username: "testuser",
          name: "Test User",
        };

        jose.decodeJwt.mockReturnValue({
          iss: "https://keycloak.example.com/realms/test-realm",
        });
        jose.jwtVerify.mockResolvedValue({ payload: expectedPayload });

        const result = await service.validateTokenLocal(token);

        expect(result.valid).toBe(true);
        expect(result.tokenType).toBe("keycloak");
        expect(result.payload?.sub).toBe("user-123");
        expect(result.payload?.email).toBe("user@example.com");
        expect(result.payload?.preferredUsername).toBe("testuser");
        expect(result.error).toBeUndefined();
      });

      it("should return error for expired Keycloak token", async () => {
        const token = "expired.keycloak.token";

        jose.decodeJwt.mockReturnValue({
          iss: "https://keycloak.example.com/realms/test-realm",
        });
        jose.jwtVerify.mockRejectedValue(new Error('"exp" claim timestamp check failed'));

        const result = await service.validateTokenLocal(token);

        expect(result.valid).toBe(false);
        expect(result.tokenType).toBe("keycloak");
        expect(result.error).toContain("exp");
      });

      it("should return error for invalid signature", async () => {
        const token = "invalid.signature.token";

        jose.decodeJwt.mockReturnValue({
          iss: "https://keycloak.example.com/realms/test-realm",
        });
        jose.jwtVerify.mockRejectedValue(new Error("signature verification failed"));

        const result = await service.validateTokenLocal(token);

        expect(result.valid).toBe(false);
        expect(result.tokenType).toBe("keycloak");
        expect(result.error).toContain("signature");
      });

      it("should return error when Keycloak is not configured", async () => {
        const serviceWithoutConfig = new TokenValidationService();
        const token = "valid.token";

        jose.decodeJwt.mockReturnValue({
          iss: "https://keycloak.example.com/realms/test-realm",
        });

        const result = await serviceWithoutConfig.validateTokenLocal(token, {
          tokenType: "keycloak",
        });

        expect(result.valid).toBe(false);
        expect(result.tokenType).toBe("keycloak");
        expect(result.error).toBe("Keycloak not configured");
      });

      it("should validate with audience when verifyAudience is true", async () => {
        const serviceWithAudience = new TokenValidationService({
          ...keycloakConfig,
          verifyAudience: true,
        });
        const token = "valid.keycloak.token";

        jose.decodeJwt.mockReturnValue({
          iss: "https://keycloak.example.com/realms/test-realm",
        });
        jose.jwtVerify.mockResolvedValue({
          payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
        });

        await serviceWithAudience.validateTokenLocal(token);

        expect(jose.jwtVerify).toHaveBeenCalledWith(
          token,
          mockKeySet,
          expect.objectContaining({
            issuer: "https://keycloak.example.com/realms/test-realm",
            audience: "test-client",
          }),
        );
      });
    });

    describe("Delegated token validation", () => {
      it("should validate delegated token with static config", async () => {
        const token = "valid.google.token";
        const delegatedProvider: DelegatedProviderConfig = {
          key: "google",
          issuer: "https://accounts.google.com",
          jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
        };

        jose.decodeJwt.mockReturnValue({
          iss: "https://accounts.google.com",
        });
        jose.jwtVerify.mockResolvedValue({
          payload: { sub: "google-user-123", iss: "https://accounts.google.com" },
        });

        const result = await service.validateTokenLocal(token, {
          delegatedProvider,
        });

        expect(result.valid).toBe(true);
        expect(result.tokenType).toBe("delegated");
        expect(result.providerKey).toBe("google");
        expect(result.payload?.sub).toBe("google-user-123");
      });

      it("should validate delegated token with lookup function", async () => {
        const token = "valid.github.token";
        const lookupFn = jest.fn().mockResolvedValue({
          key: "github",
          issuer: "https://token.actions.githubusercontent.com",
          jwksUri: "https://token.actions.githubusercontent.com/.well-known/jwks",
        });

        jose.decodeJwt.mockReturnValue({
          iss: "https://token.actions.githubusercontent.com",
        });
        jose.jwtVerify.mockResolvedValue({
          payload: { sub: "github-user-123", iss: "https://token.actions.githubusercontent.com" },
        });

        const result = await service.validateTokenLocal(token, {
          delegatedProvider: lookupFn,
        });

        expect(lookupFn).toHaveBeenCalledWith("https://token.actions.githubusercontent.com");
        expect(result.valid).toBe(true);
        expect(result.tokenType).toBe("delegated");
        expect(result.providerKey).toBe("github");
      });

      it("should return error when no delegated provider found", async () => {
        const token = "unknown.provider.token";

        jose.decodeJwt.mockReturnValue({
          iss: "https://unknown-provider.com",
        });

        const result = await service.validateTokenLocal(token);

        expect(result.valid).toBe(false);
        expect(result.tokenType).toBe("delegated");
        expect(result.error).toContain("No delegated provider configured");
        expect(result.error).toContain("https://unknown-provider.com");
      });

      it("should return error when lookup function returns null", async () => {
        const token = "unknown.provider.token";
        const lookupFn = jest.fn().mockResolvedValue(null);

        jose.decodeJwt.mockReturnValue({
          iss: "https://unknown-provider.com",
        });

        const result = await service.validateTokenLocal(token, {
          delegatedProvider: lookupFn,
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain("No delegated provider configured");
      });
    });

    describe("Error handling", () => {
      it("should handle missing issuer claim", async () => {
        const token = "token.without.issuer";

        jose.decodeJwt.mockReturnValue({});

        const result = await service.validateTokenLocal(token);

        expect(result.valid).toBe(false);
        expect(result.tokenType).toBe("auto");
        expect(result.error).toBe("Token missing issuer (iss) claim");
      });

      it("should handle decode errors gracefully", async () => {
        const token = "malformed.token";

        jose.decodeJwt.mockImplementation(() => {
          throw new Error("Invalid token format");
        });

        const result = await service.validateTokenLocal(token);

        expect(result.valid).toBe(false);
        expect(result.error).toBe("Invalid token format");
      });
    });
  });

  describe("Result Cache", () => {
    it("should return cached result with cached: true flag", async () => {
      const token = "cacheable.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call - should validate
      const result1 = await service.validateTokenLocal(token);
      expect(result1.valid).toBe(true);
      expect(result1.cached).toBeUndefined();

      // Second call - should return cached
      const result2 = await service.validateTokenLocal(token);
      expect(result2.valid).toBe(true);
      expect(result2.cached).toBe(true);

      // jwtVerify should only be called once
      expect(jose.jwtVerify).toHaveBeenCalledTimes(1);
    });

    it("should bypass cache when skipResultCache is true", async () => {
      const token = "cacheable.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call
      await service.validateTokenLocal(token);

      // Second call with skipResultCache
      const result2 = await service.validateTokenLocal(token, {
        skipResultCache: true,
      });

      expect(result2.cached).toBeUndefined();
      // jwtVerify should be called twice
      expect(jose.jwtVerify).toHaveBeenCalledTimes(2);
    });

    it("should cache expired token results", async () => {
      const token = "expired.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockRejectedValue(new Error('"exp" claim timestamp check failed'));

      // First call
      const result1 = await service.validateTokenLocal(token);
      expect(result1.valid).toBe(false);

      // Second call - should return cached
      const result2 = await service.validateTokenLocal(token);
      expect(result2.valid).toBe(false);
      expect(result2.cached).toBe(true);
    });

    it("should NOT cache config errors", async () => {
      const serviceWithoutConfig = new TokenValidationService();
      const token = "valid.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });

      // First call - config error
      await serviceWithoutConfig.validateTokenLocal(token, { tokenType: "keycloak" });

      // Second call - should NOT be cached (config might be fixed)
      const result2 = await serviceWithoutConfig.validateTokenLocal(token, { tokenType: "keycloak" });
      expect(result2.cached).toBeUndefined();
    });

    it("should clear result cache", async () => {
      const token = "cacheable.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call
      await service.validateTokenLocal(token);

      // Clear cache
      service.clearResultCache();

      // Second call - should NOT be cached
      const result2 = await service.validateTokenLocal(token);
      expect(result2.cached).toBeUndefined();
      expect(jose.jwtVerify).toHaveBeenCalledTimes(2);
    });
  });

  describe("JWKS Cache", () => {
    it("should cache JWKS for 1 hour", async () => {
      const token = "valid.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call - should create JWKS
      await service.validateTokenLocal(token, { skipResultCache: true });

      // Second call - should reuse cached JWKS
      await service.validateTokenLocal(token, { skipResultCache: true });

      // createRemoteJWKSet should only be called once
      expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(1);
    });

    it("should clear specific JWKS URI", async () => {
      const token = "valid.token";
      const jwksUri = "https://keycloak.example.com/realms/test-realm/protocol/openid-connect/certs";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call
      await service.validateTokenLocal(token, { skipResultCache: true });

      // Clear specific URI
      service.clearCache(jwksUri);

      // Second call - should create new JWKS
      await service.validateTokenLocal(token, { skipResultCache: true });

      expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2);
    });

    it("should clear all JWKS cache", async () => {
      const token = "valid.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call
      await service.validateTokenLocal(token, { skipResultCache: true });

      // Clear all
      service.clearCache();

      // Second call - should create new JWKS
      await service.validateTokenLocal(token, { skipResultCache: true });

      expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2);
    });
  });

  describe("clearAllCaches", () => {
    it("should clear both JWKS and result caches", async () => {
      const token = "valid.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      // First call - populates both caches
      await service.validateTokenLocal(token);

      // Clear all caches
      service.clearAllCaches();

      // Second call - should NOT use any cache
      const result = await service.validateTokenLocal(token);
      expect(result.cached).toBeUndefined();
      expect(jose.createRemoteJWKSet).toHaveBeenCalledTimes(2);
      expect(jose.jwtVerify).toHaveBeenCalledTimes(2);
    });
  });

  describe("setKeycloakConfig", () => {
    it("should update Keycloak configuration", async () => {
      const serviceWithoutConfig = new TokenValidationService();
      const token = "valid.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://new-keycloak.example.com/realms/new-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://new-keycloak.example.com/realms/new-realm" },
      });

      // Initially no config - should fail for keycloak type
      const result1 = await serviceWithoutConfig.validateTokenLocal(token, { tokenType: "keycloak" });
      expect(result1.valid).toBe(false);
      expect(result1.error).toBe("Keycloak not configured");

      // Set config
      serviceWithoutConfig.setKeycloakConfig({
        authServerUrl: "https://new-keycloak.example.com",
        realm: "new-realm",
      });

      // Now should work
      const result2 = await serviceWithoutConfig.validateTokenLocal(token, { tokenType: "keycloak" });
      expect(result2.valid).toBe(true);
    });
  });

  describe("Token type detection", () => {
    it("should detect Keycloak token by issuer", async () => {
      const token = "keycloak.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });
      jose.jwtVerify.mockResolvedValue({
        payload: { sub: "user-123", iss: "https://keycloak.example.com/realms/test-realm" },
      });

      const result = await service.validateTokenLocal(token);

      expect(result.tokenType).toBe("keycloak");
    });

    it("should default to delegated for unknown issuer", async () => {
      const token = "unknown.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://unknown-provider.com",
      });

      const result = await service.validateTokenLocal(token);

      expect(result.tokenType).toBe("delegated");
    });

    it("should respect tokenType hint", async () => {
      const token = "forced.delegated.token";

      jose.decodeJwt.mockReturnValue({
        iss: "https://keycloak.example.com/realms/test-realm",
      });

      const result = await service.validateTokenLocal(token, {
        tokenType: "delegated",
      });

      // Even though issuer matches Keycloak, should be treated as delegated
      expect(result.tokenType).toBe("delegated");
    });
  });
});

