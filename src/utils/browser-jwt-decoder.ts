/**
 * Browser-compatible JWT decoder utility
 * Pure JavaScript implementation using base64url decoding
 * Only decodes (doesn't verify signatures) - used for extracting userId from tokens
 */

/**
 * Decode base64url string to regular base64
 * @param str - Base64url encoded string
 * @returns Base64 encoded string
 */
function base64UrlDecode(str: string): string {
  // Replace URL-safe characters with standard base64 characters
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }

  return base64;
}

/**
 * Decode JWT token and extract payload
 * Only decodes (doesn't verify signatures) - used for extracting userId
 * @param token - JWT token string
 * @returns Decoded payload as object or null if decoding fails
 */
export function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Extract payload (second part)
    const payload = parts[1];

    // Decode base64url to base64
    const base64Payload = base64UrlDecode(payload);

    // Decode base64 to string
    const decodedString = atob(base64Payload);

    // Parse JSON payload
    const parsed = JSON.parse(decodedString) as Record<string, unknown>;

    return parsed;
  } catch (error) {
    // Silently handle errors (invalid token format, invalid JSON, etc.)
    return null;
  }
}

/**
 * Extract userId from JWT token
 * Tries common JWT claim fields: sub, userId, user_id, id
 * @param token - JWT token string
 * @returns User ID string or null if not found
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const decoded = decodeJWT(token);
    if (!decoded) {
      return null;
    }

    // Try common JWT claim fields for user ID
    const userId =
      decoded.sub ||
      decoded.userId ||
      decoded.user_id ||
      decoded.id;
    return userId ? (userId as string) : null;
  } catch (error) {
    return null;
  }
}

