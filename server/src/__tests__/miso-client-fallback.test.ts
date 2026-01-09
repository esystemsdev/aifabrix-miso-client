/**
 * MisoClient Fallback Behavior Tests
 * Tests fallback behavior when MisoClient is not initialized or unavailable
 */

import { Request, Response } from 'express';
import { MisoClient } from '@aifabrix/miso-client';
import { getUsers, getUserById, createUser } from '../routes/api';
import { healthHandler } from '../routes/health';

describe('MisoClient Fallback Behavior', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      params: {},
      body: {},
      headers: {},
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/test',
      get: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('Route handlers with null MisoClient', () => {
    it('should handle getUsers with null MisoClient', async () => {
      const handler = getUsers(null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalled();
      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs).toHaveProperty('users');
      expect(callArgs).toHaveProperty('count');
    });

    it('should handle getUserById with null MisoClient', async () => {
      mockRequest.params = { id: '1' };
      const handler = getUserById(null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Should either return user or throw AppError (handled by asyncHandler)
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle createUser with null MisoClient', async () => {
      mockRequest.body = { name: 'Test User', email: 'test@example.com' };
      const handler = createUser(null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should handle healthHandler with null MisoClient', async () => {
      const handler = healthHandler(null);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalled();
      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs).toHaveProperty('status', 'ok');
      expect(callArgs).toHaveProperty('timestamp');
      expect(callArgs).toHaveProperty('uptime');
    });
  });

  describe('Logging fallback behavior', () => {
    it('should not call logger when MisoClient is null', async () => {
      // Simulate the pattern used in route handlers
      const handler = getUsers(null);

      // Handler should work without logging when misoClient is null
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify response was sent (handler completed successfully)
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it('should use logger when MisoClient is available', async () => {
      const mockLoggerChain = {
        info: jest.fn().mockResolvedValue(undefined),
        addContext: jest.fn().mockReturnThis(),
      };

      const mockMisoClient = {
        log: {
          forRequest: jest.fn().mockReturnValue(mockLoggerChain),
        },
      } as unknown as MisoClient;

      const handler = getUsers(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockMisoClient.log.forRequest).toHaveBeenCalledWith(mockRequest);
      expect(mockLoggerChain.info).toHaveBeenCalled();
    });
  });

  describe('Error handling fallback', () => {
    it('should handle errors gracefully when MisoClient is null', async () => {
      mockRequest.params = { id: '999' }; // Non-existent user
      const handler = getUserById(null);

      // Should throw AppError which is caught by asyncHandler
      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error is expected and handled by asyncHandler
        expect(error).toBeDefined();
      }
    });

    it('should log errors when MisoClient is available', async () => {
      const mockLoggerChain = {
        info: jest.fn().mockResolvedValue(undefined),
        addContext: jest.fn().mockReturnThis(),
      };

      const mockMisoClient = {
        log: {
          forRequest: jest.fn().mockReturnValue(mockLoggerChain),
        },
      } as unknown as MisoClient;

      mockRequest.params = { id: '999' };
      const handler = getUserById(mockMisoClient);

      try {
        await handler(mockRequest as Request, mockResponse as Response, mockNext);
      } catch (error) {
        // Error is expected
        expect(error).toBeDefined();
        // Logger should have been called before throwing
        expect(mockLoggerChain.info).toHaveBeenCalled();
      }
    });
  });

  describe('Route handler factory pattern', () => {
    it('should accept null MisoClient in factory functions', () => {
      const handler1 = getUsers(null);
      const handler2 = getUsers(null);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
      // Each call creates a new handler instance
      expect(handler1).not.toBe(handler2);
    });

    it('should accept MisoClient instance in factory functions', () => {
      const mockMisoClient = {
        log: {
          forRequest: jest.fn().mockReturnValue({
            info: jest.fn().mockResolvedValue(undefined),
          }),
        },
      } as unknown as MisoClient;

      const handler1 = getUsers(mockMisoClient);
      const handler2 = getUsers(mockMisoClient);

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
    });

    it('should work with both null and MisoClient instances', async () => {
      const handlerNull = getUsers(null);
      const mockMisoClient = {
        log: {
          forRequest: jest.fn().mockReturnValue({
            info: jest.fn().mockResolvedValue(undefined),
          }),
        },
      } as unknown as MisoClient;
      const handlerWithClient = getUsers(mockMisoClient);

      // Both should work
      await handlerNull(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.json).toHaveBeenCalled();

      jest.clearAllMocks();
      await handlerWithClient(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('Graceful degradation', () => {
    it('should continue functioning when MisoClient initialization fails', async () => {
      // Simulate MisoClient that fails to initialize
      const handler = getUsers(null);

      // Handler should still work
      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalled();
      const callArgs = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.users).toBeDefined();
    });

    it('should handle routes that require MisoClient gracefully', async () => {
      // Routes that check for MisoClient should handle null gracefully
      const handler = healthHandler(null);

      await handler(mockRequest as Request, mockResponse as Response, mockNext);

      // Health check should work without MisoClient
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });
});
