/**
 * Client Token Endpoint Helper
 * Express route handler that automatically enriches client-token response with DataClient configuration
 *
 * Provides zero-config server-side setup for DataClient initialization
 */

import { Request, Response, RequestHandler } from "express";
import { MisoClient } from "../index";
import { getEnvironmentToken } from "../utils/environment-token";
import { resolveControllerUrl } from "../utils/controller-url-resolver";
import { asyncHandler } from "./async-handler";
import { createErrorResponse, sendErrorResponse } from "./error-response";

/**
 * DataClient configuration returned by client-token endpoint
 * Contains all necessary configuration for browser-side DataClient initialization
 */
export interface DataClientConfigResponse {
  /** API base URL (derived from request) */
  baseUrl: string;

  /** MISO Controller URL (from misoClient config) */
  controllerUrl: string;

  /** Public controller URL for browser environments (if set) */
  controllerPublicUrl?: string;

  /** Client ID (from misoClient config) */
  clientId: string;

  /** Client token endpoint URI */
  clientTokenUri: string;
}

/**
 * Client token endpoint response
 * Includes token, expiration, and DataClient configuration
 */
export interface ClientTokenResponse {
  /** Client token string */
  token: string;

  /** Token expiration time in seconds */
  expiresIn: number;

  /** DataClient configuration (included when includeConfig is true) */
  config?: DataClientConfigResponse;
}

/**
 * Options for createClientTokenEndpoint
 */
export interface ClientTokenEndpointOptions {
  /** Client token endpoint URI (default: '/api/v1/auth/client-token') */
  clientTokenUri?: string;

  /** Token expiration time in seconds (default: 1800) */
  expiresIn?: number;

  /** Whether to include DataClient config in response (default: true) */
  includeConfig?: boolean;
}

/**
 * Type guard to check if response includes config
 *
 * @param response - Client token response
 * @returns True if response includes config
 */
export function hasConfig(response: ClientTokenResponse): response is ClientTokenResponse & { config: DataClientConfigResponse } {
  return response.config !== undefined;
}

/** Parse HTTP status from error message */
function parseStatusFromMessage(msg: string): number | undefined {
  const m = msg.match(/status:\s*(\d+)/i) || msg.match(/status code\s+(\d+)/i) || msg.match(/status\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Get status/isNetwork from axios error */
function getAxiosResult(axiosError: import("axios").AxiosError): { status?: number; isNetworkError: boolean } {
  if (axiosError.response) return { status: axiosError.response.status, isNetworkError: false };
  if (axiosError.request && !axiosError.response) return { status: undefined, isNetworkError: true };
  return { status: undefined, isNetworkError: false };
}

/** Extract HTTP status from error message or axios error chain */
function extractHttpStatus(tokenError: unknown): { status?: number; isNetworkError: boolean } {
  const msg = tokenError instanceof Error ? tokenError.message : "Unknown error";
  const status = parseStatusFromMessage(msg);
  const isNetworkError = false;

  let cur: unknown = tokenError;
  for (let i = 0; i < 5 && cur; i++) {
    if (cur && typeof cur === "object" && "isAxiosError" in cur && cur.isAxiosError) {
      const r = getAxiosResult(cur as import("axios").AxiosError);
      if (r.status !== undefined || r.isNetworkError) return { status: r.status, isNetworkError: r.isNetworkError };
    }
    cur = cur && typeof cur === "object" && "cause" in cur ? (cur as { cause?: unknown }).cause : null;
  }
  return { status, isNetworkError };
}

/** Check if error message indicates network/timeout error */
function isNetworkOrTimeoutError(errorMessage: string, isAxiosNetworkError: boolean): { isNetwork: boolean; isTimeout: boolean } {
  const isNetwork = isAxiosNetworkError || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect|Network Error|network error|getaddrinfo/i.test(errorMessage);
  const isTimeout = errorMessage.includes("Request timeout: Failed to get environment token") || /timeout/i.test(errorMessage);
  return { isNetwork, isTimeout };
}

/** Fetch token with 5s timeout */
async function fetchTokenWithTimeout(req: Request, misoClient: MisoClient): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Request timeout: Failed to get environment token within 5 seconds")), 5000);
  });
  return Promise.race([getEnvironmentToken(misoClient, req), timeoutPromise]);
}

