/**
 * Integration tests for the URL-join refactor.
 *
 * These tests prove that virtual-directory roots ("/", "/miso", "/data",
 * "/myapp") flow through the SDK consumers via `joinApiRoot` end-to-end:
 *
 *  - DataClient request URL building (data-client-core.ts).
 *  - Browser environment-token fetch URL (data-client-auth.ts).
 *  - Auto-init config fetch URL (data-client-auto-init.ts).
 *  - Login redirect URL (data-client-redirect.ts).
 *
 * No SDK-side virtual-directory literals are used; the same code path serves
 * every mount.
 */

// Mock MisoClient before importing DataClient.
jest.mock("../../src/index", () => ({
  MisoClient: jest.fn().mockImplementation(() => ({
    log: {
      audit: jest.fn().mockResolvedValue(undefined),
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    },
    getDefaultAuthStrategy: jest
      .fn()
      .mockReturnValue({ methods: ["bearer", "client-token"] }),
  })),
}));

jest.mock("../../src/utils/data-masker", () => ({
  DataMasker: {
    maskSensitiveData: jest.fn((data) => data),
    setConfigPath: jest.fn(),
  },
}));

import { DataClient } from "../../src/utils/data-client";
import { autoInitializeDataClient } from "../../src/utils/data-client-auto-init";
import {
  clearCachedBrowserAuthState,
  getEnvironmentToken,
} from "../../src/utils/data-client-auth";

// ---------------------------------------------------------------------------
// Browser globals shared across describe blocks
// ---------------------------------------------------------------------------

let mockLocalStorage: Record<string, string> = {};
const mockFetch = jest.fn();

const mockWindow = {
  location: {
    href: "",
    origin: "https://app.example.com",
    hash: "",
    protocol: "https:",
  },
};

beforeAll(() => {
  (global as any).fetch = mockFetch;
  (global as any).localStorage = {
    getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockLocalStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockLocalStorage[key];
    }),
    clear: jest.fn(() => {
      Object.keys(mockLocalStorage).forEach(
        (key) => delete mockLocalStorage[key],
      );
    }),
  };
  // data-client-redirect.ts accesses globalThis.window.location directly,
  // while data-client-oauth.ts uses globalThis.window.window.location. Bind
  // the single-window form here so the redirect path works; the OAuth
  // callback path is not exercised by these tests.
  (global as any).window = mockWindow;
  (globalThis as any).window = mockWindow;
  (globalThis as any).localStorage = (global as any).localStorage;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockClear();
  mockLocalStorage = {};
  clearCachedBrowserAuthState();
  mockWindow.location.href = "";
  mockWindow.location.hash = "";
  mockWindow.location.origin = "https://app.example.com";
  // Re-bind in case a prior test mutated the global.
  (globalThis as any).window = mockWindow;
});

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// DataClient request URL building
// ---------------------------------------------------------------------------

describe("DataClient request joins baseUrl + endpoint via joinApiRoot", () => {
  const cases: Array<[string, string, string, string]> = [
    [
      "root mount",
      "https://app.example.com",
      "/api/v1/items",
      "https://app.example.com/api/v1/items",
    ],
    [
      "/miso mount",
      "https://app.example.com/miso",
      "/api/v1/items",
      "https://app.example.com/miso/api/v1/items",
    ],
    [
      "/data mount",
      "https://app.example.com/data",
      "/api/v1/items",
      "https://app.example.com/data/api/v1/items",
    ],
    [
      "/myapp mount",
      "https://app.example.com/myapp",
      "/api/v1/items",
      "https://app.example.com/myapp/api/v1/items",
    ],
    [
      "trailing slash on baseUrl is normalized",
      "https://app.example.com/miso/",
      "/api/v1/items",
      "https://app.example.com/miso/api/v1/items",
    ],
  ];

  it.each(cases)(
    "issues fetch with the correct full URL: %s",
    async (_label, baseUrl, endpoint, expectedUrl) => {
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

      const client = new DataClient({
        baseUrl,
        misoConfig: {
          clientId: "test-client",
          controllerUrl: "https://controller.example.com",
        },
      });

      await client.get(endpoint);

      expect(mockFetch).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    },
  );
});

// ---------------------------------------------------------------------------
// Browser environment-token fetch URL (data-client-auth.ts)
// ---------------------------------------------------------------------------

