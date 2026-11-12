import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { MisoClientConfig } from "../../src/types/config.types";
import { LoggerService } from "../../src/services/logger";
import { RedisService } from "../../src/services/redis.service";
import { HttpClient } from "../../src/utils/http-client";
import { ExtractedMetadata } from "../../src/utils/http-client-metadata";
import { logHttpRequestAudit } from "../../src/utils/http-client-audit";
import {
  isSecurityHttpTarget,
  maskKnownDiagnosticFields,
  securitySafeErrorMessage,
} from "../../src/utils/http-log-security";

const config: MisoClientConfig = {
  controllerUrl: "https://controller.example/miso",
  clientId: "security-log-test",
  clientSecret: "synthetic-client-secret",
  logLevel: "debug",
  emitEvents: true,
  audit: { level: "full" },
};

function metadata(
  url: string,
  requestBody: unknown,
  responseBody: unknown,
  method = "POST",
  statusCode = 200,
): ExtractedMetadata {
  return {
    config: {
      timeout: 30000,
      data: requestBody,
      headers: {},
    } as InternalAxiosRequestConfig,
    metadata: { startTime: Date.now(), method, url },
    duration: 5,
    method,
    url,
    fullUrl: `${config.controllerUrl}${url}`,
    baseURL: config.controllerUrl!,
    statusCode,
    userId: null,
    requestHeaders: { "content-type": "application/json" },
    requestBody,
    responseBody,
    responseHeaders: { "x-correlation-id": "safe-correlation" },
  };
}

function eventLogger(loggerConfig: MisoClientConfig = config): {
  logger: LoggerService;
  events: unknown[];
} {
  const events: unknown[] = [];
  const httpClient = { config: loggerConfig } as HttpClient;
  const redis = { isConnected: () => false } as RedisService;
  const logger = new LoggerService(httpClient, redis);
  logger.on("log", (entry: unknown) => events.push(entry));
  return { logger, events };
}

