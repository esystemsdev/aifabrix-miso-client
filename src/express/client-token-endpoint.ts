/**
 * Client Token Endpoint Helper
 * Express route handler that automatically enriches client-token response with DataClient configuration
 * 
 * Provides zero-config server-side setup for DataClient initialization
 */

import { Request, Response } from "express";
import { MisoClient } from "../index";
import { getEnvironmentToken } from "../utils/environment-token";
import { resolveControllerUrl } from "../utils/controller-url-resolver";
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

/** Extract HTTP status from error message or axios error chain */
function extractHttpStatus(tokenError: unknown): { status?: number; isNetworkError: boolean } {
  const errorMessage = tokenError instanceof Error ? tokenError.message : "Unknown error";
  const httpStatusMatch = errorMessage.match(/status:\s*(\d+)/i) || errorMessage.match(/status code\s+(\d+)/i) || errorMessage.match(/status\s+(\d+)/i);
  let status = httpStatusMatch ? parseInt(httpStatusMatch[1], 10) : undefined;
  let isNetworkError = false;

  // Walk error chain for axios details
  let currentError: unknown = tokenError;
  for (let i = 0; i < 5 && currentError; i++) {
    if (currentError && typeof currentError === "object" && "isAxiosError" in currentError && currentError.isAxiosError) {
      const axiosError = currentError as import("axios").AxiosError;
      if (axiosError.response) { status = axiosError.response.status; break; }
      if (axiosError.request && !axiosError.response) { isNetworkError = true; break; }
    }
    if (currentError && typeof currentError === "object" && "cause" in currentError) {
      currentError = (currentError as { cause?: unknown }).cause;
    } else break;
  }
  return { status, isNetworkError };
}

/** Check if error message indicates network/timeout error */
function isNetworkOrTimeoutError(errorMessage: string, isAxiosNetworkError: boolean): { isNetwork: boolean; isTimeout: boolean } {
  const isNetwork = isAxiosNetworkError || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|connect|Network Error|network error|getaddrinfo/i.test(errorMessage);
  const isTimeout = errorMessage.includes("Request timeout: Failed to get environment token") || /timeout/i.test(errorMessage);
  return { isNetwork, isTimeout };
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

/**
 * Create Express route handler for client-token endpoint
 * @param misoClient - MisoClient instance (must be initialized)
 * @param options - Optional configuration
 * @returns Express route handler function
 */
export function createClientTokenEndpoint(
  misoClient: MisoClient,
  options?: ClientTokenEndpointOptions,
): (req: Request, res: Response) => Promise<void> {
  const opts = { clientTokenUri: "/api/v1/auth/client-token", expiresIn: 1800, includeConfig: true, ...options };

  return async (req: Request, res: Response): Promise<void> => {
    const isResponseSent = () => res.headersSent || res.writableEnded;

    try {
      if (!misoClient.isInitialized()) {
        if (!isResponseSent()) sendErrorResponse(res, createErrorResponse("MisoClient is not initialized", 503, req));
        return;
      }

      // Fetch token with timeout
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Request timeout: Failed to get environment token within 5 seconds")), 5000));
      let token: string;
      try {
        token = await Promise.race([getEnvironmentToken(misoClient, req), timeoutPromise]);
      } catch (tokenError) {
        if (!isResponseSent()) handleTokenError(tokenError, req, res, misoClient);
        return;
      }

      // Build response
      const response: ClientTokenResponse = { token, expiresIn: opts.expiresIn };
      if (opts.includeConfig) {
        const configResponse = buildConfigResponse(req, misoClient, opts.clientTokenUri);
        if (!configResponse) {
          if (!isResponseSent()) sendErrorResponse(res, createErrorResponse("Controller URL not configured", 500, req));
          return;
        }
        response.config = configResponse;
      }

      if (!isResponseSent()) res.json(response);
    } catch (error) {
      if (isResponseSent()) return;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("Origin validation failed")) { sendErrorResponse(res, createErrorResponse(errorMessage, 403, req)); return; }
      if (/timeout/i.test(errorMessage)) { sendErrorResponse(res, createErrorResponse("Failed to get environment token: Request timed out", 504, req)); return; }
      sendErrorResponse(res, createErrorResponse(errorMessage, 500, req));
    }
  };
}

