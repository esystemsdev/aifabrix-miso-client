/**
 * Token utility functions
 * Utilities for decoding and extracting information from JWT tokens
 */

import jwt from "jsonwebtoken";
import { isBrowser } from "./data-client-utils";
import { writeWarn } from "./console-logger";

/**
 * Client token information extracted from JWT
 */
export interface ClientTokenInfo {
  application?: string;
  environment?: string;
  applicationId?: string;
  clientId?: string;
}

/**
 * Decode JWT token payload (browser-safe)
 * Uses manual base64 decoding in browser, jwt.decode() in Node.js
 */
function decodeJWT(token: string): Record<string, unknown> | null {
  if (isBrowser()) {
    // Browser: use manual base64 decoding
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (handle base64url encoding)
      let payloadStr = parts[1];
      // Add padding if needed
      while (payloadStr.length % 4) {
        payloadStr += '=';
      }
      // Replace URL-safe characters
      payloadStr = payloadStr.replace(/-/g, '+').replace(/_/g, '/');

      const decoded = JSON.parse(atob(payloadStr));
      return decoded as Record<string, unknown>;
    } catch (error) {
      writeWarn(`[decodeJWT] Browser decode failed: ${String(error)}`);
      return null;
    }
  } else {
    // Node.js: use jsonwebtoken library
    try {
      return jwt.decode(token) as Record<string, unknown> | null;
    } catch (error) {
      writeWarn(`[decodeJWT] Node.js decode failed: ${String(error)}`);
      return null;
    }
  }
}

function str(value: unknown): value is string {
  return typeof value === "string";
}

function pickOne(
  decoded: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = decoded[key];
    if (str(v)) return v;
  }
  return undefined;
}

/**
 * Extract client token information from JWT token
 * Decodes the token without verification (no secret available)
 * Supports multiple field name variations for flexibility
 *
 * @param clientToken - JWT client token string
 * @returns Extracted token information or empty object if decoding fails
 */
export function extractClientTokenInfo(clientToken: string): ClientTokenInfo {
  try {
    const decoded = decodeJWT(clientToken);
    if (!decoded || typeof decoded !== "object") {
      writeWarn("[extractClientTokenInfo] Failed to decode client token: Invalid token format");
      return {};
    }

    const info: ClientTokenInfo = {};
    const app = pickOne(decoded, "application", "app");
    const env = pickOne(decoded, "environment", "env", "environmentKey");
    const appId = pickOne(decoded, "applicationId", "app_id");
    const clientId = pickOne(decoded, "clientId", "client_id");

    if (app) info.application = app;
    if (env) info.environment = env;
    if (appId) info.applicationId = appId;
    if (clientId) info.clientId = clientId;
    return info;
  } catch (error) {
    writeWarn(`[extractClientTokenInfo] Failed to decode client token: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}
