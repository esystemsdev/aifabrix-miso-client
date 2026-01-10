/**
 * Application Context Service
 * Unified service to extract application, applicationId, and environment
 * with consistent fallback logic: client token → clientId parsing
 */

import { HttpClient } from "../utils/http-client";
import { MisoClientConfig } from "../types/config.types";
import { extractClientTokenInfo } from "../utils/token-utils";

/**
 * Application context information
 */
export interface ApplicationContext {
  application: string; // From clientId format: {app} part
  applicationId: string; // From client token (if available), else ""
  environment: string; // From clientId format: {env} part
}

/**
 * Application Context Service
 * Extracts application, applicationId, and environment with fallback logic
 */
export class ApplicationContextService {
  private httpClient: HttpClient;
  private config: MisoClientConfig;
  private cachedContext: ApplicationContext | null = null;

  constructor(httpClient: HttpClient) {
    this.config = httpClient.config;
    this.httpClient = httpClient;
  }

  /**
   * Parse clientId format: miso-controller-{environment}-{application}
   * Example: miso-controller-miso-miso-test → environment: "miso", application: "miso-test"
   * @param clientId - Client ID to parse
   * @returns Parsed environment and application, or null if format doesn't match
   */
  private parseClientIdFormat(clientId: string): {
    environment: string | null;
    application: string | null;
  } {
    try {
      if (!clientId || typeof clientId !== "string") {
        return { environment: null, application: null };
      }

      const parts = clientId.split("-");
      
      // Expect pattern: ["miso", "controller", "{env}", "{app}", ...]
      // Minimum 4 parts required: miso-controller-{env}-{app}
      if (parts.length < 4 || parts[0] !== "miso" || parts[1] !== "controller") {
        return { environment: null, application: null };
      }

      // Extract environment from index 2
      const environment = parts[2] || null;
      
      // Extract application from remaining parts (index 3+), joined with '-'
      const application = parts.slice(3).join("-") || null;

      return { environment, application };
    } catch (error) {
      console.warn("[ApplicationContextService] Failed to parse clientId format:", error);
      return { environment: null, application: null };
    }
  }

  /**
   * Extract client token from HttpClient's internal state or config
   * @returns Client token string or null if not available
   */
  private getClientToken(): string | null {
    try {
      // Try to get client token from config first (if provided)
      if (this.config.clientToken) {
        return this.config.clientToken;
      }

      // Try to access from internal client (private property access)
      // This is a workaround since clientToken is private in InternalHttpClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalClient = (this.httpClient as any).internalClient;
      if (internalClient) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clientToken = (internalClient as any).clientToken;
        if (clientToken && typeof clientToken === "string") {
          return clientToken;
        }
      }

      return null;
    } catch (error) {
      console.warn("[ApplicationContextService] Failed to get client token:", error);
      return null;
    }
  }

  /**
   * Get application context with fallback logic
   * 1. Extract from client token first (if available)
   * 2. Fall back to parsing clientId format
   * @returns Application context with application, applicationId, and environment
   */
  getApplicationContext(): ApplicationContext {
    // Return cached context if available
    if (this.cachedContext) {
      return this.cachedContext;
    }

    let application: string = "";
    let applicationId: string = "";
    let environment: string = "";

    // Step 1: Try to extract from client token
    const clientToken = this.getClientToken();
    if (clientToken) {
      try {
        const tokenInfo = extractClientTokenInfo(clientToken);
        
        // Extract applicationId from client token
        if (tokenInfo.applicationId) {
          applicationId = tokenInfo.applicationId;
        }

        // Extract environment from client token (if available)
        if (tokenInfo.environment) {
          environment = tokenInfo.environment;
        }

        // Extract application from client token (if available)
        if (tokenInfo.application) {
          application = tokenInfo.application;
        }
      } catch (error) {
        console.warn("[ApplicationContextService] Failed to extract from client token:", error);
      }
    }

    // Step 2: Fall back to parsing clientId format
    // Only use parsed values if not already set from client token
    if (!environment || !application) {
      const parsed = this.parseClientIdFormat(this.config.clientId);
      
      if (!environment && parsed.environment) {
        environment = parsed.environment;
      }
      
      if (!application && parsed.application) {
        application = parsed.application;
      }
    }

    // If still no values, use empty strings (don't throw errors)
    const context: ApplicationContext = {
      application: application || "",
      applicationId: applicationId || "",
      environment: environment || "",
    };

    // Cache the result
    this.cachedContext = context;

    return context;
  }

  /**
   * Clear cached context (useful for testing or when config changes)
   */
  clearCache(): void {
    this.cachedContext = null;
  }
}
