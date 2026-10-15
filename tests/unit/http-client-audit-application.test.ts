/**
 * Plan 69.0: automatic HTTP audit and debug logs never send an application label, so the
 * controller attributes them to the authenticated application (never "***MASKED***").
 */
import * as fs from "fs";
import * as path from "path";
import * as httpClientAudit from "../../src/utils/http-client-audit";
import { logHttpRequestAudit } from "../../src/utils/http-client-audit";
import * as httpClientMetadata from "../../src/utils/http-client-metadata";
import { HttpClient } from "../../src/utils/http-client";
import { ExtractedMetadata } from "../../src/utils/http-client-metadata";
import { MisoClientConfig } from "../../src/types/config.types";
import { LoggerService } from "../../src/services/logger";

jest.mock("../../src/utils/internal-http-client", () => ({
  InternalHttpClient: jest.fn().mockImplementation(() => ({
    getAxiosInstance: () => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
  })),
}));

const metadata = {
  config: { headers: {} },
  metadata: {},
  duration: 12,
  method: "POST",
  url: "/api/v1/auth/validate-client-token",
  fullUrl: "http://controller/api/v1/auth/validate-client-token",
  baseURL: "http://controller",
  statusCode: 200,
  userId: "user-1",
  requestHeaders: {},
  requestBody: { a: 1 },
  responseBody: { ok: true },
  responseHeaders: {},
} as unknown as ExtractedMetadata;

function buildLogger(): { audit: jest.Mock; debug: jest.Mock } {
  return {
    audit: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
  };
}

function config(
  level: "minimal" | "standard" | "detailed" | "full",
  logLevel?: "debug",
): MisoClientConfig {
  return {
    controllerUrl: "http://controller",
    clientId: "miso-controller-dev-builder-api",
    audit: { level },
    ...(logLevel ? { logLevel } : {}),
  } as MisoClientConfig;
}

describe("HTTP audit application label (plan 69.0)", () => {
  it.each(["minimal", "standard", "detailed", "full"] as const)(
    "%s audit context has no application key",
    async (level) => {
      const logger = buildLogger();
      await logHttpRequestAudit(
        metadata,
        null,
        config(level),
        logger as unknown as LoggerService,
      );

      expect(logger.audit).toHaveBeenCalledTimes(1);
      const context = logger.audit.mock.calls[0][2] as Record<string, unknown>;
      expect(context).not.toHaveProperty("application");
    },
  );

  it("debug context has no application key", async () => {
    const logger = buildLogger();
    await logHttpRequestAudit(
      metadata,
      null,
      config("detailed", "debug"),
      logger as unknown as LoggerService,
    );

    expect(logger.debug).toHaveBeenCalledTimes(1);
    const context = logger.debug.mock.calls[0][1] as Record<string, unknown>;
    expect(context).not.toHaveProperty("application");
  });

  it("[EDGE] HttpClient fallback audit/debug contexts have no application key", async () => {
    const logger = buildLogger();
    const client = new HttpClient(
      config("standard", "debug"),
      logger as unknown as LoggerService,
    );
    jest
      .spyOn(httpClientMetadata, "extractRequestMetadata")
      .mockReturnValue(metadata);
    jest
      .spyOn(httpClientAudit, "logHttpRequestAudit")
      .mockRejectedValue(new Error("audit helper failed"));

    await (
      client as unknown as {
        logHttpRequestAudit: (r: unknown, e: unknown) => Promise<void>;
      }
    ).logHttpRequestAudit(undefined, null);

    expect(logger.audit).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.audit.mock.calls[0][2]).not.toHaveProperty("application");
    expect(logger.debug.mock.calls[0][1]).not.toHaveProperty("application");
    jest.restoreAllMocks();
  });

  it("[EDGE] no source file assigns a masking placeholder to application", () => {
    const srcDir = path.join(__dirname, "../../src");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith(".ts")) {
          const text = fs.readFileSync(full, "utf8");
          if (/application\s*:\s*["'`][^"'`]*MASKED/i.test(text)) {
            offenders.push(path.relative(srcDir, full));
          }
        }
      }
    };
    walk(srcDir);

    expect(offenders).toEqual([]);
  });
});
