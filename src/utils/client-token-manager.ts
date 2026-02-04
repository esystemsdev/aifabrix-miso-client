/**
 * Client token management for InternalHttpClient
 * Handles token fetching, caching, and refresh logic
 */

import axios from "axios";
import { MisoClientConfig, ClientTokenResponse, ErrorResponse } from "../types/config.types";
import { resolveControllerUrl } from "./controller-url-resolver";
import { isAxiosError } from "./http-error-handler";
import { MisoClientError } from "./errors";

/**
 * Token state interface for managing client tokens
 */
export interface TokenState {
  token: string | null;
  expiresAt: Date | null;
}

/**
 * Generate unique correlation ID for request tracking
 * @param clientId - Client ID to include in correlation ID
 * @returns Unique correlation ID string
 */
export function generateCorrelationId(clientId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const clientPrefix = clientId.substring(0, 10);
  return `${clientPrefix}-${timestamp}-${random}`;
}

/**
 * Create HTTP agent for IPv4 with timeout
 * @param isHttps - Whether to create HTTPS agent
 * @param timeout - Connection timeout in milliseconds
 * @returns HTTP or HTTPS agent
 */
export async function createHttpAgent(isHttps: boolean, timeout: number): Promise<import("http").Agent> {
  const http = await import("http");
  const https = await import("https");
  return isHttps ? new https.Agent({ family: 4, timeout }) : new http.Agent({ family: 4, timeout });
}

/**
 * Extract token from response (handles nested and flat formats)
 * @param response - Axios response with ClientTokenResponse data
 * @param tokenState - Token state to update
 * @returns Extracted token or null
 */
export function extractTokenFromResponse(
  response: { data: ClientTokenResponse; status: number },
  tokenState: TokenState,
): string | null {
  const token = response.data.data?.token || response.data.token;
  const expiresIn = response.data.data?.expiresIn || response.data.expiresIn;
  const hasSuccess = response.data.success === true;
  const hasValidStatus = response.status >= 200 && response.status < 300;

  if (token && (hasSuccess || hasValidStatus)) {
    tokenState.token = token;
    if (expiresIn) {
      tokenState.expiresAt = new Date(Date.now() + (expiresIn - 30) * 1000);
    }
    return tokenState.token;
  }
  return null;
}

/**
 * Format error for client token fetch failure
 * @param error - The original error
 * @param correlationId - Request correlation ID
 * @param clientId - Client ID used in the request
 * @returns MisoClientError with structured error response and authMethod
 */
export function formatTokenFetchError(
  error: unknown,
  correlationId: string,
  clientId: string,
): MisoClientError {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  const statusCode = isAxiosError(error) ? error.response?.status : undefined;
  const details = isAxiosError(error) && error.response
    ? `status: ${error.response.status}, data: ${JSON.stringify(error.response.data)}`
    : isAxiosError(error) && error.request ? `code: ${error.code || "N/A"}` : "";

  // Use a descriptive title that includes "Failed to get client token" for backward compatibility
  const title = `Failed to get client token: ${errorMessage}${details ? `. ${details}` : ""}`;

  const errorResponse: ErrorResponse = {
    errors: [`Client credential authentication failed: ${errorMessage}${details ? `. ${details}` : ""}`],
    type: "/Errors/Unauthorized",
    title: title,
    statusCode: statusCode || 401,
    instance: "/api/v1/auth/token",
    authMethod: "client-credentials",
  };

  return new MisoClientError(
    `Failed to authenticate with client credentials (clientId: ${clientId}) [correlationId: ${correlationId}]`,
    errorResponse,
    undefined,
    statusCode || 401,
    "client-credentials",
  );
}

/**
 * Fetch client token from controller using clientSecret (server-side only)
 * @param config - MisoClient configuration
 * @param tokenState - Token state to update
 * @returns Fetched token string
 * @throws MisoClientError if fetch fails
 */
export async function fetchClientToken(
  config: MisoClientConfig,
  tokenState: TokenState,
): Promise<string> {
  if (!config.clientSecret) {
    throw new Error("Cannot fetch client token: clientSecret is required but not provided");
  }

  const correlationId = generateCorrelationId(config.clientId);
  const clientId = config.clientId;
  const requestTimeout = 30000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
    if (typeof timeoutId.unref === "function") {
      timeoutId.unref();
    }
    const controllerUrl = resolveControllerUrl(config);
    const isHttps = controllerUrl.startsWith("https://");
    const httpAgent = await createHttpAgent(isHttps, requestTimeout);

    const tempAxios = axios.create({
      baseURL: controllerUrl,
      timeout: requestTimeout,
      signal: controller.signal,
      httpAgent: !isHttps ? httpAgent : undefined,
      httpsAgent: isHttps ? httpAgent : undefined,
      headers: {
        "Content-Type": "application/json",
        "x-client-id": config.clientId,
        "x-client-secret": config.clientSecret,
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      const rejectTimeout = setTimeout(
        () => reject(new Error(`Request timeout after ${requestTimeout}ms`)),
        requestTimeout,
      );
      if (typeof rejectTimeout.unref === "function") {
        rejectTimeout.unref();
      }
    });

    let response;
    try {
      response = await Promise.race([
        tempAxios.post<ClientTokenResponse>(config.clientTokenUri || "/api/v1/auth/token"),
        timeoutPromise,
      ]);
      clearTimeout(timeoutId);
    } catch (requestError) {
      clearTimeout(timeoutId);
      throw requestError;
    }

    const token = extractTokenFromResponse(response, tokenState);
    if (token) return token;

    throw new Error(
      `Failed to get client token: Invalid response format. Full response: ${JSON.stringify({
        status: response.status,
        data: response.data,
      })} [correlationId: ${correlationId}, clientId: ${clientId}]`,
    );
  } catch (error) {
    throw formatTokenFetchError(error, correlationId, clientId);
  }
}

/**
 * Refresh client token using callback (for browser usage)
 * @param config - MisoClient configuration
 * @param tokenState - Token state to update
 * @returns Refreshed token string
 * @throws Error if refresh fails
 */
export async function refreshClientTokenFromCallback(
  config: MisoClientConfig,
  tokenState: TokenState,
): Promise<string> {
  if (!config.onClientTokenRefresh) {
    throw new Error("Client token expired and no refresh callback provided");
  }

  try {
    const result = await config.onClientTokenRefresh();

    // Update token and expiration
    tokenState.token = result.token;

    if (result.expiresIn) {
      // Set expiration with 30 second buffer before actual expiration
      const bufferExpiresIn = result.expiresIn - 30;
      tokenState.expiresAt = new Date(Date.now() + bufferExpiresIn * 1000);
    }

    return tokenState.token;
  } catch (error) {
    // Clear token on refresh failure
    tokenState.token = null;
    tokenState.expiresAt = null;
    throw error;
  }
}

/**
 * Check if token is valid (exists and not expired with buffer)
 * @param tokenState - Current token state
 * @param bufferMs - Buffer time in milliseconds (default 60000 = 60s)
 * @returns true if token is valid
 */
export function isTokenValid(tokenState: TokenState, bufferMs: number = 60000): boolean {
  const now = new Date();
  return !!(
    tokenState.token &&
    tokenState.expiresAt &&
    tokenState.expiresAt > new Date(now.getTime() + bufferMs)
  );
}