describe("getEnvironmentToken builds clientTokenUri via joinApiRoot", () => {
  const cases: Array<[string, string, string]> = [
    [
      "root mount",
      "https://app.example.com",
      "https://app.example.com/api/v1/auth/client-token",
    ],
    [
      "/miso mount",
      "https://app.example.com/miso",
      "https://app.example.com/miso/api/v1/auth/client-token",
    ],
    [
      "/data mount",
      "https://app.example.com/data",
      "https://app.example.com/data/api/v1/auth/client-token",
    ],
  ];

  it.each(cases)(
    "fetches token from the right URL: %s",
    async (_label, baseUrl, expectedUrl) => {
      mockFetch.mockResolvedValue(
        jsonResponse({ token: "env-token", expiresIn: 3600 }),
      );

      const token = await getEnvironmentToken(
        {
          baseUrl,
          misoConfig: {
            clientId: "test-client",
            controllerUrl: "https://controller.example.com",
            clientTokenUri: "/api/v1/auth/client-token",
          },
        },
        null,
      );

      expect(token).toBe("env-token");
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: "POST" }),
      );
    },
  );

  it("uses an absolute clientTokenUri verbatim (bypasses join)", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ token: "env-token", expiresIn: 3600 }),
    );

    await getEnvironmentToken(
      {
        baseUrl: "https://app.example.com/miso",
        misoConfig: {
          clientId: "test-client",
          controllerUrl: "https://controller.example.com",
          clientTokenUri: "https://other-host.example.com/token",
        },
      },
      null,
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://other-host.example.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Auto-init config URL (data-client-auto-init.ts)
// ---------------------------------------------------------------------------

describe("autoInitializeDataClient builds config URL via joinApiRoot", () => {
  const cases: Array<[string, string, string]> = [
    [
      "root mount",
      "https://app.example.com",
      "https://app.example.com/api/v1/auth/client-token",
    ],
    [
      "/miso mount",
      "https://app.example.com/miso",
      "https://app.example.com/miso/api/v1/auth/client-token",
    ],
    [
      "/data mount",
      "https://app.example.com/data",
      "https://app.example.com/data/api/v1/auth/client-token",
    ],
  ];

  it.each(cases)(
    "fetches config from the right URL: %s",
    async (_label, baseUrl, expectedUrl) => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          token: "ct",
          expiresIn: 1800,
          config: {
            baseUrl,
            controllerUrl: "https://controller.example.com",
            controllerPublicUrl: "https://controller.example.com",
            clientId: "ctrl-test",
            clientTokenUri: "/api/v1/auth/client-token",
          },
        }),
      );

      await autoInitializeDataClient({ baseUrl });

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({ method: "POST" }),
      );
    },
  );
});

// ---------------------------------------------------------------------------
// Login redirect URL (data-client-redirect.ts)
// ---------------------------------------------------------------------------

describe("redirectToLogin joins controllerUrl + loginUrl via joinApiRoot", () => {
  const cases: Array<[string, string, string]> = [
    ["root mount", "https://controller.example.com", "/login"],
    ["/miso mount", "https://controller.example.com/miso", "/login"],
    ["/data mount", "https://controller.example.com/data", "/login"],
  ];

  it.each(cases)(
    "redirects to the right login URL: %s",
    async (_label, controllerUrl, loginPath) => {
      mockWindow.location.href = "https://app.example.com/page";

      const client = new DataClient({
        baseUrl: "https://app.example.com",
        loginUrl: loginPath,
        misoConfig: {
          clientId: "test-client",
          controllerUrl,
          clientToken: "ct",
        },
      });

      await client.redirectToLogin();

      // URL constructor normalizes the controller URL when reading it back, so
      // we assert the prefix only — the important part is that the controller
      // URL plus the login path appear concatenated, virtual directory and all.
      const expectedPrefix = `${controllerUrl}${loginPath}`;
      expect(mockWindow.location.href).toContain(expectedPrefix);
      expect(mockWindow.location.href).toContain("redirect=");
      expect(mockWindow.location.href).toContain("x-client-token=ct");
    },
  );

  it("uses an absolute loginUrl verbatim (bypasses join)", async () => {
    mockWindow.location.href = "https://app.example.com/page";

    const client = new DataClient({
      baseUrl: "https://app.example.com",
      loginUrl: "https://idp.example.com/login",
      misoConfig: {
        clientId: "test-client",
        controllerUrl: "https://controller.example.com/miso",
        clientToken: "ct",
      },
    });

    await client.redirectToLogin();

    expect(mockWindow.location.href).toContain("https://idp.example.com/login");
    // The /miso virtual directory must NOT be prepended to an absolute login URL.
    expect(mockWindow.location.href).not.toContain(
      "https://controller.example.com/miso",
    );
  });
});
