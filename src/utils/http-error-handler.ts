/**
 * HTTP error handling utilities for InternalHttpClient
 * Handles error parsing and MisoClientError creation
 */

import { AxiosError } from "axios";
import { ErrorResponse, isErrorResponse } from "../types/config.types";
import { MisoClientError } from "./errors";

/**
 * Parse error response from AxiosError
 * Attempts to parse structured ErrorResponse, falls back to null if parsing fails
 */
export function parseErrorResponse(
  error: AxiosError,
  requestUrl?: string,
): ErrorResponse | null {
  try {
    if (!error.response?.data) return null;

    const data = error.response.data;

    // If data is already an object, check if it matches ErrorResponse structure
    if (typeof data === "object" && data !== null && isErrorResponse(data)) {
      return {
        errors: (data as ErrorResponse).errors,
        type: (data as ErrorResponse).type,
        title: (data as ErrorResponse).title,
        statusCode: (data as ErrorResponse).statusCode,
        instance: (data as ErrorResponse).instance || requestUrl,
      };
    }

    // If data is a string, try to parse as JSON
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (isErrorResponse(parsed)) {
          return {
            errors: parsed.errors,
            type: parsed.type,
            title: parsed.title,
            statusCode: parsed.statusCode,
            instance: parsed.instance || requestUrl,
          };
        }
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Create MisoClientError from AxiosError
 * Parses structured error response if available, falls back to errorBody
 */
export function createMisoClientError(
  error: AxiosError,
  requestUrl?: string,
): MisoClientError {
  const statusCode = error.response?.status;
  const errorResponse = parseErrorResponse(error, requestUrl);

  let errorBody: Record<string, unknown> | undefined;
  if (error.response?.data && typeof error.response.data === "object") {
    errorBody = error.response.data as Record<string, unknown>;
  }

  let message = error.message || "Request failed";
  if (error.response) {
    message = error.response.statusText || `Request failed with status code ${statusCode}`;
  }

  return new MisoClientError(message, errorResponse || undefined, errorBody, statusCode);
}

/**
 * Check if error is an AxiosError
 */
export function isAxiosError(error: unknown): error is AxiosError {
  if (error instanceof AxiosError) return true;
  if (typeof error === "object" && error !== null && "isAxiosError" in error) {
    return (error as AxiosError).isAxiosError === true;
  }
  return false;
}
