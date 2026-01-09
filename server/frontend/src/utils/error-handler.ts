/**
 * Error handling utilities for parsing and formatting errors
 * Follows RFC 7807 Problem Details for HTTP APIs standard
 */

/**
 * Parsed error with human-readable title and detail
 */
export interface ParsedError {
  /** Human-readable error title */
  title: string;
  /** Detailed error message */
  detail: string;
}

/**
 * Parse error and extract human-readable title and detail following RFC 7807
 * 
 * @param error - Error object to parse
 * @returns Object with title and detail, or null if error can't be parsed
 * 
 * @example
 * ```typescript
 * const parsed = parseError(error);
 * if (parsed) {
 *   toast.error(parsed.title, { description: parsed.detail });
 * }
 * ```
 */
export function parseError(error: Error | null): ParsedError | null {
  if (!error) return null;

  const message = error.message || String(error);

  // Try to extract RFC 7807 Problem Details format from error response FIRST
  // This provides the most specific and accurate error messages
  // Check if error has response property (e.g., ApiError with response)
  try {
    const errorWithResponse = error as Error & { response?: { data?: unknown; json?: () => Promise<unknown> } };
    if (errorWithResponse.response?.data) {
      const responseData = errorWithResponse.response.data;
      if (typeof responseData === 'object' && responseData !== null) {
        const data = responseData as Record<string, unknown>;
        // RFC 7807 Problem Details format: extract both title and detail
        const title = (data.title && typeof data.title === 'string') ? data.title : 'Error';
        const detail = (data.detail && typeof data.detail === 'string') ? data.detail : title;
        if (data.title || data.detail) {
          return { title, detail };
        }
      }
    }
  } catch {
    // Ignore errors accessing response property
  }

  // Try to extract meaningful message from JSON error responses in message string
  // This handles cases where the error payload is embedded in the error message
  // Look for RFC 7807 Problem Details format: {"type":"...","title":"...","detail":"..."}
  try {
    // Try to find JSON object in the message - look for opening brace
    const braceStart = message.indexOf('{');
    if (braceStart !== -1) {
      // Try to extract complete JSON object by finding matching closing brace
      let braceCount = 0;
      let braceEnd = -1;
      for (let i = braceStart; i < message.length; i++) {
        if (message[i] === '{') braceCount++;
        if (message[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            braceEnd = i;
            break;
          }
        }
      }
      
      if (braceEnd !== -1) {
        const jsonStr = message.substring(braceStart, braceEnd + 1);
        const parsed = JSON.parse(jsonStr);
        // RFC 7807 Problem Details format: extract both title and detail
        if (parsed.title || parsed.detail) {
          const title = (parsed.title && typeof parsed.title === 'string') ? parsed.title : 'Error';
          const detail = (parsed.detail && typeof parsed.detail === 'string') ? parsed.detail : title;
          return { title, detail };
        }
        // Fallback to other common error fields
        if (parsed.message && typeof parsed.message === 'string') {
          return { title: 'Error', detail: parsed.message };
        }
        if (parsed.error && typeof parsed.error === 'string') {
          return { title: 'Error', detail: parsed.error };
        }
      }
    }
  } catch {
    // Ignore JSON parsing errors
  }

  // Fallback: Pattern matching for network/connection errors that don't have structured payloads
  // These errors typically don't come from API responses, so they won't have RFC 7807 format
  
  // Empty response errors (server closed connection without response)
  if (message.includes('ERR_EMPTY_RESPONSE') || message.includes('empty response') || message.includes('Connection error')) {
    return { title: 'Connection Error', detail: 'The server closed the connection without sending a response. Please check if the server is running and accessible.' };
  }

  // Timeout errors (network-level timeouts) - check before general network errors
  if (message.includes('timeout') || message.includes('Timeout') || message.includes('did not respond within')) {
    return { title: 'Timeout Error', detail: 'Request timed out. Please check your network connection and ensure the server is running.' };
  }

  // Network errors (connection failures, fetch errors)
  if (message.includes('Network') || message.includes('Failed to fetch') || message.includes('network')) {
    return { title: 'Network Error', detail: 'Unable to connect to server. Please check if the server is running and accessible.' };
  }

  // CORS errors (browser-level, not API responses)
  if (message.includes('CORS') || message.includes('cross-origin') || message.includes('CORS policy')) {
    return { title: 'CORS Error', detail: 'Cross-origin request blocked. Please check CORS configuration on the server.' };
  }

  // Connection errors (system-level, not API responses)
  if (message.includes('ECONNREFUSED') || message.includes('connection refused')) {
    return { title: 'Connection Error', detail: 'Connection refused. Please check if the server is running and accessible.' };
  }

  if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    return { title: 'Connection Error', detail: 'Unable to resolve server address. Please check the server URL configuration.' };
  }

  // If we can't parse it, return null to use original message
  return null;
}

/**
 * Extract error message from unknown error type
 * 
 * @param error - Unknown error value
 * @returns Error message string
 * 
 * @example
 * ```typescript
 * try {
 *   // operation
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   console.error(message);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error occurred';
}

/**
 * Extract error status code from error object
 * 
 * @param error - Error object
 * @returns HTTP status code or null
 * 
 * @example
 * ```typescript
 * const status = getErrorStatus(error);
 * if (status === 401) {
 *   // Handle unauthorized
 * }
 * ```
 */
export function getErrorStatus(error: unknown): number | null {
  const errorObj = error as { status?: number; response?: { status?: number } };
  return errorObj?.status || errorObj?.response?.status || null;
}
