import { AxiosError } from "axios";
import {
  createDiagnosticSanitizer,
  diagnosticData,
} from "../../src/utils/diagnostic-sanitizer";
import { createMisoClientError } from "../../src/utils/http-error-handler";
import { extractErrorInfo } from "../../src/utils/error-extractor";
import { formatTokenFetchError } from "../../src/utils/client-token-manager";

const config = {
  clientId: "configured-client-id",
  clientSecret: "configured-secret",
  encryptionKey: "configured-key",
};
describe("bounded diagnostic sanitization", () => {
  it("redacts values and field names without inventing withheld identity", () => {
    const error = new AxiosError("echo configured-secret", undefined, {
      headers: {},
      data: JSON.stringify({
        plaintext: "private-plaintext",
        value: "enc://private-value",
      }),
    } as any);
    error.response = {
      status: 422,
      data: {
        type: "about:blank",
        title: "configured-secret private-plaintext enc://private-value",
        status: 401,
        authMethod: "client-token",
        code: "KEY_ERROR",
        detail: "configured-key",
        instance: "configured-secret",
        correlationId: "configured-secret",
        "configured-secret": "never expose field names",
      },
      headers: {},
    } as any;
    const safe = createMisoClientError(error, undefined, config);
    const info = extractErrorInfo(safe, {
      correlationId: "override-configured-secret",
      endpoint: "configured-key",
    });
    expect(safe.errorResponse?.statusCode).toBe(422);
    expect(safe.errorBody?.status).toBe(422);
    expect(safe.errorResponse?.clientIdentity).toBeUndefined();
    expect(info.correlationId).toBe("override-***MASKED***");
    expect(JSON.stringify({ safe, info, stack: safe.stack })).not.toMatch(
      /configured-secret|private-plaintext|enc:\/\/private-value|configured-key/,
    );
  });
  it("bounds oversized strings, arrays, objects, depth and cycles", () => {
    const sanitize = createDiagnosticSanitizer(config);
    const cycle: any = { detail: "configured-secret" };
    cycle.self = cycle;
    let deep: any = { detail: "configured-secret" };
    for (let i = 0; i < 30; i++) deep = { next: deep };
    const huge = Object.fromEntries(
      Array.from({ length: 500 }, (_, i) => [String(i), "configured-secret"]),
    );
    const output = sanitize({
      cycle,
      deep,
      huge,
      many: Array(3000).fill("configured-secret"),
      oversized: "x".repeat(70000),
    });
    const text = JSON.stringify(output);
    expect(text).not.toContain("configured-secret");
    expect(text.length).toBeLessThan(20000);
    expect(diagnosticData("x".repeat(70000))).toBe("***MASKED***");
  });
  it("fails closed for throwing properties and prevents prototype pollution", () => {
    const sanitize = createDiagnosticSanitizer();
    const unsafe = Object.defineProperty({}, "detail", {
      enumerable: true,
      get() {
        throw new Error("sensitive getter");
      },
    });
    expect(sanitize(unsafe)).toBe("***MASKED***");
    expect(
      sanitize(
        JSON.parse(
          '{"__proto__":{"polluted":true},"constructor":{},"prototype":{},"detail":"safe"}',
        ),
      ),
    ).toEqual({ detail: "safe" });
  });
  it("keeps concurrent request secrets separate", async () => {
    const [first, second] = await Promise.all(
      ["first-secret", "second-secret"].map(async (clientSecret) =>
        createDiagnosticSanitizer({ clientSecret })({
          detail: "first-secret second-secret",
        }),
      ),
    );
    expect(first).toEqual({ detail: "***MASKED*** second-secret" });
    expect(second).toEqual({ detail: "first-secret ***MASKED***" });
  });
  it("sanitizes token grant failures before public exposure", () => {
    const error = new AxiosError("configured-secret");
    error.response = {
      status: 401,
      data: { detail: "configured-secret", clientSecret: "configured-secret" },
    } as any;
    const safe = formatTokenFetchError(
      error,
      "correlation",
      config.clientId,
      config,
    );
    expect(safe.message).toContain("Failed to get client token");
    expect(JSON.stringify(safe)).not.toContain("configured-secret");
  });
});
