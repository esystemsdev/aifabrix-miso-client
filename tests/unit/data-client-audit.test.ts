/**
 * Unit tests for DataClient audit logging utilities
 */

import { logDataClientAudit } from "../../src/utils/data-client-audit";
import { AuditConfig } from "../../src/types/data-client.types";
import { MisoClient } from "../../src";
import jwt from "jsonwebtoken";

// Mock jsonwebtoken for extractUserIdFromToken
jest.mock("jsonwebtoken");
const mockedJwtDecode = jwt.decode as jest.MockedFunction<typeof jwt.decode>;

describe("data-client-audit", () => {
  const createMisoClient = (): MisoClient =>
    ({
      log: {
        audit: jest.fn(),
      },
    }) as unknown as MisoClient;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should log minimal audit context with userId", async () => {
    const misoClient = createMisoClient();
    const auditConfig: AuditConfig = { enabled: true, level: "minimal" };
    const token = "test-token";
    mockedJwtDecode.mockReturnValue({ sub: "user-123" });

    await logDataClientAudit({
      method: "GET",
      url: "/api/users",
      statusCode: 200,
      duration: 120,
      misoClient,
      auditConfig,
      hasAnyToken: () => true,
      getToken: () => token,
      requestSize: 120,
      responseSize: 240,
      requestHeaders: { "x-test": "req" },
      responseHeaders: { "x-test": "res" },
      requestBody: { query: "value" },
      responseBody: { data: "value" },
    });

    const auditCall = (misoClient.log.audit as jest.Mock).mock.calls[0];
    expect(auditCall[0]).toBe("http.request.get");
    expect(auditCall[1]).toBe("/api/users");
    expect(auditCall[2]).toMatchObject({
      method: "GET",
      url: "/api/users",
      statusCode: 200,
      duration: 120,
      userId: "user-123",
    });
    expect(auditCall[2]).not.toHaveProperty("requestHeaders");
    expect(auditCall[2]).not.toHaveProperty("responseHeaders");
    expect(auditCall[2]).not.toHaveProperty("requestBody");
    expect(auditCall[2]).not.toHaveProperty("responseBody");
  });

  it("should include headers and bodies for standard audit level", async () => {
    const misoClient = createMisoClient();
    const auditConfig: AuditConfig = { enabled: true, level: "standard" };

    await logDataClientAudit({
      method: "POST",
      url: "/api/users",
      statusCode: 201,
      duration: 80,
      misoClient,
      auditConfig,
      hasAnyToken: () => true,
      getToken: () => null,
      requestSize: 64,
      responseSize: 128,
      requestHeaders: { "x-request": "value" },
      responseHeaders: { "x-response": "value" },
      requestBody: { payload: "request" },
      responseBody: { payload: "response" },
    });

    const auditCall = (misoClient.log.audit as jest.Mock).mock.calls[0];
    expect(auditCall[2]).toMatchObject({
      method: "POST",
      url: "/api/users",
      statusCode: 201,
      duration: 80,
      requestHeaders: { "x-request": "value" },
      responseHeaders: { "x-response": "value" },
      requestBody: { payload: "request" },
      responseBody: { payload: "response" },
    });
    expect(auditCall[2]).not.toHaveProperty("requestSize");
    expect(auditCall[2]).not.toHaveProperty("responseSize");
  });

  it("should include request/response sizes for detailed audit level", async () => {
    const misoClient = createMisoClient();
    const auditConfig: AuditConfig = { enabled: true, level: "detailed" };

    await logDataClientAudit({
      method: "PUT",
      url: "/api/users/1",
      statusCode: 200,
      duration: 45,
      misoClient,
      auditConfig,
      hasAnyToken: () => true,
      getToken: () => null,
      requestSize: 512,
      responseSize: 1024,
    });

    const auditCall = (misoClient.log.audit as jest.Mock).mock.calls[0];
    expect(auditCall[2]).toMatchObject({
      requestSize: 512,
      responseSize: 1024,
    });
  });

  it("should include error details when error is provided", async () => {
    const misoClient = createMisoClient();
    const auditConfig: AuditConfig = { enabled: true, level: "standard" };
    const error = new Error("Failure");

    await logDataClientAudit({
      method: "DELETE",
      url: "/api/users/2",
      statusCode: 500,
      duration: 20,
      misoClient,
      auditConfig,
      hasAnyToken: () => true,
      getToken: () => null,
      error,
    });

    const auditCall = (misoClient.log.audit as jest.Mock).mock.calls[0];
    const context = auditCall[2] as Record<string, unknown>;
    expect(context).toHaveProperty("error");
    const errorContext = context.error as Record<string, unknown>;
    expect(errorContext).toMatchObject({
      message: "Failure",
      name: "Error",
    });
  });

  it("should skip audit logging when no tokens are available", async () => {
    const misoClient = createMisoClient();
    const auditConfig: AuditConfig = { enabled: true, level: "standard" };

    await logDataClientAudit({
      method: "GET",
      url: "/api/users",
      statusCode: 200,
      duration: 25,
      misoClient,
      auditConfig,
      hasAnyToken: () => false,
      getToken: () => null,
    });

    expect(misoClient.log.audit).not.toHaveBeenCalled();
  });
});
