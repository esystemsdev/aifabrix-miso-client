/**
 * CORS middleware tests
 */

import { Request, Response } from 'express';
import { corsMiddleware } from '../../middleware/cors';
import { MisoClient, validateOrigin } from '@aifabrix/miso-client';

// Mock validateOrigin
jest.mock('@aifabrix/miso-client', () => ({
  MisoClient: jest.fn(),
  validateOrigin: jest.fn(),
}));

describe('corsMiddleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let mockSetHeader: jest.Mock;
  let mockSendStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetHeader = jest.fn();
    mockSendStatus = jest.fn();
    mockNext = jest.fn();

    mockRequest = {
      headers: {},
      method: 'GET',
    };

    mockResponse = {
      header: mockSetHeader,
      setHeader: mockSetHeader,
      sendStatus: mockSendStatus,
    };

    (validateOrigin as jest.Mock).mockReturnValue({ valid: true });
  });

  it('should set CORS headers for valid origin', async () => {
    mockRequest.headers = { origin: 'http://localhost:3000' };
    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-token');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should set CORS headers even for invalid origin (fail open)', async () => {
    mockRequest.headers = { origin: 'http://invalid-origin.com' };
    (validateOrigin as jest.Mock).mockReturnValue({ valid: false });
    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://invalid-origin.com');
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle OPTIONS request', async () => {
    mockRequest.method = 'OPTIONS';
    mockRequest.headers = { origin: 'http://localhost:3000' };
    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockSendStatus).toHaveBeenCalledWith(200);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should set wildcard origin when no origin header is present', async () => {
    mockRequest.headers = {};
    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle validation error and log with MisoClient', async () => {
    mockRequest.headers = { origin: 'http://localhost:3000' };
    const error = new Error('Validation failed');
    (validateOrigin as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const mockLoggerChain = {
      addContext: jest.fn().mockReturnThis(),
      info: jest.fn().mockResolvedValue(undefined),
    };

    const mockMisoClient = {
      log: {
        forRequest: jest.fn().mockReturnValue(mockLoggerChain),
      },
    } as unknown as MisoClient;

    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins, mockMisoClient);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockMisoClient.log.forRequest).toHaveBeenCalledWith(mockRequest);
    expect(mockLoggerChain.addContext).toHaveBeenCalledWith('error', 'Validation failed');
    expect(mockLoggerChain.addContext).toHaveBeenCalledWith('level', 'warning');
    expect(mockLoggerChain.info).toHaveBeenCalledWith('Origin validation error (allowing anyway)');
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle logger failure gracefully', async () => {
    mockRequest.headers = { origin: 'http://localhost:3000' };
    const error = new Error('Validation failed');
    (validateOrigin as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const mockLoggerChain = {
      addContext: jest.fn().mockReturnThis(),
      info: jest.fn().mockRejectedValue(new Error('Logger failed')),
    };

    const mockMisoClient = {
      log: {
        forRequest: jest.fn().mockReturnValue(mockLoggerChain),
      },
    } as unknown as MisoClient;

    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins, mockMisoClient);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleWarnSpy).toHaveBeenCalledWith('Origin validation error (allowing anyway):', error);
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    expect(mockNext).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('should handle validation error without MisoClient', async () => {
    mockRequest.headers = { origin: 'http://localhost:3000' };
    const error = new Error('Validation failed');
    (validateOrigin as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins, null);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleWarnSpy).toHaveBeenCalledWith('Origin validation error (allowing anyway):', error);
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    expect(mockNext).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('should handle non-Error thrown in validation', async () => {
    mockRequest.headers = { origin: 'http://localhost:3000' };
    const error = 'String error';
    (validateOrigin as jest.Mock).mockImplementation(() => {
      throw error;
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const allowedOrigins = ['http://localhost:3000'];
    const middleware = corsMiddleware(allowedOrigins, null);

    await middleware(mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleWarnSpy).toHaveBeenCalledWith('Origin validation error (allowing anyway):', error);
    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:3000');
    expect(mockNext).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });
});
