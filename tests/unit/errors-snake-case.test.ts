/**
 * Unit tests for snake_case error transformation utilities
 */

import {
  transform_error_to_snake_case,
  handle_api_error_snake_case,
  ApiErrorException
} from '../../src/utils/errors';
import type { ErrorEnvelope } from '../../src/types/errors.types';

// Import ErrorResponseSnakeCase type directly from the errors.types module
type ErrorResponseSnakeCase = {
  errors: string[];
  type?: string;
  title?: string;
  status_code: number;
  instance?: string;
  request_key?: string;
};
import { AxiosError } from 'axios';

describe('errors-snake-case', () => {
  describe('transform_error_to_snake_case', () => {
    it('should transform AxiosError with error envelope to snake_case', () => {
      const axiosError = {
        response: {
          data: {
            error: {
              errors: ['Invalid input'],
              type: 'https://docs.aifabrix.ai/errors/validation_error',
              title: 'Invalid input',
              status_code: 400,
              instance: '/api/applications',
              request_key: 'req-b234f'
            }
          },
          status: 400
        },
        config: { url: '/api/applications' },
        message: 'Request failed'
      } as unknown as AxiosError;

      const result = transform_error_to_snake_case(axiosError);
      expect(result.errors).toEqual(['Invalid input']);
      expect(result.type).toBe('https://docs.aifabrix.ai/errors/validation_error');
      expect(result.title).toBe('Invalid input');
      expect(result.status_code).toBe(400);
      expect(result.instance).toBe('/api/applications');
      expect(result.request_key).toBe('req-b234f');
    });

    it('should transform AxiosError with snake_case error directly', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Resource not found'],
            type: 'https://docs.aifabrix.ai/errors/not_found',
            title: 'Not Found',
            status_code: 404
          },
          status: 404
        },
        config: { url: '/api/resource/123' },
        message: 'Not Found'
      } as unknown as AxiosError;

      const result = transform_error_to_snake_case(axiosError);
      expect(result.errors).toEqual(['Resource not found']);
      expect(result.status_code).toBe(404);
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

      const result = transform_error_to_snake_case(axiosError);
      expect(result.errors).toEqual(['Bad request']);
      expect(result.status_code).toBe(400);
    });

    it('should use response status when status_code missing', () => {
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

      const result = transform_error_to_snake_case(axiosError);
      expect(result.status_code).toBe(500);
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

      const result = transform_error_to_snake_case(axiosError);
      expect(result.status_code).toBe(500);
    });

    it('should handle AxiosError without response data', () => {
      const axiosError = {
        response: {
          status: 503
        },
        message: 'Service Unavailable'
      } as unknown as AxiosError;

      const result = transform_error_to_snake_case(axiosError);
      expect(result.errors).toEqual(['Service Unavailable']);
      expect(result.status_code).toBe(503);
      expect(result.type).toBe('about:blank');
    });

    it('should handle network errors (no response)', () => {
      const axiosError = {
        message: 'Network Error'
      } as unknown as AxiosError;

      const result = transform_error_to_snake_case(axiosError);
      // When there's no response object, it falls through to last resort
      // The function checks for 'response' in err, so this will hit the last resort
      expect(result.errors).toEqual(['Unknown error']);
      expect(result.status_code).toBe(0);
      expect(result.type).toBe('about:blank');
    });

    it('should handle standard Error object', () => {
      const error = new Error('Something went wrong');
      const result = transform_error_to_snake_case(error);
      expect(result.errors).toEqual(['Something went wrong']);
      expect(result.status_code).toBe(0);
      expect(result.type).toBe('about:blank');
    });

    it('should handle unknown error types', () => {
      const result = transform_error_to_snake_case('string error');
      expect(result.errors).toEqual(['Unknown error']);
      expect(result.status_code).toBe(0);
    });

    it('should handle error with missing fields', () => {
      const axiosError = {
        response: {
          data: {},
          status: 400
        },
        message: 'Bad Request'
      } as unknown as AxiosError;

      const result = transform_error_to_snake_case(axiosError);
      expect(result.errors).toEqual(['Unknown error']);
      expect(result.type).toBe('about:blank');
      expect(result.status_code).toBe(400);
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

      const result = transform_error_to_snake_case(axiosError);
      expect(result.instance).toBe('/api/test-endpoint');
    });
  });

  describe('ApiErrorException', () => {
    it('should create exception with all fields', () => {
      const errorResponse: ErrorResponseSnakeCase = {
        errors: ['Invalid input'],
        type: 'https://docs.aifabrix.ai/errors/validation_error',
        title: 'Invalid input',
        status_code: 400,
        instance: '/api/applications',
        request_key: 'req-b234f'
      };

      const exception = new ApiErrorException(errorResponse);
      expect(exception.name).toBe('ApiErrorException');
      expect(exception.message).toBe('Invalid input');
      expect(exception.status_code).toBe(400);
      expect(exception.errors).toEqual(['Invalid input']);
      expect(exception.type).toBe('https://docs.aifabrix.ai/errors/validation_error');
      expect(exception.instance).toBe('/api/applications');
      expect(exception.request_key).toBe('req-b234f');
    });

    it('should use default title when missing', () => {
      const errorResponse: ErrorResponseSnakeCase = {
        errors: ['Error occurred'],
        status_code: 500
      };

      const exception = new ApiErrorException(errorResponse);
      expect(exception.message).toBe('API Error');
    });

    it('should handle exception with minimal fields', () => {
      const errorResponse: ErrorResponseSnakeCase = {
        errors: ['Error'],
        status_code: 400
      };

      const exception = new ApiErrorException(errorResponse);
      expect(exception.status_code).toBe(400);
      expect(exception.errors).toEqual(['Error']);
    });
  });

  describe('handle_api_error_snake_case', () => {
    it('should throw ApiErrorException', () => {
      const axiosError = {
        response: {
          data: {
            error: {
              errors: ['Validation failed'],
              status_code: 422
            }
          },
          status: 422
        },
        message: 'Unprocessable Entity'
      } as unknown as AxiosError;

      expect(() => {
        handle_api_error_snake_case(axiosError);
      }).toThrow(ApiErrorException);
    });

    it('should throw with correct error details', () => {
      const axiosError = {
        response: {
          data: {
            errors: ['Not found'],
            status_code: 404,
            title: 'Not Found'
          },
          status: 404
        },
        message: 'Not Found'
      } as unknown as AxiosError;

      try {
        handle_api_error_snake_case(axiosError);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiErrorException);
        if (error instanceof ApiErrorException) {
          expect(error.status_code).toBe(404);
          expect(error.errors).toEqual(['Not found']);
          expect(error.message).toBe('Not Found');
        }
      }
    });
  });
});
