/**
 * Unit tests for AuthStrategyHandler
 */

import { AuthStrategyHandler } from "../../src/utils/auth-strategy";
import { AuthStrategy, AuthMethod } from "../../src/types/config.types";

describe("AuthStrategyHandler", () => {
  describe("buildAuthHeaders", () => {
    it("should build headers for bearer token method", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer"],
        bearerToken: "test-bearer-token",
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        null,
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({
        Authorization: "Bearer test-bearer-token",
      });
    });

    it("should build headers for client-token method", () => {
      const strategy: AuthStrategy = {
        methods: ["client-token"],
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        "test-client-token",
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({
        "x-client-token": "test-client-token",
      });
    });

    it("should build headers for client-credentials method", () => {
      const strategy: AuthStrategy = {
        methods: ["client-credentials"],
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        null,
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({
        "X-Client-Id": "client-id",
        "X-Client-Secret": "client-secret",
      });
    });

    it("should build headers for api-key method", () => {
      const strategy: AuthStrategy = {
        methods: ["api-key"],
        apiKey: "test-api-key",
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        null,
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({
        Authorization: "Bearer test-api-key",
      });
    });

    it("should prioritize first method in array", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer", "client-token"],
        bearerToken: "test-bearer-token",
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        "test-client-token",
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({
        Authorization: "Bearer test-bearer-token",
      });
    });

    it("should fall back to second method if first method has no token", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer", "client-token"],
        // No bearerToken provided
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        "test-client-token",
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({
        "x-client-token": "test-client-token",
      });
    });

    it("should return empty headers if no method has required data", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer", "api-key"],
        // No bearerToken or apiKey provided
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        null,
        "client-id",
        "client-secret",
      );

      expect(headers).toEqual({});
    });

    it("should handle client-credentials without client secret", () => {
      const strategy: AuthStrategy = {
        methods: ["client-credentials"],
      };

      const headers = AuthStrategyHandler.buildAuthHeaders(
        strategy,
        null,
        "client-id",
        undefined,
      );

      expect(headers).toEqual({});
    });
  });

  describe("shouldTryMethod", () => {
    it("should return true if method is in strategy and has required data", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer"],
        bearerToken: "test-token",
      };

      expect(AuthStrategyHandler.shouldTryMethod("bearer", strategy)).toBe(
        true,
      );
    });

    it("should return false if method is not in strategy", () => {
      const strategy: AuthStrategy = {
        methods: ["client-token"],
      };

      expect(AuthStrategyHandler.shouldTryMethod("bearer", strategy)).toBe(
        false,
      );
    });

    it("should return false if method is in strategy but missing required data", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer"],
        // No bearerToken
      };

      expect(AuthStrategyHandler.shouldTryMethod("bearer", strategy)).toBe(
        false,
      );
    });

    it("should return true for client-token method (always available)", () => {
      const strategy: AuthStrategy = {
        methods: ["client-token"],
      };

      expect(
        AuthStrategyHandler.shouldTryMethod("client-token", strategy),
      ).toBe(true);
    });

    it("should return true for client-credentials method (always available)", () => {
      const strategy: AuthStrategy = {
        methods: ["client-credentials"],
      };

      expect(
        AuthStrategyHandler.shouldTryMethod("client-credentials", strategy),
      ).toBe(true);
    });

    it("should return true for api-key method with apiKey", () => {
      const strategy: AuthStrategy = {
        methods: ["api-key"],
        apiKey: "test-key",
      };

      expect(AuthStrategyHandler.shouldTryMethod("api-key", strategy)).toBe(
        true,
      );
    });

    it("should return false for api-key method without apiKey", () => {
      const strategy: AuthStrategy = {
        methods: ["api-key"],
        // No apiKey
      };

      expect(AuthStrategyHandler.shouldTryMethod("api-key", strategy)).toBe(
        false,
      );
    });
  });

  describe("getDefaultStrategy", () => {
    it("should return default strategy with bearer and client-token", () => {
      const strategy = AuthStrategyHandler.getDefaultStrategy();

      expect(strategy.methods).toEqual(["bearer", "client-token"]);
      expect(strategy.bearerToken).toBeUndefined();
    });

    it("should include bearer token if provided", () => {
      const strategy = AuthStrategyHandler.getDefaultStrategy("test-token");

      expect(strategy.methods).toEqual(["bearer", "client-token"]);
      expect(strategy.bearerToken).toBe("test-token");
    });
  });

  describe("mergeStrategy", () => {
    it("should return default strategy if strategy is undefined", () => {
      const defaultStrategy: AuthStrategy = {
        methods: ["bearer", "client-token"],
        bearerToken: "default-token",
      };

      const merged = AuthStrategyHandler.mergeStrategy(
        undefined,
        defaultStrategy,
      );

      expect(merged).toEqual(defaultStrategy);
    });

    it("should use provided strategy methods", () => {
      const strategy: AuthStrategy = {
        methods: ["client-token", "api-key"],
      };
      const defaultStrategy: AuthStrategy = {
        methods: ["bearer", "client-token"],
      };

      const merged = AuthStrategyHandler.mergeStrategy(
        strategy,
        defaultStrategy,
      );

      expect(merged.methods).toEqual(["client-token", "api-key"]);
    });

    it("should use provided bearerToken over default", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer"],
        bearerToken: "provided-token",
      };
      const defaultStrategy: AuthStrategy = {
        methods: ["bearer"],
        bearerToken: "default-token",
      };

      const merged = AuthStrategyHandler.mergeStrategy(
        strategy,
        defaultStrategy,
      );

      expect(merged.bearerToken).toBe("provided-token");
    });

    it("should fall back to default bearerToken if not provided", () => {
      const strategy: AuthStrategy = {
        methods: ["bearer"],
        // No bearerToken
      };
      const defaultStrategy: AuthStrategy = {
        methods: ["bearer"],
        bearerToken: "default-token",
      };

      const merged = AuthStrategyHandler.mergeStrategy(
        strategy,
        defaultStrategy,
      );

      expect(merged.bearerToken).toBe("default-token");
    });

    it("should use provided apiKey over default", () => {
      const strategy: AuthStrategy = {
        methods: ["api-key"],
        apiKey: "provided-key",
      };
      const defaultStrategy: AuthStrategy = {
        methods: ["api-key"],
        apiKey: "default-key",
      };

      const merged = AuthStrategyHandler.mergeStrategy(
        strategy,
        defaultStrategy,
      );

      expect(merged.apiKey).toBe("provided-key");
    });

    it("should use default methods if provided methods array is empty", () => {
      const strategy: AuthStrategy = {
        methods: [],
      };
      const defaultStrategy: AuthStrategy = {
        methods: ["bearer", "client-token"],
      };

      const merged = AuthStrategyHandler.mergeStrategy(
        strategy,
        defaultStrategy,
      );

      expect(merged.methods).toEqual(["bearer", "client-token"]);
    });
  });
});
