/**
 * API routes tests
 */

import { Request, Response, NextFunction } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  patchUser,
  deleteUser,
  getMetrics,
  slowEndpoint,
  errorEndpoint,
  logEndpoint,
} from '../routes/api';
import { MisoClient, handleRouteError } from '@aifabrix/miso-client';

// Mock handleRouteError and asyncHandler
const _mockHandleRouteError = jest.fn();

jest.mock('@aifabrix/miso-client', () => {
  const mockHandleRouteErrorFn = jest.fn(async (error: unknown, req: Request, res: Response) => {
    const statusCode = error instanceof Error && 'statusCode' in error ? (error as { statusCode: number }).statusCode : 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      statusCode,
    });
  });

  return {
    MisoClient: jest.fn(),
    asyncHandler: jest.fn((fn, _operationName) => {
      return async (req: Request, res: Response, _next: NextFunction) => {
        try {
          await fn(req, res, _next);
        } catch (error) {
          await mockHandleRouteErrorFn(error, req, res);
        }
      };
    }),
    AppError: class AppError extends Error {
      constructor(message: string, public statusCode: number) {
        super(message);
        this.name = 'AppError';
      }
    },
    handleRouteError: mockHandleRouteErrorFn,
  };
});

describe('API Routes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  let responseSend: jest.Mock;
  let mockMisoClient: jest.Mocked<Partial<MisoClient>>;
  let mockLoggerChain: {
    info: jest.Mock;
    error: jest.Mock;
    addContext: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockNext = jest.fn();
    responseJson = jest.fn().mockReturnThis();
    responseStatus = jest.fn().mockReturnThis();
    responseSend = jest.fn().mockReturnThis();
    mockRequest = {
      params: {},
      query: {},
      body: {},
    };
    mockResponse = {
      json: responseJson,
      status: responseStatus,
      send: responseSend,
    };

    mockLoggerChain = {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      addContext: jest.fn(function(this: typeof mockLoggerChain) {
        return this;
      }),
    };

    mockMisoClient = {
      log: {
        forRequest: jest.fn().mockReturnValue(mockLoggerChain),
      },
    } as unknown as MisoClient;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return list of users', async () => {
      const handler = getUsers(mockMisoClient as MisoClient | null);
      const handlerPromise = handler(mockRequest as Request, mockResponse as Response, mockNext);

      jest.advanceTimersByTime(100);
      await handlerPromise;

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          users: expect.any(Array),
          count: expect.any(Number),
        })
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockRequest.params = { id: '1' };
      const handler = getUserById(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: '1',
          }),
        })
      );
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: '999' };
      const handler = getUserById(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(handleRouteError).toHaveBeenCalled();
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', async () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
      };
      const handler = createUser(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(201);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            name: 'Test User',
            email: 'test@example.com',
          }),
        })
      );
    });

    it('should return 400 when data is missing', async () => {
      mockRequest.body = {};
      const handler = createUser(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(handleRouteError).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update user when found', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        name: 'Updated User',
        email: 'updated@example.com',
      };
      const handler = updateUser(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            name: 'Updated User',
            email: 'updated@example.com',
          }),
        })
      );
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = {
        name: 'Updated User',
        email: 'updated@example.com',
      };
      const handler = updateUser(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(handleRouteError).toHaveBeenCalled();
    });

    it('should log error when name or email is missing with misoClient', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { name: 'Updated User' }; // Missing email
      const handler = updateUser(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(mockLoggerChain.info).toHaveBeenCalledWith(expect.stringContaining('Update user failed: Name and email are required: 1'));
      expect(handleRouteError).toHaveBeenCalled();
    });
  });

  describe('patchUser', () => {
    it('should partially update user', async () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { email: 'patched@example.com' };
      const handler = patchUser(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'patched@example.com',
          }),
        })
      );
    });

    it('should log error when user not found with misoClient', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { email: 'patched@example.com' };
      const handler = patchUser(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(mockLoggerChain.info).toHaveBeenCalledWith(expect.stringContaining('PATCH /api/users/999 failed: User not found'));
      expect(handleRouteError).toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should delete user when found', async () => {
      mockRequest.params = { id: '1' };
      const handler = deleteUser(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseStatus).toHaveBeenCalledWith(204);
      expect(responseSend).toHaveBeenCalled();
    });

    it('should return 404 when user not found', async () => {
      mockRequest.params = { id: '999' };
      const handler = deleteUser(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(handleRouteError).toHaveBeenCalled();
    });
  });

  describe('getMetrics', () => {
    it('should return metrics', async () => {
      const handler = getMetrics(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          totalRequests: expect.any(Number),
          totalFailures: expect.any(Number),
          averageResponseTime: expect.any(Number),
        })
      );
    });
  });

  describe('slowEndpoint', () => {
    it('should return response after delay', async () => {
      mockRequest.query = { delay: '100' };
      const handler = slowEndpoint(mockMisoClient as MisoClient | null);
      const handlerPromise = handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Advance timers and wait for promise
      await Promise.resolve(); // Allow handler to start
      jest.advanceTimersByTime(100);
      await handlerPromise;

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow response',
          delay: 100,
        })
      );
    });

    it('should use default delay when not specified', async () => {
      mockRequest.query = {};
      const handler = slowEndpoint(mockMisoClient as MisoClient | null);
      const handlerPromise = handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Advance timers and wait for promise
      await Promise.resolve(); // Allow handler to start
      jest.advanceTimersByTime(5000);
      await handlerPromise;

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow response',
          delay: 5000,
        })
      );
    });

    it('should handle invalid delay query parameter', async () => {
      mockRequest.query = { delay: 'invalid' };
      const handler = slowEndpoint(mockMisoClient as MisoClient | null);
      const handlerPromise = handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Advance timers and wait for promise
      await Promise.resolve(); // Allow handler to start
      jest.advanceTimersByTime(5000);
      await handlerPromise;

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow response',
          delay: 5000, // Should default to 5000 when parseInt fails
        })
      );
    });
  });

  describe('errorEndpoint', () => {
    it('should return error with specified status code', async () => {
      mockRequest.params = { code: '404' };
      const handler = errorEndpoint(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(handleRouteError).toHaveBeenCalled();
    });

    it('should default to 500 for invalid code', async () => {
      mockRequest.params = { code: 'invalid' };
      const handler = errorEndpoint(mockMisoClient as MisoClient | null);
      
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error should be handled by handleRouteError
      }

      expect(handleRouteError).toHaveBeenCalled();
    });
  });

  describe('logEndpoint', () => {
    it('should log entry with misoClient and iterate over context', async () => {
      mockRequest.body = {
        level: 'info',
        message: 'Test log',
        userId: 'user-123',
        correlationId: 'corr-456',
      };
      const handler = logEndpoint(mockMisoClient as MisoClient | null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockMisoClient.log?.forRequest).toHaveBeenCalledWith(mockRequest);
      expect(mockLoggerChain.addContext).toHaveBeenCalledWith('level', 'info');
      expect(mockLoggerChain.addContext).toHaveBeenCalledWith('message', 'Test log');
      expect(mockLoggerChain.addContext).toHaveBeenCalledWith('userId', 'user-123');
      expect(mockLoggerChain.addContext).toHaveBeenCalledWith('correlationId', 'corr-456');
      expect(mockLoggerChain.info).toHaveBeenCalledWith('Log entry received');
      expect(responseStatus).toHaveBeenCalledWith(200);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Log received',
        })
      );
    });

    it('should fallback to console.log when misoClient is null', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      mockRequest.body = {
        level: 'info',
        message: 'Test log',
      };
      const handler = logEndpoint(null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith('[LOG]', expect.stringContaining('"level": "info"'));
      expect(responseStatus).toHaveBeenCalledWith(200);
      consoleLogSpy.mockRestore();
    });
  });
});
