/**
 * Server-side environment token wrapper
 * Provides origin validation and ISO 27001 compliant audit logging
 */

import { Request } from "express";
import { MisoClient } from "../index";
import { validateOrigin } from "./origin-validator";
import { DataMasker } from "./data-masker";
import { resolveControllerUrl } from "./controller-url-resolver";

function getOrigin(req: Request): string {
  return (req.headers.origin || req.headers.referer || "unknown") as string;
}

async function rejectOriginValidation(
  misoClient: MisoClient,
  req: Request,
  errorMessage: string,
  origin: string,
  allowedOrigins: string[] | undefined,
): Promise<never> {
  const logger = misoClient.log.forRequest(req);
  await logger
    .addContext("origin", origin)
    .addContext("allowedOrigins", allowedOrigins || [])
    .addContext("reason", "origin_validation_failed")
    .error(errorMessage);
  await logger
    .addContext("reason", "origin_validation_failed")
    .addContext("origin", origin)
    .addContext("allowedOrigins", allowedOrigins || [])
    .audit("client.token.request.rejected", "environment-token");
  throw new Error(errorMessage);
}

async function logTokenSuccess(
  misoClient: MisoClient,
  req: Request,
  config: ReturnType<MisoClient["getConfig"]>,
): Promise<void> {
  const maskedClientId = DataMasker.maskSensitiveData({ clientId: config.clientId }) as { clientId: string };
  const maskedClientSecret = config.clientSecret
    ? (DataMasker.maskSensitiveData({ clientSecret: config.clientSecret }) as { clientSecret: string })
    : { clientSecret: undefined };
  await misoClient.log
    .forRequest(req)
    .addContext("clientId", maskedClientId.clientId)
    .addContext("clientSecret", maskedClientSecret.clientSecret)
    .addContext("origin", getOrigin(req))
    .audit("client.token.request.success", "environment-token");
}

async function logTokenFailure(
  misoClient: MisoClient,
  req: Request,
  config: ReturnType<MisoClient["getConfig"]>,
  errorMessage: string,
  stack?: string,
): Promise<void> {
  const maskedClientId = DataMasker.maskSensitiveData({ clientId: config.clientId }) as { clientId: string };
  const logger = misoClient.log.forRequest(req);
  await logger
    .addContext("clientId", maskedClientId.clientId)
    .addContext("origin", getOrigin(req))
    .addContext("reason", "token_fetch_failed")
    .error(`Failed to get environment token: ${errorMessage}`, stack);
  await logger
    .addContext("reason", "token_fetch_failed")
    .addContext("error", errorMessage)
    .addContext("clientId", maskedClientId.clientId)
    .addContext("origin", getOrigin(req))
    .audit("client.token.request.failed", "environment-token");
}

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
  const validation = validateOrigin(req, config.allowedOrigins);

  if (!validation.valid) {
    const errorMessage = `Origin validation failed: ${validation.error}`;
    await rejectOriginValidation(
      misoClient,
      req,
      errorMessage,
      getOrigin(req),
      config.allowedOrigins,
    );
  }

  try {
    resolveControllerUrl(config);
    const token = await misoClient.getEnvironmentToken();
    await logTokenSuccess(misoClient, req, config);
    return token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logTokenFailure(
      misoClient,
      req,
      config,
      errorMessage,
      error instanceof Error ? error.stack : undefined,
    );
    throw error;
  }
}
