/**
 * Response validation utilities
 * Provides runtime validation for API response structures from miso-controller
 */

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T = unknown> {
  data: T[];
  meta: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    type: string;
  };
  links?: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

/**
 * Validate standard success response structure
 * Supports both nested (response.data.data) and flat (response.data) formats for backward compatibility
 * @param data - Response data to validate
 * @returns True if data matches SuccessResponse structure
 */
export function validateSuccessResponse<T = unknown>(
  data: unknown,
): data is SuccessResponse<T> {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.success !== "boolean") {
    return false;
  }

  if (typeof obj.timestamp !== "string") {
    return false;
  }

  // data and message are optional, but if present must be correct types
  // data can be null, undefined, or any value - all are valid
  // No need to validate data type since it can be anything (null, object, array, string, number, boolean)

  if (obj.message !== undefined && typeof obj.message !== "string") {
    return false;
  }

  return true;
}

/**
 * Validate paginated response structure
 * @param data - Response data to validate
 * @returns True if data matches PaginatedResponse structure
 */
export function validatePaginatedResponse<T = unknown>(
  data: unknown,
): data is PaginatedResponse<T> {
  if (!data || typeof data !== "object") {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required data array
  if (!Array.isArray(obj.data)) {
    return false;
  }

  // Check required meta object
  if (!obj.meta || typeof obj.meta !== "object") {
    return false;
  }

  const meta = obj.meta as Record<string, unknown>;

  // Check required meta fields
  if (typeof meta.totalItems !== "number") {
    return false;
  }

  if (typeof meta.currentPage !== "number") {
    return false;
  }

  if (typeof meta.pageSize !== "number") {
    return false;
  }

  if (typeof meta.type !== "string") {
    return false;
  }

  // Check optional links object
  if (obj.links !== undefined) {
    if (typeof obj.links !== "object" || obj.links === null) {
      return false;
    }

    const links = obj.links as Record<string, unknown>;

    // All link fields are optional strings
    if (
      links.first !== undefined &&
      typeof links.first !== "string"
    ) {
      return false;
    }

    if (links.prev !== undefined && typeof links.prev !== "string") {
      return false;
    }

    if (links.next !== undefined && typeof links.next !== "string") {
      return false;
    }

    if (links.last !== undefined && typeof links.last !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * Validate error response structure (RFC 7807)
 * Re-exports isErrorResponse from config.types.ts for consistency
 * @param data - Response data to validate
 * @returns True if data matches ErrorResponse structure
 */
export { isErrorResponse as validateErrorResponse } from "../types/config.types";

/**
 * Determine if response is a success response or paginated response
 * Useful for HTTP client to decide which validator to use
 * @param data - Response data to check
 * @returns 'success' if success response, 'paginated' if paginated response, 'unknown' otherwise
 */
export function getResponseType(
  data: unknown,
): "success" | "paginated" | "unknown" {
  if (validateSuccessResponse(data)) {
    return "success";
  }

  if (validatePaginatedResponse(data)) {
    return "paginated";
  }

  return "unknown";
}

