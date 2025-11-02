/**
 * Unit tests for camelCase error transformation utilities
 */

import {
  transformError,
  handleApiError,
  ApiErrorException
} from '../../src/utils/errors';
import type { ErrorEnvelope, ErrorResponse as ErrorResponseFromErrors } from '../../src/types/errors.types';
import { AxiosError } from 'axios';

describe('errors', () => {
  describe('transformError', () => {
    it('should transform AxiosError with error envelope to camelCase', () => {
      const axiosError = {
        response: {
          data: {
            error: {
              errors: ['Invalid input'],
              type: 'https://docs.aifabrix.ai/errors/validation_error',
              title: 'Invalid input',
              statusCode: 400,
              instance: '/api/applications',
              requestKey: 'req-b234f'
            }
          },
          status: 400
        },
        config: { url: '/api/applications' },
        message: 'Request failed'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.errors).toEqual(['Invalid input']);
      expect(result.type).toBe('https://docs.aifabrix.ai/errors/validation_error');
      expect(result.title).toBe('Invalid input');
      expect(result.statusCode).toBe(400);
      expect(result.instance).toBe('/api/applications');
      expect(result.requestKey).toBe('req-b234f');
    });

    it('should transform AxiosError with camelCase error directly', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Resource not found'],
            type: 'https://docs.aifabrix.ai/errors/not_found',
            title: 'Not Found',
            statusCode: 404
          },
          status: 404
        },
        config: { url: '/api/resource/123' },
        message: 'Not Found'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.errors).toEqual(['Resource not found']);
      expect(result.statusCode).toBe(404);
    });

    it('should transform AxiosError with camelCase error', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Bad request'],
            type: '/Errors/BadRequest',
            title: 'Bad Request',
            statusCode: 400
          },
          status: 400
        },
        config: { url: '/api/test' },
        message: 'Bad Request'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.errors).toEqual(['Bad request']);
      expect(result.statusCode).toBe(400);
    });

    it('should use response status when statusCode missing', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Server error']
          },
          status: 500
        },
        config: { url: '/api/test' },
        message: 'Internal Server Error'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.statusCode).toBe(500);
    });

    it('should default to 500 when no status available', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Unknown error']
          },
          status: undefined
        },
        config: { url: '/api/test' },
        message: 'Error'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.statusCode).toBe(500);
    });

    it('should handle AxiosError without response data', () => {
      const axiosError = {
        response: {
          status: 503
        },
        message: 'Service Unavailable'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.errors).toEqual(['Service Unavailable']);
      expect(result.statusCode).toBe(503);
      expect(result.type).toBe('about:blank');
    });

    it('should handle network errors (no response)', () => {
      const axiosError = {
        message: 'Network Error'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      // When there's no response object, it falls through to last resort
      // The function checks for 'response' in err, so this will hit the last resort
      expect(result.errors).toEqual(['Unknown error']);
      expect(result.statusCode).toBe(0);
      expect(result.type).toBe('about:blank');
    });

    it('should handle standard Error object', () => {
      const error = new Error('Something went wrong');
      const result = transformError(error);
      expect(result.errors).toEqual(['Something went wrong']);
      expect(result.statusCode).toBe(0);
      expect(result.type).toBe('about:blank');
    });

    it('should handle unknown error types', () => {
      const result = transformError('string error');
      expect(result.errors).toEqual(['Unknown error']);
      expect(result.statusCode).toBe(0);
    });

    it('should handle error with missing fields', () => {
      const axiosError = {
        response: {
          data: {},
          status: 400
        },
        message: 'Bad Request'
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.errors).toEqual(['Unknown error']);
      expect(result.type).toBe('about:blank');
      expect(result.statusCode).toBe(400);
    });

    it('should extract instance from config.url', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Error']
          },
          status: 400
        },
        config: { url: '/api/test-endpoint' }
      } as unknown as AxiosError;

      const result = transformError(axiosError);
      expect(result.instance).toBe('/api/test-endpoint');
    });
  });

  describe('ApiErrorException', () => {
    it('should create exception with all fields', () => {
      const errorResponse: ErrorResponseFromErrors = {
        errors: ['Invalid input'],
        type: 'https://docs.aifabrix.ai/errors/validation_error',
        title: 'Invalid input',
        statusCode: 400,
        instance: '/api/applications',
        requestKey: 'req-b234f'
      };

      const exception = new ApiErrorException(errorResponse);
      expect(exception.name).toBe('ApiErrorException');
      expect(exception.message).toBe('Invalid input');
      expect(exception.statusCode).toBe(400);
      expect(exception.errors).toEqual(['Invalid input']);
      expect(exception.type).toBe('https://docs.aifabrix.ai/errors/validation_error');
      expect(exception.instance).toBe('/api/applications');
      expect(exception.requestKey).toBe('req-b234f');
    });

    it('should use default title when missing', () => {
      const errorResponse: ErrorResponseFromErrors = {
        errors: ['Error occurred'],
        statusCode: 500
      };

      const exception = new ApiErrorException(errorResponse);
      expect(exception.message).toBe('API Error');
    });

    it('should handle exception with minimal fields', () => {
      const errorResponse: ErrorResponseFromErrors = {
        errors: ['Error'],
        statusCode: 400
      };

      const exception = new ApiErrorException(errorResponse);
      expect(exception.statusCode).toBe(400);
      expect(exception.errors).toEqual(['Error']);
    });
  });

  describe('handleApiError', () => {
    it('should throw ApiErrorException', () => {
      const axiosError = {
        response: {
          data: {
            error: {
              errors: ['Validation failed'],
              statusCode: 422
            }
          },
          status: 422
        },
        message: 'Unprocessable Entity'
      } as unknown as AxiosError;

      expect(() => {
        handleApiError(axiosError);
      }).toThrow(ApiErrorException);
    });

    it('should throw with correct error details', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Not found'],
            statusCode: 404,
            title: 'Not Found'
          },
          status: 404
        },
        message: 'Not Found'
      } as unknown as AxiosError;

      try {
        handleApiError(axiosError);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiErrorException);
        if (error instanceof ApiErrorException) {
          expect(error.statusCode).toBe(404);
          expect(error.errors).toEqual(['Not found']);
          expect(error.message).toBe('Not Found');
        }
      }
    });
  });
});
