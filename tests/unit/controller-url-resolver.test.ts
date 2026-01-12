/**
 * Unit tests for Controller URL Resolver utility
 */

import {
  resolveControllerUrl,
  resolveKeycloakUrl,
  isBrowser,
} from "../../src/utils/controller-url-resolver";
import { MisoClientConfig } from "../../src/types/config.types";
import { KeycloakConfig } from "../../src/types/token-validation.types";

describe("Controller URL Resolver", () => {
  const originalGlobalThis = globalThis;
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalLocalStorage = (globalThis as {
    localStorage?: unknown;
  }).localStorage;
  const originalFetch = (globalThis as { fetch?: unknown }).fetch;

  beforeEach(() => {
    // Reset browser globals before each test
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  afterAll(() => {
    // Restore original globals
    if (originalWindow !== undefined) {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
    if (originalLocalStorage !== undefined) {
      (globalThis as { localStorage?: unknown }).localStorage =
        originalLocalStorage;
    }
    if (originalFetch !== undefined) {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });

  describe("isBrowser", () => {
    it("should return false in server environment", () => {
      expect(isBrowser()).toBe(false);
    });

    it("should return true when window is present", () => {
      (globalThis as { window?: unknown }).window = {};
      expect(isBrowser()).toBe(false); // Still false without localStorage and fetch
    });

    it("should return true when window and localStorage are present", () => {
      (globalThis as { window?: unknown }).window = {};
      (globalThis as { localStorage?: unknown }).localStorage = {};
      expect(isBrowser()).toBe(false); // Still false without fetch
    });

    it("should return true when all browser globals are present", () => {
      (globalThis as { window?: unknown }).window = {};
      (globalThis as { localStorage?: unknown }).localStorage = {};
      (globalThis as { fetch?: unknown }).fetch = () => {};
      expect(isBrowser()).toBe(true);
    });
  });

  describe("resolveControllerUrl", () => {
    describe("browser environment", () => {
      beforeEach(() => {
        // Mock browser environment
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = {};
        (globalThis as { fetch?: unknown }).fetch = () => {};
      });

      it("should use controllerPublicUrl in browser when provided", () => {
        const config: MisoClientConfig = {
          controllerPublicUrl: "https://public.example.com",
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("https://public.example.com");
      });

      it("should fallback to controllerUrl in browser when controllerPublicUrl not provided", () => {
        const config: MisoClientConfig = {
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://fallback.example.com");
      });

      it("should throw error in browser when no URL provided", () => {
        const config: MisoClientConfig = {
          clientId: "test-client",
        };

        expect(() => resolveControllerUrl(config)).toThrow(
          "No controller URL configured. Please provide controllerPublicUrl or controllerUrl in your configuration."
        );
      });

      it("should prefer controllerPublicUrl over controllerUrl in browser", () => {
        const config: MisoClientConfig = {
          controllerPublicUrl: "https://public.example.com",
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("https://public.example.com");
      });
    });

    describe("server environment", () => {
      it("should use controllerPrivateUrl in server when provided", () => {
        const config: MisoClientConfig = {
          controllerPrivateUrl: "http://private.example.com:3010",
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://private.example.com:3010");
      });

      it("should fallback to controllerUrl in server when controllerPrivateUrl not provided", () => {
        const config: MisoClientConfig = {
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://fallback.example.com");
      });

      it("should throw error in server when no URL provided", () => {
        const config: MisoClientConfig = {
          clientId: "test-client",
        };

        expect(() => resolveControllerUrl(config)).toThrow(
          "No controller URL configured. Please provide controllerPrivateUrl or controllerUrl in your configuration."
        );
      });

      it("should prefer controllerPrivateUrl over controllerUrl in server", () => {
        const config: MisoClientConfig = {
          controllerPrivateUrl: "http://private.example.com:3010",
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://private.example.com:3010");
      });
    });

    describe("URL validation", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should accept valid HTTP URL", () => {
        const config: MisoClientConfig = {
          controllerUrl: "http://example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://example.com");
      });

      it("should accept valid HTTPS URL", () => {
        const config: MisoClientConfig = {
          controllerUrl: "https://example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("https://example.com");
      });

      it("should accept URL with port", () => {
        const config: MisoClientConfig = {
          controllerUrl: "http://example.com:3000",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://example.com:3000");
      });

      it("should accept URL with path", () => {
        const config: MisoClientConfig = {
          controllerUrl: "https://example.com/api",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("https://example.com/api");
      });

      it("should reject invalid URL format", () => {
        const config: MisoClientConfig = {
          controllerUrl: "not-a-url",
          clientId: "test-client",
        };

        expect(() => resolveControllerUrl(config)).toThrow(
          'Invalid controller URL format: "not-a-url". URL must be a valid HTTP or HTTPS URL.'
        );
      });

      it("should reject URL with invalid protocol", () => {
        const config: MisoClientConfig = {
          controllerUrl: "ftp://example.com",
          clientId: "test-client",
        };

        expect(() => resolveControllerUrl(config)).toThrow(
          'Invalid controller URL format: "ftp://example.com". URL must be a valid HTTP or HTTPS URL.'
        );
      });

      it("should reject empty URL", () => {
        const config: MisoClientConfig = {
          controllerUrl: "",
          clientId: "test-client",
        };

        expect(() => resolveControllerUrl(config)).toThrow(
          "No controller URL configured. Please provide controllerPrivateUrl or controllerUrl in your configuration."
        );
      });
    });

    describe("backward compatibility", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should work with only controllerUrl (backward compatible)", () => {
        const config: MisoClientConfig = {
          controllerUrl: "http://legacy.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://legacy.example.com");
      });

      it("should work with controllerUrl in browser (backward compatible)", () => {
        // Mock browser environment
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = {};
        (globalThis as { fetch?: unknown }).fetch = () => {};

        const config: MisoClientConfig = {
          controllerUrl: "http://legacy.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://legacy.example.com");
      });
    });

    describe("priority order", () => {
      beforeEach(() => {
        // Mock browser environment
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = {};
        (globalThis as { fetch?: unknown }).fetch = () => {};
      });

      it("should prioritize controllerPublicUrl over controllerUrl in browser", () => {
        const config: MisoClientConfig = {
          controllerPublicUrl: "https://public.example.com",
          controllerPrivateUrl: "http://private.example.com",
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("https://public.example.com");
      });
    });

    describe("server priority order", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should prioritize controllerPrivateUrl over controllerUrl in server", () => {
        const config: MisoClientConfig = {
          controllerPublicUrl: "https://public.example.com",
          controllerPrivateUrl: "http://private.example.com",
          controllerUrl: "http://fallback.example.com",
          clientId: "test-client",
        };

        const url = resolveControllerUrl(config);
        expect(url).toBe("http://private.example.com");
      });
    });
  });

  describe("resolveKeycloakUrl", () => {
    describe("browser environment", () => {
      beforeEach(() => {
        // Mock browser environment
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = {};
        (globalThis as { fetch?: unknown }).fetch = () => {};
      });

      it("should use authServerPublicUrl in browser when provided", () => {
        const config: KeycloakConfig = {
          authServerPublicUrl: "https://keycloak-public.example.com",
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("https://keycloak-public.example.com");
      });

      it("should fallback to authServerUrl in browser when authServerPublicUrl not provided", () => {
        const config: KeycloakConfig = {
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak-fallback.example.com");
      });

      it("should throw error in browser when no URL provided", () => {
        const config: KeycloakConfig = {
          authServerUrl: "",
          realm: "test-realm",
        };

        expect(() => resolveKeycloakUrl(config)).toThrow(
          "No Keycloak URL configured. Please provide authServerPublicUrl or authServerUrl in your Keycloak configuration."
        );
      });

      it("should prefer authServerPublicUrl over authServerUrl in browser", () => {
        const config: KeycloakConfig = {
          authServerPublicUrl: "https://keycloak-public.example.com",
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("https://keycloak-public.example.com");
      });
    });

    describe("server environment", () => {
      it("should use authServerPrivateUrl in server when provided", () => {
        const config: KeycloakConfig = {
          authServerPrivateUrl: "http://keycloak-private:8080",
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak-private:8080");
      });

      it("should fallback to authServerUrl in server when authServerPrivateUrl not provided", () => {
        const config: KeycloakConfig = {
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak-fallback.example.com");
      });

      it("should throw error in server when no URL provided", () => {
        const config: KeycloakConfig = {
          authServerUrl: "",
          realm: "test-realm",
        };

        expect(() => resolveKeycloakUrl(config)).toThrow(
          "No Keycloak URL configured. Please provide authServerPrivateUrl or authServerUrl in your Keycloak configuration."
        );
      });

      it("should prefer authServerPrivateUrl over authServerUrl in server", () => {
        const config: KeycloakConfig = {
          authServerPrivateUrl: "http://keycloak-private:8080",
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak-private:8080");
      });
    });

    describe("URL validation", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should accept valid HTTP URL", () => {
        const config: KeycloakConfig = {
          authServerUrl: "http://keycloak.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak.example.com");
      });

      it("should accept valid HTTPS URL", () => {
        const config: KeycloakConfig = {
          authServerUrl: "https://keycloak.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("https://keycloak.example.com");
      });

      it("should accept URL with port", () => {
        const config: KeycloakConfig = {
          authServerUrl: "http://keycloak.example.com:8080",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak.example.com:8080");
      });

      it("should reject invalid URL format", () => {
        const config: KeycloakConfig = {
          authServerUrl: "not-a-url",
          realm: "test-realm",
        };

        expect(() => resolveKeycloakUrl(config)).toThrow(
          'Invalid Keycloak URL format: "not-a-url". URL must be a valid HTTP or HTTPS URL.'
        );
      });

      it("should reject URL with invalid protocol", () => {
        const config: KeycloakConfig = {
          authServerUrl: "ftp://keycloak.example.com",
          realm: "test-realm",
        };

        expect(() => resolveKeycloakUrl(config)).toThrow(
          'Invalid Keycloak URL format: "ftp://keycloak.example.com". URL must be a valid HTTP or HTTPS URL.'
        );
      });

      it("should reject empty URL", () => {
        const config: KeycloakConfig = {
          authServerUrl: "",
          realm: "test-realm",
        };

        expect(() => resolveKeycloakUrl(config)).toThrow(
          "No Keycloak URL configured. Please provide authServerPrivateUrl or authServerUrl in your Keycloak configuration."
        );
      });
    });

    describe("localhost conversion", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should convert localhost to 127.0.0.1", () => {
        const config: KeycloakConfig = {
          authServerUrl: "http://localhost:8080",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://127.0.0.1:8080");
      });

      it("should convert localhost in private URL", () => {
        const config: KeycloakConfig = {
          authServerPrivateUrl: "http://localhost:8080",
          authServerUrl: "http://keycloak.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://127.0.0.1:8080");
      });
    });

    describe("backward compatibility", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should work with only authServerUrl (backward compatible)", () => {
        const config: KeycloakConfig = {
          authServerUrl: "http://legacy-keycloak.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://legacy-keycloak.example.com");
      });

      it("should work with authServerUrl in browser (backward compatible)", () => {
        // Mock browser environment
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = {};
        (globalThis as { fetch?: unknown }).fetch = () => {};

        const config: KeycloakConfig = {
          authServerUrl: "http://legacy-keycloak.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://legacy-keycloak.example.com");
      });
    });

    describe("priority order", () => {
      beforeEach(() => {
        // Mock browser environment
        (globalThis as { window?: unknown }).window = {};
        (globalThis as { localStorage?: unknown }).localStorage = {};
        (globalThis as { fetch?: unknown }).fetch = () => {};
      });

      it("should prioritize authServerPublicUrl over authServerUrl in browser", () => {
        const config: KeycloakConfig = {
          authServerPublicUrl: "https://keycloak-public.example.com",
          authServerPrivateUrl: "http://keycloak-private:8080",
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("https://keycloak-public.example.com");
      });
    });

    describe("server priority order", () => {
      beforeEach(() => {
        // Mock server environment
        delete (globalThis as { window?: unknown }).window;
      });

      it("should prioritize authServerPrivateUrl over authServerUrl in server", () => {
        const config: KeycloakConfig = {
          authServerPublicUrl: "https://keycloak-public.example.com",
          authServerPrivateUrl: "http://keycloak-private:8080",
          authServerUrl: "http://keycloak-fallback.example.com",
          realm: "test-realm",
        };

        const url = resolveKeycloakUrl(config);
        expect(url).toBe("http://keycloak-private:8080");
      });
    });
  });
});

