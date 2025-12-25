/**
 * Client Token Endpoint Helper
 * Express route handler that automatically enriches client-token response with DataClient configuration
 * 
 * Provides zero-config server-side setup for DataClient initialization
 */

import { Request, Response } from "express";
import { MisoClient } from "../index";
import { getEnvironmentToken } from "../utils/environment-token";

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

/**
 * Create Express route handler for client-token endpoint
 * Automatically enriches response with DataClient configuration
 * 
 * @param misoClient - MisoClient instance (must be initialized)
 * @param options - Optional configuration
 * @returns Express route handler function
 * 
 * @example
 * ```typescript
 * import { MisoClient, createClientTokenEndpoint } from '@aifabrix/miso-client';
 * 
 * const misoClient = new MisoClient(loadConfig());
 * await misoClient.initialize();
 * 
 * app.post('/api/v1/auth/client-token', createClientTokenEndpoint(misoClient));
 * ```
 */
export function createClientTokenEndpoint(
  misoClient: MisoClient,
  options?: ClientTokenEndpointOptions,
): (req: Request, res: Response) => Promise<void> {
  const opts = {
    clientTokenUri: "/api/v1/auth/client-token",
    expiresIn: 1800,
    includeConfig: true,
    ...options,
  };

  return async (req: Request, res: Response): Promise<void> => {
    // Helper to check if response was already sent
    const isResponseSent = () => res.headersSent || res.writableEnded;

    try {
      // Check if misoClient is initialized
      if (!misoClient.isInitialized()) {
        if (!isResponseSent()) {
          res.status(503).json({
            error: "Service Unavailable",
            message: "MisoClient is not initialized",
          });
        }
        return;
      }

      // Get token with origin validation (throws if validation fails)
      // Wrap in Promise.race with timeout to ensure we don't hang
      // Fail fast after 5 seconds if controller is unreachable
      const timeoutMs = 5000; // 5 seconds - fail fast if controller is unreachable
      const tokenPromise = getEnvironmentToken(misoClient, req);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Request timeout: Failed to get environment token within 5 seconds"));
        }, timeoutMs);
      });

      let token: string;
      try {
        token = await Promise.race([tokenPromise, timeoutPromise]);
      } catch (tokenError) {
        // If response already sent, don't try to send again
        if (isResponseSent()) {
          return;
        }

        const errorMessage = tokenError instanceof Error ? tokenError.message : "Unknown error";
        
        // Check if it's an origin validation error (403)
        if (errorMessage.includes("Origin validation failed")) {
          res.status(403).json({
            error: "Forbidden",
            message: errorMessage,
          });
          return;
        }

        // Check if it's our timeout wrapper error (specific message from timeout promise)
        const isTimeoutWrapperError = errorMessage.includes("Request timeout: Failed to get environment token within 5 seconds");
        
        // Check if error message contains HTTP status codes (indicates HTTP error, not timeout)
        // AuthService wraps axios errors with status info like "status: 401"
        const httpStatusMatch = errorMessage.match(/status:\s*(\d+)/i);
        const httpStatus = httpStatusMatch ? parseInt(httpStatusMatch[1], 10) : undefined;
        const isHttpError = httpStatus !== undefined;
        
        // Also try to extract axios error details from the error chain
        let extractedHttpStatus: number | undefined = httpStatus;
        let httpStatusText: string | undefined;
        
        // Try to extract axios error details from the error chain
        let currentError: unknown = tokenError;
        for (let i = 0; i < 5 && currentError; i++) {
          if (
            currentError &&
            typeof currentError === "object" &&
            "isAxiosError" in currentError &&
            currentError.isAxiosError
          ) {
            const axiosError = currentError as import("axios").AxiosError;
            if (axiosError.response) {
              // Has response = HTTP error (not timeout)
              extractedHttpStatus = axiosError.response.status;
              httpStatusText = axiosError.response.statusText;
              break;
            }
            // No response but has request = network/timeout error
            if (axiosError.request && !axiosError.response) {
              // This is a network/timeout error
              break;
            }
          }
          // Check if error has a cause (for chained errors)
          if (currentError && typeof currentError === "object" && "cause" in currentError) {
            currentError = (currentError as { cause?: unknown }).cause;
          } else {
            break;
          }
        }
        
        // Use extracted status if available, otherwise use parsed status
        const finalHttpStatus = extractedHttpStatus || httpStatus;

        // If it's an HTTP error (like 401), return appropriate status code
        if (isHttpError && finalHttpStatus) {
          // Map common HTTP errors to appropriate status codes
          if (finalHttpStatus === 401) {
            res.status(401).json({
              error: "Unauthorized",
              message: "Failed to get environment token: Invalid client credentials or application not found",
            });
            return;
          }
          if (finalHttpStatus === 403) {
            res.status(403).json({
              error: "Forbidden",
              message: "Failed to get environment token: Access denied",
            });
            return;
          }
          // Other HTTP errors
          res.status(finalHttpStatus).json({
            error: httpStatusText || "Error",
            message: errorMessage,
          });
          return;
        }

        // Check if it's a timeout error (from our wrapper or axios timeout)
        if (isTimeoutWrapperError || errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
          const config = misoClient.getConfig();
          const controllerUrl = config.controllerPrivateUrl || config.controllerUrl;
          res.status(504).json({
            error: "Gateway Timeout",
            message: "Failed to get environment token: Controller request timed out",
            details: {
              controllerUrl: controllerUrl || "NOT CONFIGURED",
              timeout: "4 seconds",
              suggestion: controllerUrl 
                ? `Controller at ${controllerUrl} is not responding. Please check if the controller is running and accessible.`
                : "Controller URL is not configured. Please set MISO_CONTROLLER_URL environment variable.",
            },
          });
          return;
        }

        // Other errors (500)
        res.status(500).json({
          error: "Internal Server Error",
          message: errorMessage,
        });
        return;
      }

      // Build response
      const response: ClientTokenResponse = {
        token,
        expiresIn: opts.expiresIn,
      };

      // Include config if requested
      if (opts.includeConfig) {
        const config = misoClient.getConfig();
        
        // Derive baseUrl from request
        const baseUrl = `${req.protocol}://${req.get("host") || "localhost"}`;
        
        // Get controller URL (prefer controllerPublicUrl for browser, fallback to controllerUrl)
        const controllerUrl = config.controllerPublicUrl || config.controllerUrl;
        
        if (!controllerUrl) {
          if (!isResponseSent()) {
            res.status(500).json({
              error: "Internal Server Error",
              message: "Controller URL not configured",
            });
          }
          return;
        }

        response.config = {
          baseUrl,
          controllerUrl,
          controllerPublicUrl: config.controllerPublicUrl,
          clientId: config.clientId,
          clientTokenUri: opts.clientTokenUri,
        };
      }

      // Send response if not already sent
      if (!isResponseSent()) {
        res.json(response);
      }
    } catch (error) {
      // Final catch-all error handler
      if (isResponseSent()) {
        return;
      }

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Check if it's an origin validation error (403)
      if (errorMessage.includes("Origin validation failed")) {
        res.status(403).json({
          error: "Forbidden",
          message: errorMessage,
        });
        return;
      }

      // Check if it's a timeout error
      if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
        res.status(504).json({
          error: "Gateway Timeout",
          message: "Failed to get environment token: Request timed out",
        });
        return;
      }

      // Other errors (500)
      res.status(500).json({
        error: "Internal Server Error",
        message: errorMessage,
      });
    }
  };
}

