/**
 * Custom error class for MisoClient SDK
 * Supports structured error responses and backward compatibility
 */

import { ErrorResponse } from '../types/config.types';

/**
 * Custom error class that extends Error
 * Supports structured ErrorResponse and backward compatibility with error_body dict
 */
export class MisoClientError extends Error {
  public readonly errorResponse?: ErrorResponse;
  public readonly errorBody?: Record<string, unknown>;
  public readonly statusCode?: number;

  constructor(
    message: string,
    errorResponse?: ErrorResponse,
    errorBody?: Record<string, unknown>,
    statusCode?: number
  ) {
    // Generate message prioritizing structured errors when available
    let finalMessage = message;
    if (errorResponse) {
      // Use title if available, otherwise use first error from errors array
      if (errorResponse.title) {
        finalMessage = errorResponse.title;
      } else if (errorResponse.errors && errorResponse.errors.length > 0) {
        finalMessage = errorResponse.errors[0];
      }
    }

    super(finalMessage);
    this.name = 'MisoClientError';
    
    // Set properties
    this.errorResponse = errorResponse;
    this.errorBody = errorBody;
    this.statusCode = statusCode ?? errorResponse?.statusCode;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MisoClientError);
    }
  }
}

