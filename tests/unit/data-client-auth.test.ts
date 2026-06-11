/**
 * Unit tests for DataClient authentication utilities.
 * Updated for runtime-memory-only browser user-token contract.
 */

jest.mock("../../src/utils/console-logger", () => ({
  writeWarn: jest.fn(),
  writeErr: jest.fn(),
  logErrorWithContext: jest.fn(),
}));

import {
  handleOAuthCallback,
  clearCachedBrowserAuthState,
  storeBrowserSessionTokens,
  getToken,
} from "../../src/utils/data-client-auth";
import { DataClientConfig } from "../../src/types/data-client.types";
import * as consoleLogger from "../../src/utils/console-logger";

const mockWriteWarn = consoleLogger.writeWarn as jest.Mock;
const mockWriteErr = consoleLogger.writeErr as jest.Mock;

describe("data-client-auth runtime contract", () => {
  let mockWindow: {
    location: {
      hash: string;
      pathname: string;
      search: string;
      protocol: string;
      hostname: string;
    };
    history: {
      replaceState: jest.Mock;
    };
  };
  let originalEnv: string | undefined;

  const createConfig = (
    overrides?: Partial<DataClientConfig>,
  ): DataClientConfig => {
    const defaultMisoConfig = {
      clientId: "test-client-id",
      controllerUrl: "https://controller.example.com",
    };
    return {
      baseUrl: "https://example.com",
      tokenKeys: ["miso_token"],
      ...overrides,
      misoConfig: overrides?.misoConfig || defaultMisoConfig,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clearCachedBrowserAuthState();
    (global as any).localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    mockWindow = {
      location: {
        hash: "",
        pathname: "/",
        search: "",
        protocol: "https:",
        hostname: "example.com",
      },
      history: {
        replaceState: jest.fn(),
      },
    };
    (globalThis as any).window = mockWindow;
    (globalThis as any).localStorage = (global as any).localStorage;
    (globalThis as any).fetch = jest.fn();
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    clearCachedBrowserAuthState();
    jest.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
    delete (globalThis as any).fetch;
    process.env.NODE_ENV = originalEnv;
  });

  it("extracts token from #token hash and cleans URL hash", () => {
    const token = "header.payload.signature";
    mockWindow.location.hash = `#token=${token}`;
    mockWindow.location.pathname = "/dashboard";
    mockWindow.location.search = "?from=oidc";

    const result = handleOAuthCallback(createConfig());

    expect(result).toBe(token);
    expect(getToken()).toBeNull();
    expect(mockWindow.history.replaceState).toHaveBeenCalledWith(
      null,
      "",
      "/dashboard?from=oidc",
    );
  });

  it("extracts token from #access_token hash and rejects accessToken alias", () => {
    const token = "header.payload.signature";
    mockWindow.location.hash = `#access_token=${token}`;
    expect(handleOAuthCallback(createConfig())).toBe(token);

    mockWindow.location.hash = `#accessToken=${token}`;
    expect(handleOAuthCallback(createConfig())).toBeNull();
  });

  it("rejects short token and logs validation failure", () => {
    mockWindow.location.hash = "#token=abcd";
    expect(handleOAuthCallback(createConfig())).toBeNull();
    expect(mockWriteErr).toHaveBeenCalledWith(
      expect.stringContaining("Invalid token format"),
    );
  });

  it("rejects HTTP callback in production for non-local hosts", () => {
    process.env.NODE_ENV = "production";
    mockWindow.location.hash = "#token=header.payload.signature";
    mockWindow.location.protocol = "http:";
    mockWindow.location.hostname = "example.com";

    expect(handleOAuthCallback(createConfig())).toBeNull();
    expect(mockWriteErr).toHaveBeenCalledWith(
      "[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production",
    );
  });

  it("accepts HTTP callback in production for localhost hosts", () => {
    process.env.NODE_ENV = "production";
    mockWindow.location.hash = "#token=header.payload.signature";
    mockWindow.location.protocol = "http:";
    mockWindow.location.hostname = "localhost";

    expect(handleOAuthCallback(createConfig())).toBe(
      "header.payload.signature",
    );
  });

  it("debug logs runtime-session wording", () => {
    mockWindow.location.hash = "#token=header.payload.signature";
    handleOAuthCallback(
      createConfig({ misoConfig: { logLevel: "debug" } as any }),
    );
    expect(mockWriteWarn).toHaveBeenCalledWith(
      expect.stringContaining("runtime session flow"),
    );
  });

  it("stores browser session token only in runtime state", () => {
    storeBrowserSessionTokens({
      accessToken: "access-token",
      expiresAt: "2026-05-05T12:00:00.000Z",
    });
    expect(getToken()).toBe("access-token");
    clearCachedBrowserAuthState();
    expect(getToken()).toBeNull();
  });
});
