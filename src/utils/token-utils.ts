/**
 * Token utility functions
 * Utilities for decoding and extracting information from JWT tokens
 */

import jwt from "jsonwebtoken";

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
    const decoded = jwt.decode(clientToken) as Record<string, unknown> | null;

    if (!decoded || typeof decoded !== "object") {
      console.warn("Failed to decode client token: Invalid token format");
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

    // environment or env
    if (decoded.environment && typeof decoded.environment === "string") {
      info.environment = decoded.environment;
    } else if (decoded.env && typeof decoded.env === "string") {
      info.environment = decoded.env;
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
    console.warn("Failed to decode client token:", error);
    return {};
  }
}