describe("security HTTP logging", () => {
  it.each([
    ["POST", "/api/security/parameters/encrypt"],
    ["POST", "/api/security/parameters/decrypt"],
    ["POST", "/api/security/parameters/delete"],
  ])(
    "omits %s security request and response bodies from production debug events",
    async (method, url) => {
      const { logger, events } = eventLogger();
      const requestMarker = `${method}-request-marker-must-not-log`;
      const responseMarker = `${method}-response-marker-must-not-log`;

      await logHttpRequestAudit(
        metadata(
          url,
          { harmless: requestMarker },
          { harmless: responseMarker },
          method,
        ),
        null,
        config,
        logger,
      );

      expect(
        events.some((entry) => JSON.stringify(entry).includes("debug")),
      ).toBe(true);
      const output = JSON.stringify(events);
      expect(output).not.toContain(requestMarker);
      expect(output).not.toContain(responseMarker);
    },
  );

  it.each([
    ["/api/security/parameters/decrypt", "", true],
    [
      "https://controller.example/miso/api/security/parameters/decrypt?x=1",
      "",
      true,
    ],
    [
      "/api/security/parameters/encrypt",
      "https://controller.example/miso",
      true,
    ],
    [
      "/API/SECURITY/parameters/encrypt",
      "https://controller.example/miso",
      true,
    ],
    [
      "/api/security-other/parameters",
      "https://controller.example/miso",
      false,
    ],
    ["/api/users?next=/api/security/parameters", "", false],
  ])(
    "classifies target %s with base %s as security=%s",
    (target, baseURL, expected) => {
      expect(isSecurityHttpTarget(target, baseURL)).toBe(expected);
    },
  );

  it("handles malformed targets without classifying query text as a route", () => {
    expect(isSecurityHttpTarget("http://[invalid?next=/api/security")).toBe(
      false,
    );
  });

  it("preserves legacy recursive masking in test diagnostics", () => {
    const input = {
      nested: [{ email: "person@example.test", harmless: "visible" }],
    };
    expect(maskKnownDiagnosticFields(input)).toEqual({
      nested: [{ email: "***MASKED***", harmless: "visible" }],
    });
    expect(maskKnownDiagnosticFields(null)).toBeNull();
    expect(input.nested[0].email).toBe("person@example.test");
  });

  it("leaves absent and nonsecurity diagnostic messages unchanged", () => {
    expect(
      securitySafeErrorMessage(
        "/api/security/parameters/encrypt",
        config.controllerUrl!,
        undefined,
      ),
    ).toBeUndefined();
    expect(
      securitySafeErrorMessage(
        "/api/users",
        config.controllerUrl!,
        "ordinary failure",
      ),
    ).toBe("ordinary failure");
  });

  it("retains ordinary nonsecurity bodies after masking", async () => {
    const { logger, events } = eventLogger();
    const marker = "ordinary-visible-diagnostic";
    await logHttpRequestAudit(
      metadata("/api/users", { harmless: marker }, { success: true }),
      null,
      config,
      logger,
    );
    expect(JSON.stringify(events)).toContain(marker);
  });

  it("omits security bodies when logger masking is explicitly disabled", async () => {
    const { logger, events } = eventLogger();
    logger.setMasking(false);
    const requestMarker = "permissive-request-marker-must-not-log";
    const responseMarker = "permissive-response-marker-must-not-log";

    await logHttpRequestAudit(
      metadata(
        "/api/security/parameters/encrypt",
        { harmless: requestMarker },
        { harmless: responseMarker },
      ),
      null,
      config,
      logger,
    );

    const output = JSON.stringify(events);
    expect(events.length).toBeGreaterThan(0);
    expect(output).toContain("safe-correlation");
    expect(output).not.toContain(requestMarker);
    expect(output).not.toContain(responseMarker);
  });

  it("keeps security failure metadata without response-only plaintext echoed by the error message", async () => {
    const { logger, events } = eventLogger();
    const marker = "failure-marker-must-not-log";
    const request = metadata(
      "/api/security/parameters/decrypt",
      { harmless: "safe-request" },
      { plaintext: marker },
      "POST",
      422,
    );
    const error = {
      message: `request rejected: ${marker}`,
      config: request.config,
    } as AxiosError;

    await logHttpRequestAudit(request, error, config, logger);

    const output = JSON.stringify(events);
    expect(output).not.toContain(marker);
    expect(output).toContain("Security request failed");
    expect(output).toContain("safe-correlation");
    expect(output).toContain("422");
  });

  it("uses the fixed security error message at minimal audit level", async () => {
    const minimalConfig: MisoClientConfig = {
      ...config,
      audit: { level: "minimal" },
    };
    const { logger, events } = eventLogger(minimalConfig);
    const marker = "minimal-response-only-marker";
    const request = metadata(
      "/api/security/parameters/decrypt",
      { harmless: "safe-request" },
      { plaintext: marker },
      "POST",
      422,
    );

    await logHttpRequestAudit(
      request,
      { message: marker, config: request.config } as AxiosError,
      minimalConfig,
      logger,
    );

    const output = JSON.stringify(events);
    expect(output).not.toContain(marker);
    expect(output).toContain("Security request failed");
  });

  it("keeps the fallback minimal audit message safe", async () => {
    const audit = jest
      .fn()
      .mockRejectedValueOnce(new Error("force fallback"))
      .mockResolvedValue(undefined);
    const logger = {
      audit,
      debug: jest.fn().mockResolvedValue(undefined),
    } as unknown as LoggerService;
    const marker = "fallback-response-only-marker";
    const request = metadata(
      "/api/security/parameters/decrypt",
      { harmless: "safe-request" },
      { plaintext: marker },
      "POST",
      422,
    );

    await logHttpRequestAudit(
      request,
      { message: marker, config: request.config } as AxiosError,
      config,
      logger,
    );

    expect(audit).toHaveBeenCalledTimes(2);
    const output = JSON.stringify(audit.mock.calls[1]);
    expect(output).not.toContain(marker);
    expect(output).toContain("Security request failed");
  });

  it("applies the same body and error guard to the NODE_ENV=test signal path", () => {
    const debug = jest.fn().mockResolvedValue(undefined);
    const logger = {
      audit: jest.fn().mockResolvedValue(undefined),
      debug,
    } as unknown as LoggerService;
    const client = new HttpClient(config, logger);
    const requestMarker = "test-path-request-marker";
    const responseMarker = "test-path-response-marker";
    const extracted = metadata(
      "/api/security/parameters/decrypt",
      { harmless: requestMarker },
      { harmless: responseMarker },
    );
    const response = {
      status: extracted.statusCode,
      statusText: "OK",
      data: extracted.responseBody,
      headers: extracted.responseHeaders,
      config: {
        ...extracted.config,
        metadata: extracted.metadata,
        url: extracted.url,
        baseURL: extracted.baseURL,
        method: "post",
        data: extracted.requestBody,
      },
    } as AxiosResponse;

    (
      client as unknown as {
        logTestAuditSignals: (
          response: AxiosResponse,
          error: AxiosError | null,
        ) => void;
      }
    ).logTestAuditSignals(response, {
      message: responseMarker,
      config: response.config,
    } as AxiosError);

    expect(debug).toHaveBeenCalledTimes(1);
    const output = JSON.stringify(debug.mock.calls[0]);
    expect(output).not.toContain(requestMarker);
    expect(output).not.toContain(responseMarker);
    expect(output).toContain("Security request failed");
  });
});
