/**
 * Token utility functions
 * Utilities for decoding and extracting information from JWT tokens
 */

import jwt from "jsonwebtoken";
import { isBrowser } from "./data-client-utils";

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
      console.warn("[decodeJWT] Browser decode failed:", error);
      return null;
    }
  } else {
    // Node.js: use jsonwebtoken library
    try {
      return jwt.decode(token) as Record<string, unknown> | null;
    } catch (error) {
      console.warn("[decodeJWT] Node.js decode failed:", error);
      return null;
    }
  }
}

/**
 * Extract client token information from JWT token
 * Decodes the token without verification (no secret available)
 * Supports multiple field name variations for flexibility
 * 
 * @param clientToken - JWT client token string
 * @returns Extracted token information or empty object if decoding fails
 */
export function extractClientTokenInfo(
  clientToken: string,
): ClientTokenInfo {
  try {
    // Decode token without verification (we don't have the secret)
    const decoded = decodeJWT(clientToken);

    if (!decoded || typeof decoded !== "object") {
      console.warn("[extractClientTokenInfo] Failed to decode client token: Invalid token format");
      return {};
    }

    // Extract fields with fallback support
    const info: ClientTokenInfo = {};

    // application or app
    if (decoded.application && typeof decoded.application === "string") {
      info.application = decoded.application;
    } else if (decoded.app && typeof decoded.app === "string") {
      info.application = decoded.app;
    }

    // environment or env or environmentKey (controller uses environmentKey)
    if (decoded.environment && typeof decoded.environment === "string") {
      info.environment = decoded.environment;
    } else if (decoded.env && typeof decoded.env === "string") {
      info.environment = decoded.env;
    } else if (decoded.environmentKey && typeof decoded.environmentKey === "string") {
      info.environment = decoded.environmentKey;
    }

    // applicationId or app_id
    if (decoded.applicationId && typeof decoded.applicationId === "string") {
      info.applicationId = decoded.applicationId;
    } else if (decoded.app_id && typeof decoded.app_id === "string") {
      info.applicationId = decoded.app_id;
    }

    // clientId or client_id
    if (decoded.clientId && typeof decoded.clientId === "string") {
      info.clientId = decoded.clientId;
    } else if (decoded.client_id && typeof decoded.client_id === "string") {
      info.clientId = decoded.client_id;
    }

    return info;
  } catch (error) {
    console.warn("[extractClientTokenInfo] Failed to decode client token:", error instanceof Error ? error.message : error);
    return {};
  }
}