/** Handle token fetch error and send appropriate response */
function handleTokenError(tokenError: unknown, req: Request, res: Response, misoClient: MisoClient): void {
  const errorMessage = tokenError instanceof Error ? tokenError.message : "Unknown error";

  if (errorMessage.includes("Origin validation failed")) {
    sendErrorResponse(res, createErrorResponse(errorMessage, 403, req)); return;
  }

  const { status, isNetworkError } = extractHttpStatus(tokenError);
  if (status) {
    const msg = status === 401 ? "Failed to get environment token: Invalid client credentials or application not found"
      : status === 403 ? "Failed to get environment token: Access denied" : errorMessage;
    sendErrorResponse(res, createErrorResponse(msg, status, req)); return;
  }

  const { isNetwork, isTimeout } = isNetworkOrTimeoutError(errorMessage, isNetworkError);
  if (isNetwork || isTimeout) {
    const config = misoClient.getConfig();
    let controllerUrl: string;
    try { controllerUrl = resolveControllerUrl(config); } catch { controllerUrl = config.controllerPrivateUrl || config.controllerUrl || "NOT CONFIGURED"; }
    const detail = isNetwork ? `Controller is unreachable. URL: ${controllerUrl}.` : `Controller request timed out. URL: ${controllerUrl}.`;
    sendErrorResponse(res, createErrorResponse(`Failed to get environment token: ${detail}`, 504, req)); return;
  }

  sendErrorResponse(res, createErrorResponse(errorMessage, 500, req));
}

/** Build DataClient config response */
function buildConfigResponse(req: Request, misoClient: MisoClient, clientTokenUri: string): DataClientConfigResponse | null {
  const config = misoClient.getConfig();
  const controllerUrl = config.controllerPublicUrl || config.controllerUrl;
  if (!controllerUrl) return null;
  return {
    baseUrl: `${req.protocol}://${req.get("host") || "localhost"}`,
    controllerUrl, controllerPublicUrl: config.controllerPublicUrl,
    clientId: config.clientId, clientTokenUri,
  };
}

/** Send error for generic handler catch (non-token-fetch errors) */
function sendHandlerError(error: Error, req: Request, res: Response): void {
  const msg = error.message;
  if (msg.includes("Origin validation failed")) {
    sendErrorResponse(res, createErrorResponse(msg, 403, req));
    return;
  }
  if (/timeout/i.test(msg)) {
    sendErrorResponse(res, createErrorResponse("Failed to get environment token: Request timed out", 504, req));
    return;
  }
  sendErrorResponse(res, createErrorResponse(msg, 500, req));
}

/** Core handler logic - fetch token and build response */
async function runClientTokenHandler(
  req: Request,
  res: Response,
  misoClient: MisoClient,
  opts: Required<ClientTokenEndpointOptions>,
): Promise<void> {
  const isSent = () => res.headersSent || res.writableEnded;
  if (!misoClient.isInitialized()) {
    if (!isSent()) sendErrorResponse(res, createErrorResponse("MisoClient is not initialized", 503, req));
    return;
  }

  let token: string;
  try {
    token = await fetchTokenWithTimeout(req, misoClient);
  } catch (tokenError) {
    if (!isSent()) handleTokenError(tokenError, req, res, misoClient);
    return;
  }

  if (!token) {
    if (!isSent()) sendErrorResponse(res, createErrorResponse("Request timeout: Failed to get environment token", 504, req));
    return;
  }

  const response: ClientTokenResponse = { token, expiresIn: opts.expiresIn };
  if (opts.includeConfig) {
    const configResponse = buildConfigResponse(req, misoClient, opts.clientTokenUri);
    if (!configResponse) {
      if (!isSent()) sendErrorResponse(res, createErrorResponse("Controller URL not configured", 500, req));
      return;
    }
    response.config = configResponse;
  }
  if (!isSent()) res.json(response);
}

/**
 * Create Express route handler for client-token endpoint
 * @param misoClient - MisoClient instance (must be initialized)
 * @param options - Optional configuration
 * @returns Express route handler function
 */
export function createClientTokenEndpoint(
  misoClient: MisoClient,
  options?: ClientTokenEndpointOptions,
): RequestHandler {
  const opts: Required<ClientTokenEndpointOptions> = {
    clientTokenUri: "/api/v1/auth/client-token",
    expiresIn: 1800,
    includeConfig: true,
    ...options,
  };

  return asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
      try {
        await runClientTokenHandler(req, res, misoClient, opts);
      } catch (error) {
        if (!res.headersSent && !res.writableEnded) {
          sendHandlerError(error instanceof Error ? error : new Error(String(error)), req, res);
        }
      }
    },
    "createClientTokenEndpoint",
  );
}

