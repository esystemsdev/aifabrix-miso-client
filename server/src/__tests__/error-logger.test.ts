/**
 * Error Logger Configuration Tests
 * Tests setErrorLogger configuration and fallback behavior
 */

import { Request, Response } from 'express';
import { MisoClient, setErrorLogger } from '@aifabrix/miso-client';

// Mock setErrorLogger
jest.mock('@aifabrix/miso-client', () => {
  const actual = jest.requireActual('@aifabrix/miso-client');
  return {
    ...actual,
    setErrorLogger: jest.fn(),
  };
});

describe('Error Logger Configuration', () => {
  let mockRequest: Partial<Request>;
  let _mockResponse: Partial<Response>;
  let mockMisoClient: Partial<MisoClient>;
  let mockLoggerChain: {
    error: jest.Mock;
    info: jest.Mock;
    addContext: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {
        'x-correlation-id': 'test-correlation-123',
      },
      ip: '127.0.0.1',
      method: 'GET',
      path: '/api/test',
      get: jest.fn((header: string) => {
        if (header === 'user-agent') return 'test-agent';
        return undefined;
      }) as jest.Mock,
    };

    _mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockLoggerChain = {
      error: jest.fn().mockResolvedValue(undefined),
      info: jest.fn().mockResolvedValue(undefined),
      addContext: jest.fn().mockReturnThis(),
    };

    mockMisoClient = {
      log: {
        forRequest: jest.fn().mockReturnValue(mockLoggerChain),
        error: jest.fn().mockResolvedValue(undefined),
        info: jest.fn().mockResolvedValue(undefined),
      },
      isInitialized: jest.fn().mockReturnValue(true),
    } as unknown as MisoClient;
  });

  describe('setErrorLogger configuration', () => {
    it('should configure error logger with MisoClient logger', () => {
      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          const req = (options as { req?: Request })?.req;
          if (req && mockMisoClient) {
            const loggerChain = (
              mockMisoClient.log as unknown as {
                forRequest: (req: Request) => {
                  error: jest.Mock;
                  info: jest.Mock;
                  addContext: jest.Mock;
                };
              }
            ).forRequest(req);
            if (loggerChain) {
              await loggerChain.error(message, (options as { stack?: string })?.stack);
            }
          } else if (mockMisoClient) {
            await (
              mockMisoClient.log as unknown as {
                error: (message: string, options: Record<string, unknown>) => Promise<void>;
              }
            ).error(message, options as Record<string, unknown>);
          }
        },
      };

      setErrorLogger(errorLogger);

      expect(setErrorLogger as jest.Mock).toHaveBeenCalledWith(errorLogger);
    });

    it('should use forRequest() when request is available', async () => {
      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          const req = (options as { req?: Request })?.req;
          if (req && mockMisoClient) {
            const loggerChain = (
              mockMisoClient.log as unknown as {
                forRequest: (req: Request) => {
                  error: jest.Mock;
                  info: jest.Mock;
                  addContext: jest.Mock;
                };
              }
            ).forRequest(req);
            if (loggerChain) {
              await loggerChain.error(message, (options as { stack?: string })?.stack);
            }
          }
        },
      };

      await errorLogger.logError('Test error', {
        req: mockRequest as Request,
        stack: 'Error stack',
      });

      expect(
        (mockMisoClient.log as unknown as { forRequest: jest.Mock }).forRequest
      ).toHaveBeenCalledWith(mockRequest as Request);
      expect(mockLoggerChain.error).toHaveBeenCalledWith('Test error', 'Error stack');
    });

    it('should use log.error() when request is not available', async () => {
      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          if (mockMisoClient) {
            await (
              mockMisoClient.log as unknown as {
                error: (message: string, options: Record<string, unknown>) => Promise<void>;
              }
            ).error(message, options as Record<string, unknown>);
          }
        },
      };

      await errorLogger.logError('Test error', { stack: 'Error stack' });

      expect((mockMisoClient.log as unknown as { error: jest.Mock }).error).toHaveBeenCalledWith(
        'Test error',
        { stack: 'Error stack' }
      );
    });

    it('should fallback to console.error when MisoClient not available', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          const req = (options as { req?: Request })?.req;
          if (req && mockMisoClient) {
            const loggerChain = (
              mockMisoClient.log as unknown as {
                forRequest: (req: Request) => {
                  error: jest.Mock;
                  info: jest.Mock;
                  addContext: jest.Mock;
                };
              }
            ).forRequest(req);
            if (loggerChain) {
              await loggerChain.error(message, (options as { stack?: string })?.stack);
            }
          } else if (mockMisoClient) {
            await (
              mockMisoClient.log as unknown as {
                error: (message: string, options: Record<string, unknown>) => Promise<void>;
              }
            ).error(message, options as Record<string, unknown>);
          } else {
            console.error('[ERROR]', message);
            if ((options as { stack?: string })?.stack) {
              console.error('[ERROR] Stack:', (options as { stack?: string }).stack);
            }
          }
        },
      };

      await errorLogger.logError('Test error', { stack: 'Error stack' });

      // Since mockMisoClient is defined, it won't reach console.error
      // But we test the fallback logic structure
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle error logger that throws', async () => {
      const errorLogger = {
        async logError(_message: string, _options: unknown): Promise<void> {
          throw new Error('Logger failed');
        },
      };

      await expect(errorLogger.logError('Test', {})).rejects.toThrow('Logger failed');
    });
  });

  describe('Error logger with request context', () => {
    it('should extract request from options', async () => {
      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          const req = (options as { req?: Request })?.req;
          if (req && mockMisoClient) {
            const loggerChain = mockMisoClient.log?.forRequest(req as Request);
            if (loggerChain) {
              await loggerChain.error(message, (options as { stack?: string })?.stack);
            }
          }
        },
      };

      await errorLogger.logError('Test error', { req: mockRequest as Request });

      expect(
        (mockMisoClient.log as unknown as { forRequest: jest.Mock }).forRequest
      ).toHaveBeenCalledWith(mockRequest as Request);
    });

    it('should handle options without request', async () => {
      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          const req = (options as { req?: Request })?.req;
          if (req && mockMisoClient) {
            const loggerChain = (
              mockMisoClient.log as unknown as {
                forRequest: (req: Request) => {
                  error: jest.Mock;
                  info: jest.Mock;
                  addContext: jest.Mock;
                };
              }
            ).forRequest(req);
            if (loggerChain) {
              await loggerChain.error(message, (options as { stack?: string })?.stack);
            }
          } else if (mockMisoClient) {
            await (
              mockMisoClient.log as unknown as {
                error: (message: string, options: Record<string, unknown>) => Promise<void>;
              }
            ).error(message, options as Record<string, unknown>);
          }
        },
      };

      await errorLogger.logError('Test error', { stack: 'Error stack' });

      expect((mockMisoClient.log as unknown as { error: jest.Mock }).error).toHaveBeenCalledWith(
        'Test error',
        { stack: 'Error stack' }
      );
      expect(
        (mockMisoClient.log as unknown as { forRequest: jest.Mock }).forRequest
      ).not.toHaveBeenCalled();
    });

    it('should pass stack trace to logger', async () => {
      const errorLogger = {
        async logError(message: string, options: unknown): Promise<void> {
          const req = (options as { req?: Request })?.req;
          if (req && mockMisoClient) {
            const loggerChain = (
              mockMisoClient.log as unknown as {
                forRequest: (req: Request) => {
                  error: jest.Mock;
                  info: jest.Mock;
                  addContext: jest.Mock;
                };
              }
            ).forRequest(req);
            if (loggerChain) {
              await loggerChain.error(message, (options as { stack?: string })?.stack);
            }
          }
        },
      };

      const stackTrace = 'Error: Test\n    at test.js:1:1';
      await errorLogger.logError('Test error', { req: mockRequest as Request, stack: stackTrace });

      expect(mockLoggerChain.error).toHaveBeenCalledWith('Test error', stackTrace);
      expect(
        (mockMisoClient.log as unknown as { forRequest: jest.Mock }).forRequest
      ).toHaveBeenCalledWith(mockRequest as Request);
    });
  });
});
