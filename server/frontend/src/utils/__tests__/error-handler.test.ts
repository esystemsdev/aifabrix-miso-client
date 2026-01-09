import { describe, it, expect } from 'vitest';
import { parseError, getErrorMessage, getErrorStatus } from '../error-handler';

describe('error-handler', () => {
  describe('parseError', () => {
    it('should return null for null error', () => {
      expect(parseError(null)).toBeNull();
    });

    it('should parse RFC 7807 error from response.data', () => {
      const error = {
        message: 'Request failed',
        response: {
          data: {
            type: '/Errors/BadRequest',
            title: 'Validation Error',
            detail: 'Invalid input provided',
            statusCode: 400,
          },
        },
      } as Error & { response?: { data?: unknown } };

      const result = parseError(error);
      expect(result).toEqual({
        title: 'Validation Error',
        detail: 'Invalid input provided',
      });
    });

    it('should parse RFC 7807 error with only title', () => {
      const error = {
        message: 'Request failed',
        response: {
          data: {
            title: 'Error occurred',
          },
        },
      } as Error & { response?: { data?: unknown } };

      const result = parseError(error);
      expect(result).toEqual({
        title: 'Error occurred',
        detail: 'Error occurred',
      });
    });

    it('should parse RFC 7807 error from JSON in message string', () => {
      const error = new Error('{"title":"Network Error","detail":"Connection failed"}');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Network Error',
        detail: 'Connection failed',
      });
    });

    it('should parse error with message field from JSON', () => {
      const error = new Error('{"message":"Something went wrong"}');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Error',
        detail: 'Something went wrong',
      });
    });

    it('should parse error with error field from JSON', () => {
      const error = new Error('{"error":"Invalid request"}');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Error',
        detail: 'Invalid request',
      });
    });

    it('should handle empty response errors', () => {
      const error = new Error('ERR_EMPTY_RESPONSE');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Connection Error',
        detail: 'The server closed the connection without sending a response. Please check if the server is running and accessible.',
      });
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Timeout Error',
        detail: 'Request timed out. Please check your network connection and ensure the server is running.',
      });
    });

    it('should handle network errors', () => {
      const error = new Error('Failed to fetch');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Network Error',
        detail: 'Unable to connect to server. Please check if the server is running and accessible.',
      });
    });

    it('should handle CORS errors', () => {
      const error = new Error('CORS policy blocked');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'CORS Error',
        detail: 'Cross-origin request blocked. Please check CORS configuration on the server.',
      });
    });

    it('should handle connection refused errors', () => {
      const error = new Error('ECONNREFUSED');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Connection Error',
        detail: 'Connection refused. Please check if the server is running and accessible.',
      });
    });

    it('should handle DNS errors', () => {
      const error = new Error('ENOTFOUND');
      const result = parseError(error);
      expect(result).toEqual({
        title: 'Connection Error',
        detail: 'Unable to resolve server address. Please check the server URL configuration.',
      });
    });

    it('should return null for unparseable errors', () => {
      const error = new Error('Some random error message');
      const result = parseError(error);
      expect(result).toBeNull();
    });

    it('should handle errors without message', () => {
      const error = { toString: () => 'Error object' } as Error;
      const result = parseError(error);
      expect(result).toBeNull();
    });
  });

  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      const error = new Error('Test error');
      expect(getErrorMessage(error)).toBe('Test error');
    });

    it('should return string as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should return default message for unknown types', () => {
      expect(getErrorMessage(123)).toBe('Unknown error occurred');
      expect(getErrorMessage(null)).toBe('Unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('Unknown error occurred');
      expect(getErrorMessage({})).toBe('Unknown error occurred');
    });
  });

  describe('getErrorStatus', () => {
    it('should extract status from error.status', () => {
      const error = { status: 404 } as { status?: number };
      expect(getErrorStatus(error)).toBe(404);
    });

    it('should extract status from error.response.status', () => {
      const error = {
        response: { status: 500 },
      } as { response?: { status?: number } };
      expect(getErrorStatus(error)).toBe(500);
    });

    it('should prefer error.status over error.response.status', () => {
      const error = {
        status: 400,
        response: { status: 500 },
      } as { status?: number; response?: { status?: number } };
      expect(getErrorStatus(error)).toBe(400);
    });

    it('should return null when no status found', () => {
      expect(getErrorStatus({})).toBeNull();
      expect(getErrorStatus(null)).toBeNull();
      expect(getErrorStatus(undefined)).toBeNull();
      expect(getErrorStatus('error')).toBeNull();
    });
  });
});
