/**
 * HTTP response validation utilities for InternalHttpClient
 * Validates response structure against expected formats
 */

import {
  validateSuccessResponse,
  validatePaginatedResponse,
  getResponseType,
} from "./response-validator";
import { MisoClientConfig } from "../types/config.types";

/**
 * Validate response structure if validation is enabled
 * Logs warnings for validation failures but doesn't throw (non-breaking behavior)
 * @param data - Response data to validate
 * @param url - Request URL for error context
 * @param config - Client configuration
 * @returns True if validation passed or is disabled, false if validation failed
 */
export function validateHttpResponse(
  data: unknown,
  url: string,
  config: MisoClientConfig,
): boolean {
  // Skip validation if explicitly disabled
  if (config.validateResponses === false) return true;

  // Skip validation for validate token endpoint - it may return different formats
  if (url.includes("/api/v1/auth/validate") || url.includes("/api/auth/validate")) {
    if (data && typeof data === "object" && "data" in (data as Record<string, unknown>)) {
      return true;
    }
  }

  const responseType = getResponseType(data);

  if (responseType === "unknown") {
    console.warn(
      `Response validation failed for ${url}: Response structure doesn't match expected format.`,
      `Expected: success response ({success, data?, message?, timestamp}) or paginated response ({data[], meta, links?}).`,
      `Actual:`,
      data,
    );
    return false;
  }

  if (responseType === "success" && !validateSuccessResponse(data)) {
    console.warn(
      `Response validation failed for ${url}: Success response structure invalid.`,
      `Expected: {success: boolean, data?: T, message?: string, timestamp: string}.`,
      `Actual:`,
      data,
    );
    return false;
  }

  if (responseType === "paginated" && !validatePaginatedResponse(data)) {
    console.warn(
      `Response validation failed for ${url}: Paginated response structure invalid.`,
      `Expected: {data: T[], meta: {totalItems, currentPage, pageSize, type}, links?}.`,
      `Actual:`,
      data,
    );
    return false;
  }

  return true;
}
