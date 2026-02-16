/**
 * Application Context Service
 * Unified service to extract application, applicationId, and environment
 * with consistent fallback logic: client token → clientId parsing
 */

import { HttpClient } from "../utils/http-client";
import { extractClientTokenInfo } from "../utils/token-utils";
import { isBrowser, getLocalStorage } from "../utils/data-client-utils";
import { extractErrorInfo } from "../utils/error-extractor";
import { logErrorWithContext } from "../utils/console-logger";

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
  private cachedContext: ApplicationContext | null = null;

  constructor(httpClient: HttpClient) {
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
      logErrorWithContext(
        extractErrorInfo(error, { endpoint: "parseClientId" }),
        "[ApplicationContextService]",
      );
      return { environment: null, application: null };
    }
  }

  /**
   * Extract client token from config or browser localStorage.
   * @returns Client token string or null if not available
   */
  private getClientToken(): string | null {
    try {
      // Try to get client token from config first (if provided)
      if (this.httpClient.config.clientToken) {
        return this.httpClient.config.clientToken;
      }

      // Try browser localStorage (for browser environments)
      if (isBrowser()) {
        const localStorageToken = getLocalStorage("miso:client-token");
        if (localStorageToken) {
          return localStorageToken;
        }
      }

      return null;
    } catch (error) {
      logErrorWithContext(
        extractErrorInfo(error, { endpoint: "getClientToken" }),
        "[ApplicationContextService]",
      );
      return null;
    }
  }

  /**
   * Extract context from client token.
   */
  private extractFromClientToken(
    clientToken: string,
  ): { application: string; applicationId: string; environment: string } {
    const out = { application: "", applicationId: "", environment: "" };
    try {
      const tokenInfo = extractClientTokenInfo(clientToken);
      if (tokenInfo.applicationId) out.applicationId = tokenInfo.applicationId;
      if (tokenInfo.environment) out.environment = tokenInfo.environment;
      if (tokenInfo.application) out.application = tokenInfo.application;
    } catch (error) {
      logErrorWithContext(
        extractErrorInfo(error, { endpoint: "extractClientToken" }),
        "[ApplicationContextService]",
      );
    }
    return out;
  }

  /**
   * Apply parsed clientId values as fallback when token fields are empty.
   */
  private applyClientIdFallback(
    application: string,
    environment: string,
  ): { application: string; environment: string } {
    if (application && environment) return { application, environment };
    const parsed = this.parseClientIdFormat(this.httpClient.config.clientId);
    return {
      application: application || parsed.application || "",
      environment: environment || parsed.environment || "",
    };
  }

  /**
   * Get application context with fallback logic
   * 1. Extract from client token first (if available)
   * 2. Fall back to parsing clientId format
   * @returns Application context with application, applicationId, and environment
   */
  getApplicationContext(): ApplicationContext {
    if (this.cachedContext) return this.cachedContext;

    let application = "";
    let applicationId = "";
    let environment = "";

    const clientToken = this.getClientToken();
    if (clientToken) {
      const fromToken = this.extractFromClientToken(clientToken);
      applicationId = fromToken.applicationId;
      application = fromToken.application;
      environment = fromToken.environment;
    }

    const fallback = this.applyClientIdFallback(application, environment);
    this.cachedContext = {
      application: fallback.application,
      applicationId: applicationId || "",
      environment: fallback.environment,
    };
    return this.cachedContext;
  }

  /**
   * Clear cached context (useful for testing or when config changes)
   */
  clearCache(): void {
    this.cachedContext = null;
  }
}
