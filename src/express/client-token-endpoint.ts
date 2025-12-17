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
    try {
      // Check if misoClient is initialized
      if (!misoClient.isInitialized()) {
        res.status(503).json({
          error: "Service Unavailable",
          message: "MisoClient is not initialized",
        });
        return;
      }

      // Get token with origin validation (throws if validation fails)
      const token = await getEnvironmentToken(misoClient, req);

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
          res.status(500).json({
            error: "Internal Server Error",
            message: "Controller URL not configured",
          });
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

      res.json(response);
    } catch (error) {
      // getEnvironmentToken throws Error with message if origin validation fails
      // This is handled by the error handler middleware if using asyncHandler
      // But we handle it here for direct usage
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Check if it's an origin validation error (403)
      if (errorMessage.includes("Origin validation failed")) {
        res.status(403).json({
          error: "Forbidden",
          message: errorMessage,
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

