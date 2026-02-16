/**
 * Server-side environment token wrapper
 * Provides origin validation and ISO 27001 compliant audit logging
 */

import { Request } from "express";
import { MisoClient } from "../index";
import { validateOrigin } from "./origin-validator";
import { DataMasker } from "./data-masker";
import { resolveControllerUrl } from "./controller-url-resolver";

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

    // Log error with full request context (automatic extraction via forRequest)
    await misoClient.log
      .forRequest(req)  // Auto-extracts: IP, method, path, userAgent, correlationId, userId
      .addContext("origin", origin)
      .addContext("allowedOrigins", allowedOrigins || [])
      .addContext("reason", "origin_validation_failed")
      .error(errorMessage);

    // Log audit event (ISO 27001 compliance) with full request context
    await misoClient.log
      .forRequest(req)
      .addContext("reason", "origin_validation_failed")
      .addContext("origin", origin)
      .addContext("allowedOrigins", allowedOrigins || [])
      .audit("client.token.request.rejected", "environment-token");

    throw new Error(errorMessage);
  }

  // Origin is valid, proceed with token fetch
  try {
    // Fetch token from controller
    // Use resolveControllerUrl to properly resolve URL (handles controllerPrivateUrl/controllerPublicUrl/controllerUrl)
    resolveControllerUrl(config); // Resolve URL for validation
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

    // Log audit event with full request context (automatic extraction via forRequest)
    await misoClient.log
      .forRequest(req)  // Auto-extracts: IP, method, path, userAgent, correlationId, userId
      .addContext("clientId", maskedClientId.clientId)
      .addContext("clientSecret", maskedClientSecret.clientSecret)
      .addContext("origin", req.headers.origin || req.headers.referer || "unknown")
      .audit("client.token.request.success", "environment-token");

    return token;
  } catch (error) {
    // Log error and audit event for token fetch failure
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const maskedClientId = DataMasker.maskSensitiveData({
      clientId: config.clientId,
    }) as { clientId: string };

    // Log error with full request context (automatic extraction via forRequest)
    await misoClient.log
      .forRequest(req)  // Auto-extracts: IP, method, path, userAgent, correlationId, userId
      .addContext("clientId", maskedClientId.clientId)
      .addContext("origin", req.headers.origin || req.headers.referer || "unknown")
      .addContext("reason", "token_fetch_failed")
      .error(
        `Failed to get environment token: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

    // Log audit event (ISO 27001 compliance) with full request context
    await misoClient.log
      .forRequest(req)
      .addContext("reason", "token_fetch_failed")
      .addContext("error", errorMessage)
      .addContext("clientId", maskedClientId.clientId)
      .addContext("origin", req.headers.origin || req.headers.referer || "unknown")
      .audit("client.token.request.failed", "environment-token");

    throw error;
  }
}
