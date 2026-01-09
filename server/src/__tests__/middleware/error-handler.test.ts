/**
 * Error handler middleware tests
 */

import { Request, Response } from 'express';
import { errorHandler, notFoundHandler } from '../../middleware/error-handler';
import { handleRouteError, AppError } from '@aifabrix/miso-client';

// Mock handleRouteError
jest.mock('@aifabrix/miso-client', () => ({
  handleRouteError: jest.fn().mockResolvedValue(undefined),
  asyncHandler: jest.fn((fn) => fn),
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message);
      this.name = 'AppError';
    }
  },
}));

describe('errorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = jest.fn();
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it('should call handleRouteError with error, request, and response', async () => {
    const error = new Error('Test error');
    await errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(handleRouteError).toHaveBeenCalledWith(error, mockRequest, mockResponse);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should handle non-Error objects', async () => {
    const error = 'String error';
    await errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(handleRouteError).toHaveBeenCalledWith(error, mockRequest, mockResponse);
  });
});

describe('notFoundHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = jest.fn();
    mockRequest = {
      method: 'GET',
      path: '/api/nonexistent',
    };
    mockResponse = {};
  });

  it('should throw AppError with 404 status', async () => {
    await expect(
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext)
    ).rejects.toThrow(AppError);

    await expect(
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext)
    ).rejects.toThrow('Route GET /api/nonexistent not found');
  });
});
