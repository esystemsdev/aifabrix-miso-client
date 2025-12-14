/**
 * Server-side environment token wrapper
 * Provides origin validation and ISO 27001 compliant audit logging
 */

import { Request } from "express";
import { MisoClient } from "../index";
import { validateOrigin } from "./origin-validator";
import { DataMasker } from "./data-masker";

/**
 * Get environment token with origin validation and audit logging
 * Validates request origin before calling controller
 * Logs audit events for ISO 27001 compliance
 * 
 * @param misoClient - MisoClient instance
 * @param req - Express Request object
 * @returns Client token string
 * @throws Error if origin validation fails or token fetch fails
 */
export async function getEnvironmentToken(
  misoClient: MisoClient,
  req: Request,
): Promise<string> {
  const config = misoClient.getConfig();
  const allowedOrigins = config.allowedOrigins;

  // Validate origin first (security-first approach)
  const validation = validateOrigin(req, allowedOrigins);
  if (!validation.valid) {
    // Log error and audit event before throwing (never call controller if origin invalid)
    const errorMessage = `Origin validation failed: ${validation.error}`;
    const origin = req.headers.origin || req.headers.referer || "unknown";

    // Log error
    await misoClient.log.error(
      errorMessage,
      {
        origin,
        allowedOrigins: allowedOrigins || [],
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
      undefined,
      {
        requestId: req.headers["x-request-id"] as string | undefined,
        correlationId: req.headers["x-correlation-id"] as string | undefined,
      },
    );

    // Log audit event (ISO 27001 compliance)
    await misoClient.log.audit(
      "client.token.request.rejected",
      "environment-token",
      {
        reason: "origin_validation_failed",
        origin,
        allowedOrigins: allowedOrigins || [],
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
      {
        requestId: req.headers["x-request-id"] as string | undefined,
        correlationId: req.headers["x-correlation-id"] as string | undefined,
      },
    );

    throw new Error(errorMessage);
  }

  // Origin is valid, proceed with token fetch
  try {
    // Fetch token from controller
    const token = await misoClient.getEnvironmentToken();

    // Log audit event with masked client credentials (ISO 27001 compliance)
    const maskedClientId = DataMasker.maskSensitiveData({
      clientId: config.clientId,
    }) as { clientId: string };
    const maskedClientSecret = config.clientSecret
      ? (DataMasker.maskSensitiveData({
          clientSecret: config.clientSecret,
        }) as { clientSecret: string })
      : { clientSecret: undefined };

    await misoClient.log.audit(
      "client.token.request.success",
      "environment-token",
      {
        clientId: maskedClientId.clientId,
        clientSecret: maskedClientSecret.clientSecret,
        origin: req.headers.origin || req.headers.referer || "unknown",
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
      {
        requestId: req.headers["x-request-id"] as string | undefined,
        correlationId: req.headers["x-correlation-id"] as string | undefined,
      },
    );

    return token;
  } catch (error) {
    // Log error and audit event for token fetch failure
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const maskedClientId = DataMasker.maskSensitiveData({
      clientId: config.clientId,
    }) as { clientId: string };

    // Log error
    await misoClient.log.error(
      `Failed to get environment token: ${errorMessage}`,
      {
        clientId: maskedClientId.clientId,
        origin: req.headers.origin || req.headers.referer || "unknown",
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
      error instanceof Error ? error.stack : undefined,
      {
        requestId: req.headers["x-request-id"] as string | undefined,
        correlationId: req.headers["x-correlation-id"] as string | undefined,
      },
    );

    // Log audit event (ISO 27001 compliance)
    await misoClient.log.audit(
      "client.token.request.failed",
      "environment-token",
      {
        reason: "token_fetch_failed",
        error: errorMessage,
        clientId: maskedClientId.clientId,
        origin: req.headers.origin || req.headers.referer || "unknown",
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
      },
      {
        requestId: req.headers["x-request-id"] as string | undefined,
        correlationId: req.headers["x-correlation-id"] as string | undefined,
      },
    );

    throw error;
  }
}
