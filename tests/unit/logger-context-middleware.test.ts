/**
 * Unit tests for loggerContextMiddleware
 */

import { Request, Response, NextFunction } from "express";
import { loggerContextMiddleware } from "../../src/express/logger-context.middleware";
import { LoggerContextStorage } from "../../src/services/logger/logger-context-storage";
import { clearLoggerContext } from "../../src/services/logger/unified-logger.factory";

describe("loggerContextMiddleware", () => {
  const contextStorage = LoggerContextStorage.getInstance();

  afterEach(() => {
    clearLoggerContext();
  });

  it("should store referer and requestSize in logger context", () => {
    const req = {
      method: "POST",
      path: "/api/items",
      originalUrl: "/api/items",
      ip: "10.0.0.5",
      headers: {
        "user-agent": "Mozilla/5.0",
        "x-correlation-id": "corr-123",
        "x-request-id": "req-456",
        referer: "https://example.com/page",
        "content-length": "2048",
      },
      socket: {
        remoteAddress: "10.0.0.5",
      },
    } as Partial<Request>;

    const res = {} as Response;
    const next: NextFunction = jest.fn();

    loggerContextMiddleware(req as Request, res, next);

    const context = contextStorage.getContext();
    expect(context).toBeTruthy();
    expect(context).toMatchObject({
      ipAddress: "10.0.0.5",
      method: "POST",
      path: "/api/items",
      userAgent: "Mozilla/5.0",
      correlationId: "corr-123",
      requestId: "req-456",
      referer: "https://example.com/page",
      requestSize: 2048,
    });
    expect(next).toHaveBeenCalled();
  });
});
