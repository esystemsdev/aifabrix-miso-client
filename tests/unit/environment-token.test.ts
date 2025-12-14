/**
 * Unit tests for environment-token wrapper
 */

import { getEnvironmentToken } from "../../src/utils/environment-token";
import { MisoClient } from "../../src/index";
import { Request } from "express";
import { DataMasker } from "../../src/utils/data-masker";

// Mock MisoClient
jest.mock("../../src/index", () => ({
  MisoClient: jest.fn(),
}));

// Mock DataMasker
jest.mock("../../src/utils/data-masker", () => ({
  DataMasker: {
    maskSensitiveData: jest.fn((data) => data),
  },
}));

// Mock validateOrigin
jest.mock("../../src/utils/origin-validator", () => ({
  validateOrigin: jest.fn(),
}));

import { validateOrigin } from "../../src/utils/origin-validator";

const mockValidateOrigin = validateOrigin as jest.MockedFunction<
  typeof validateOrigin
>;

describe("environment-token", () => {
  let mockMisoClient: jest.Mocked<MisoClient>;
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});

    mockMisoClient = {
      getConfig: jest.fn().mockReturnValue({
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        allowedOrigins: ["http://localhost:3000"],
      }),
      getEnvironmentToken: jest.fn().mockResolvedValue("test-client-token"),
      log: {
        error: jest.fn().mockResolvedValue(undefined),
        audit: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    mockRequest = {
      headers: {
        origin: "http://localhost:3000",
        "x-request-id": "req-123",
        "x-correlation-id": "corr-123",
        "user-agent": "test-agent",
      },
      ip: "127.0.0.1",
      socket: {
        remoteAddress: "127.0.0.1",
      } as any,
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getEnvironmentToken", () => {
    it("should validate origin and return token when valid", async () => {
      mockValidateOrigin.mockReturnValue({ valid: true });

      const token = await getEnvironmentToken(
        mockMisoClient,
        mockRequest as Request,
      );

      expect(token).toBe("test-client-token");
      expect(mockValidateOrigin).toHaveBeenCalledWith(
        mockRequest as Request,
        ["http://localhost:3000"],
      );
      expect(mockMisoClient.getEnvironmentToken).toHaveBeenCalled();
    });

    it("should log error and audit event when origin validation fails", async () => {
      mockValidateOrigin.mockReturnValue({
        valid: false,
        error: "Origin not allowed",
      });

      await expect(
        getEnvironmentToken(mockMisoClient, mockRequest as Request),
      ).rejects.toThrow("Origin validation failed");

      expect(mockMisoClient.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Origin validation failed"),
        expect.objectContaining({
          origin: "http://localhost:3000",
          allowedOrigins: ["http://localhost:3000"],
        }),
        undefined,
        expect.objectContaining({
          requestId: "req-123",
          correlationId: "corr-123",
        }),
      );

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.rejected",
        "environment-token",
        expect.objectContaining({
          reason: "origin_validation_failed",
          origin: "http://localhost:3000",
        }),
        expect.objectContaining({
          requestId: "req-123",
          correlationId: "corr-123",
        }),
      );

      expect(mockMisoClient.getEnvironmentToken).not.toHaveBeenCalled();
    });

    it("should use referer header when origin is missing", async () => {
      mockRequest.headers = {
        referer: "http://localhost:3000/page",
      };
      mockValidateOrigin.mockReturnValue({ valid: true });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.success",
        "environment-token",
        expect.objectContaining({
          origin: "http://localhost:3000/page",
        }),
        expect.any(Object),
      );
    });

    it("should log audit event with masked client credentials on success", async () => {
      mockValidateOrigin.mockReturnValue({ valid: true });
      (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data) => {
        if (data.clientId) {
          return { clientId: "***MASKED***" };
        }
        if (data.clientSecret) {
          return { clientSecret: "***MASKED***" };
        }
        return data;
      });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.success",
        "environment-token",
        expect.objectContaining({
          clientId: "***MASKED***",
          clientSecret: "***MASKED***",
        }),
        expect.any(Object),
      );
    });

    it("should handle missing clientSecret in config", async () => {
      mockMisoClient.getConfig.mockReturnValue({
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        allowedOrigins: ["http://localhost:3000"],
      });
      mockValidateOrigin.mockReturnValue({ valid: true });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.success",
        "environment-token",
        expect.objectContaining({
          clientSecret: undefined,
        }),
        expect.any(Object),
      );
    });

    it("should log error and audit event when token fetch fails", async () => {
      mockValidateOrigin.mockReturnValue({ valid: true });
      const fetchError = new Error("Failed to fetch token");
      mockMisoClient.getEnvironmentToken.mockRejectedValue(fetchError);

      await expect(
        getEnvironmentToken(mockMisoClient, mockRequest as Request),
      ).rejects.toThrow("Failed to fetch token");

      expect(mockMisoClient.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get environment token"),
        expect.objectContaining({
          clientId: expect.any(String),
        }),
        expect.any(String),
        expect.any(Object),
      );

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.failed",
        "environment-token",
        expect.objectContaining({
          reason: "token_fetch_failed",
          error: "Failed to fetch token",
        }),
        expect.any(Object),
      );
    });

    it("should handle missing request headers gracefully", async () => {
      mockRequest = {
        headers: {},
        socket: {} as any,
      } as any;
      mockValidateOrigin.mockReturnValue({ valid: true });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.success",
        "environment-token",
        expect.objectContaining({
          origin: "unknown",
        }),
        expect.any(Object),
      );
    });

    it("should handle empty allowedOrigins array", async () => {
      mockMisoClient.getConfig.mockReturnValue({
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        allowedOrigins: [],
      });
      mockValidateOrigin.mockReturnValue({ valid: true });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockValidateOrigin).toHaveBeenCalledWith(
        mockRequest as Request,
        [],
      );
    });

    it("should handle undefined allowedOrigins", async () => {
      mockMisoClient.getConfig.mockReturnValue({
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
      });
      mockValidateOrigin.mockReturnValue({ valid: true });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockValidateOrigin).toHaveBeenCalledWith(
        mockRequest as Request,
        undefined,
      );
    });

    it("should include IP address and user agent in audit logs", async () => {
      mockValidateOrigin.mockReturnValue({ valid: true });

      await getEnvironmentToken(mockMisoClient, mockRequest as Request);

      expect(mockMisoClient.log.audit).toHaveBeenCalledWith(
        "client.token.request.success",
        "environment-token",
        expect.objectContaining({
          ipAddress: "127.0.0.1",
          userAgent: "test-agent",
        }),
        expect.any(Object),
      );
    });

    it("should handle non-Error thrown values in token fetch", async () => {
      mockValidateOrigin.mockReturnValue({ valid: true });
      mockMisoClient.getEnvironmentToken.mockRejectedValue("String error");

      await expect(
        getEnvironmentToken(mockMisoClient, mockRequest as Request),
      ).rejects.toBe("String error");

      expect(mockMisoClient.log.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to get environment token"),
        expect.any(Object),
        undefined,
        expect.any(Object),
      );
    });
  });
});
