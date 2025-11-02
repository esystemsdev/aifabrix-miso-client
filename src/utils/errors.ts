/**
 * Custom error class for MisoClient SDK
 * Supports structured error responses and backward compatibility
 */

import { ErrorResponse } from '../types/config.types';
import { ErrorResponse as ErrorResponseSnakeCase, ErrorEnvelope } from '../types/errors.types';

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

/**
 * Transform arbitrary error into standardized snake_case ErrorResponse.
 * Handles both camelCase and snake_case error formats.
 * @param err - Error object (AxiosError, network error, etc.)
 * @returns Standardized snake_case ErrorResponse
 */
export function transform_error_to_snake_case(err: unknown): ErrorResponseSnakeCase {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosError = err as { response?: { data?: unknown; status?: number }; config?: { url?: string }; message?: string };
    
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      
      // Handle error envelope format
      if (typeof data === 'object' && data !== null && 'error' in data) {
        const envelope = data as ErrorEnvelope;
        const errorData = envelope.error;
        
        // Normalize status_code (support both camelCase and snake_case)
        const statusCode = errorData.status_code ?? (errorData as unknown as { statusCode?: number }).statusCode ?? axiosError.response.status ?? 500;
        
        return {
          errors: errorData.errors ?? ['Unknown error'],
          type: errorData.type ?? 'about:blank',
          title: errorData.title ?? axiosError.message ?? 'Unknown error',
          status_code: statusCode,
          instance: errorData.instance ?? axiosError.config?.url,
          request_key: errorData.request_key
        };
      }
      
      // Handle direct error format (snake_case or camelCase)
      if (typeof data === 'object' && data !== null) {
        const errorData = data as Record<string, unknown>;
        const statusCode = (typeof errorData.status_code === 'number' ? errorData.status_code : 
                           typeof errorData.statusCode === 'number' ? errorData.statusCode : 
                           typeof axiosError.response?.status === 'number' ? axiosError.response.status : 
                           500) as number;
        
        return {
          errors: Array.isArray(errorData.errors) ? (errorData.errors as string[]) : ['Unknown error'],
          type: (errorData.type as string | undefined) ?? 'about:blank',
          title: (errorData.title as string | undefined) ?? axiosError.message ?? 'Unknown error',
          status_code: statusCode,
          instance: (errorData.instance as string | undefined) ?? axiosError.config?.url,
          request_key: errorData.request_key as string | undefined
        };
      }
    }
    
    // Fallback for response without data
    return {
      errors: [(axiosError as { message?: string }).message ?? 'Network error'],
      type: 'about:blank',
      title: 'Network error',
      status_code: axiosError.response?.status ?? 0
    };
  }
  
  // Handle non-Axios errors
  if (err instanceof Error) {
    return {
      errors: [err.message ?? 'Unknown error'],
      type: 'about:blank',
      title: 'Error',
      status_code: 0
    };
  }
  
  // Last resort
  return {
    errors: ['Unknown error'],
    type: 'about:blank',
    title: 'Unknown error',
    status_code: 0
  };
}

/**
 * Exception class for snake_case error responses.
 * Used with snake_case ErrorResponse format.
 */
export class ApiErrorException extends Error {
  status_code: number;
  request_key?: string;
  type?: string;
  instance?: string;
  errors: string[];

  constructor(error: ErrorResponseSnakeCase) {
    super(error.title || 'API Error');
    this.name = 'ApiErrorException';
    this.status_code = error.status_code;
    this.request_key = error.request_key;
    this.type = error.type;
    this.instance = error.instance;
    this.errors = error.errors;

    // Maintain proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiErrorException);
    }
  }
}

/**
 * Handle API error and throw snake_case ApiErrorException.
 * @param err - Error object (AxiosError, network error, etc.)
 * @throws ApiErrorException with snake_case error format
 */
export function handle_api_error_snake_case(err: unknown): never {
  const error = transform_error_to_snake_case(err);
  throw new ApiErrorException(error);
}

