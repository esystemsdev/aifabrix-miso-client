/**
 * Unit tests for ApplicationContextService
 */

import { ApplicationContextService } from "../../src/services/application-context.service";
import { HttpClient } from "../../src/utils/http-client";
import { MisoClientConfig } from "../../src/types/config.types";
import { extractClientTokenInfo } from "../../src/utils/token-utils";

// Mock HttpClient
jest.mock("../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock token-utils
jest.mock("../../src/utils/token-utils");
const mockedExtractClientTokenInfo = extractClientTokenInfo as jest.MockedFunction<
  typeof extractClientTokenInfo
>;

describe("ApplicationContextService", () => {
  let applicationContextService: ApplicationContextService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "miso-controller-miso-miso-test",
      clientSecret: "test-secret",
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      request: jest.fn(),
    } as any;
    (mockHttpClient as any).config = config;

    MockedHttpClient.mockImplementation(() => mockHttpClient);

    applicationContextService = new ApplicationContextService(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    applicationContextService.clearCache();
  });

  describe("parseClientIdFormat", () => {
    it("should parse valid clientId format correctly", () => {
      const context = applicationContextService.getApplicationContext();
      expect(context.environment).toBe("miso");
      expect(context.application).toBe("miso-test");
    });

    it("should handle clientId with multiple application parts", () => {
      (mockHttpClient as any).config = {
        ...config,
        clientId: "miso-controller-dev-my-app-service",
      };
      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();
      expect(context.environment).toBe("dev");
      expect(context.application).toBe("my-app-service");
    });

    it("should return empty strings for invalid format", () => {
      (mockHttpClient as any).config = {
        ...config,
        clientId: "invalid-format",
      };
      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();
      expect(context.environment).toBe("");
      expect(context.application).toBe("");
    });

    it("should return empty strings for non-standard clientId", () => {
      (mockHttpClient as any).config = {
        ...config,
        clientId: "my-app-id",
      };
      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();
      expect(context.environment).toBe("");
      expect(context.application).toBe("");
    });

    it("should handle empty clientId", () => {
      (mockHttpClient as any).config = {
        ...config,
        clientId: "",
      };
      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();
      expect(context.environment).toBe("");
      expect(context.application).toBe("");
    });

    it("should handle clientId with only 3 parts", () => {
      (mockHttpClient as any).config = {
        ...config,
        clientId: "miso-controller-env",
      };
      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();
      expect(context.environment).toBe("");
      expect(context.application).toBe("");
    });
  });

  describe("getClientToken", () => {
    it("should extract from client token in config", () => {
      const clientToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcHAiOiJteS1hcHAiLCJlbnYiOiJkZXYiLCJhcHBsaWNhdGlvbklkIjoiYXBwLTEyMyJ9.signature";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({
        application: "my-app",
        environment: "dev",
        applicationId: "app-123",
      });

      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();

      expect(context.environment).toBe("dev");
      expect(context.application).toBe("my-app");
      expect(context.applicationId).toBe("app-123");
      expect(mockedExtractClientTokenInfo).toHaveBeenCalledWith(clientToken);
    });

    it("should extract from internal client token", () => {
      const clientToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnZpcm9ubWVudCI6InByb2QifQ.signature";
      (mockHttpClient as any).internalClient = {
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({
        environment: "prod",
        application: "prod-app",
        applicationId: "app-456",
      });

      const context = applicationContextService.getApplicationContext();

      expect(context.environment).toBe("prod");
      expect(context.application).toBe("prod-app");
      expect(context.applicationId).toBe("app-456");
    });

    it("should fallback to clientId parsing when client token not available", () => {
      mockedExtractClientTokenInfo.mockReturnValue({});

      const context = applicationContextService.getApplicationContext();

      expect(context.environment).toBe("miso");
      expect(context.application).toBe("miso-test");
      expect(context.applicationId).toBe("");
    });

    it("should prefer client token values over clientId parsing", () => {
      const clientToken = "token";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({
        environment: "prod",
        application: "prod-app",
      });

      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();

      // Should use values from client token, not from clientId parsing
      expect(context.environment).toBe("prod");
      expect(context.application).toBe("prod-app");
    });

    it("should use clientId parsing when client token missing environment", () => {
      const clientToken = "token";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({
        application: "token-app",
        // No environment in token
      });

      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();

      // Should use environment from clientId parsing
      expect(context.environment).toBe("miso");
      // Should use application from token
      expect(context.application).toBe("token-app");
    });

    it("should use clientId parsing when client token missing application", () => {
      const clientToken = "token";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({
        environment: "token-env",
        // No application in token
      });

      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();

      // Should use environment from token
      expect(context.environment).toBe("token-env");
      // Should use application from clientId parsing
      expect(context.application).toBe("miso-test");
    });
  });

  describe("caching", () => {
    it("should cache results after first call", () => {
      const clientToken = "token";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({});
      const service = new ApplicationContextService(mockHttpClient);

      const context1 = service.getApplicationContext();
      const context2 = service.getApplicationContext();

      expect(context1).toBe(context2); // Same object reference
      expect(mockedExtractClientTokenInfo).toHaveBeenCalledTimes(1);
    });

    it("should clear cache when clearCache is called", () => {
      const clientToken = "token";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({});
      const service = new ApplicationContextService(mockHttpClient);

      const context1 = service.getApplicationContext();
      service.clearCache();
      const context2 = service.getApplicationContext();

      // Should be different objects after cache clear
      expect(context1).not.toBe(context2);
      expect(mockedExtractClientTokenInfo).toHaveBeenCalledTimes(2);
    });
  });

  describe("error handling", () => {
    it("should handle errors in client token extraction gracefully", () => {
      mockedExtractClientTokenInfo.mockImplementation(() => {
        throw new Error("Token extraction failed");
      });

      const context = applicationContextService.getApplicationContext();

      // Should fallback to clientId parsing
      expect(context.environment).toBe("miso");
      expect(context.application).toBe("miso-test");
      expect(context.applicationId).toBe("");
    });

    it("should handle errors in internal client access gracefully", () => {
      (mockHttpClient as any).internalClient = null;
      mockedExtractClientTokenInfo.mockReturnValue({});

      const context = applicationContextService.getApplicationContext();

      // Should fallback to clientId parsing
      expect(context.environment).toBe("miso");
      expect(context.application).toBe("miso-test");
    });

    it("should return empty strings when all extraction methods fail", () => {
      (mockHttpClient as any).config = {
        ...config,
        clientId: "invalid",
      };
      mockedExtractClientTokenInfo.mockReturnValue({});

      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();

      expect(context.environment).toBe("");
      expect(context.application).toBe("");
      expect(context.applicationId).toBe("");
    });
  });

  describe("applicationId extraction", () => {
    it("should extract applicationId from client token", () => {
      const clientToken = "token";
      (mockHttpClient as any).config = {
        ...config,
        clientToken,
      };
      mockedExtractClientTokenInfo.mockReturnValue({
        applicationId: "app-789",
      });

      const service = new ApplicationContextService(mockHttpClient);
      const context = service.getApplicationContext();

      expect(context.applicationId).toBe("app-789");
    });

    it("should return empty string when applicationId not in client token", () => {
      mockedExtractClientTokenInfo.mockReturnValue({});

      const context = applicationContextService.getApplicationContext();

      expect(context.applicationId).toBe("");
    });
  });
});
