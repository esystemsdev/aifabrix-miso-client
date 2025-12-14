/**
 * Unit tests for token-utils
 */

import { extractClientTokenInfo, ClientTokenInfo } from "../../src/utils/token-utils";
import jwt from "jsonwebtoken";

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    decode: jest.fn(),
  },
}));

const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe("token-utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("extractClientTokenInfo", () => {
    it("should extract application field", () => {
      mockJwt.decode.mockReturnValue({
        application: "my-app",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        application: "my-app",
      });
    });

    it("should extract app field as fallback for application", () => {
      mockJwt.decode.mockReturnValue({
        app: "my-app",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        application: "my-app",
      });
    });

    it("should prefer application over app", () => {
      mockJwt.decode.mockReturnValue({
        application: "my-app",
        app: "fallback-app",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        application: "my-app",
      });
    });

    it("should extract environment field", () => {
      mockJwt.decode.mockReturnValue({
        environment: "production",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        environment: "production",
      });
    });

    it("should extract env field as fallback for environment", () => {
      mockJwt.decode.mockReturnValue({
        env: "production",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        environment: "production",
      });
    });

    it("should prefer environment over env", () => {
      mockJwt.decode.mockReturnValue({
        environment: "production",
        env: "dev",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        environment: "production",
      });
    });

    it("should extract applicationId field", () => {
      mockJwt.decode.mockReturnValue({
        applicationId: "app-123",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        applicationId: "app-123",
      });
    });

    it("should extract app_id field as fallback for applicationId", () => {
      mockJwt.decode.mockReturnValue({
        app_id: "app-123",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        applicationId: "app-123",
      });
    });

    it("should prefer applicationId over app_id", () => {
      mockJwt.decode.mockReturnValue({
        applicationId: "app-123",
        app_id: "app-456",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        applicationId: "app-123",
      });
    });

    it("should extract clientId field", () => {
      mockJwt.decode.mockReturnValue({
        clientId: "client-123",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        clientId: "client-123",
      });
    });

    it("should extract client_id field as fallback for clientId", () => {
      mockJwt.decode.mockReturnValue({
        client_id: "client-123",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        clientId: "client-123",
      });
    });

    it("should prefer clientId over client_id", () => {
      mockJwt.decode.mockReturnValue({
        clientId: "client-123",
        client_id: "client-456",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        clientId: "client-123",
      });
    });

    it("should extract all fields together", () => {
      mockJwt.decode.mockReturnValue({
        application: "my-app",
        environment: "production",
        applicationId: "app-123",
        clientId: "client-123",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        application: "my-app",
        environment: "production",
        applicationId: "app-123",
        clientId: "client-123",
      });
    });

    it("should extract all fields with fallback names", () => {
      mockJwt.decode.mockReturnValue({
        app: "my-app",
        env: "production",
        app_id: "app-123",
        client_id: "client-123",
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({
        application: "my-app",
        environment: "production",
        applicationId: "app-123",
        clientId: "client-123",
      });
    });

    it("should return empty object when token is null", () => {
      mockJwt.decode.mockReturnValue(null);

      const result = extractClientTokenInfo("invalid-token");
      expect(result).toEqual({});
      expect(console.warn).toHaveBeenCalledWith(
        "Failed to decode client token: Invalid token format",
      );
    });

    it("should return empty object when decoded is not an object", () => {
      mockJwt.decode.mockReturnValue("string-value" as any);

      const result = extractClientTokenInfo("invalid-token");
      expect(result).toEqual({});
    });

    it("should handle decode errors gracefully", () => {
      mockJwt.decode.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const result = extractClientTokenInfo("invalid-token");
      expect(result).toEqual({});
      expect(console.warn).toHaveBeenCalled();
    });

    it("should ignore non-string field values", () => {
      mockJwt.decode.mockReturnValue({
        application: 123,
        environment: { nested: "value" },
        applicationId: ["array"],
        clientId: null,
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({});
    });

    it("should handle missing fields gracefully", () => {
      mockJwt.decode.mockReturnValue({
        sub: "user-123",
        iat: 1234567890,
      } as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({});
    });

    it("should handle empty decoded object", () => {
      mockJwt.decode.mockReturnValue({} as any);

      const result = extractClientTokenInfo("test-token");
      expect(result).toEqual({});
    });
  });
});
