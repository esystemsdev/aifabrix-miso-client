/**
 * Health check route tests
 */

import { Request, Response } from 'express';
import { healthHandler } from '../routes/health';
import { MisoClient } from '@aifabrix/miso-client';

// Mock MisoClient
jest.mock('@aifabrix/miso-client', () => ({
  MisoClient: jest.fn(),
  asyncHandler: jest.fn((fn) => fn),
}));

describe('Health Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;
  let responseJson: jest.Mock;
  let mockMisoClient: jest.Mocked<Partial<MisoClient>>;
  let mockLoggerChain: {
    info: jest.Mock;
  };

  beforeEach(() => {
    mockNext = jest.fn();
    responseJson = jest.fn();
    mockRequest = {};
    mockResponse = {
      json: responseJson,
    };

    mockLoggerChain = {
      info: jest.fn().mockResolvedValue(undefined),
    };

    mockMisoClient = {
      log: {
        forRequest: jest.fn().mockReturnValue(mockLoggerChain),
      },
    } as unknown as MisoClient;
  });

  it('should return health status', async () => {
    const handler = healthHandler(mockMisoClient as MisoClient | null);
    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    expect(responseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      })
    );
  });

  it('should include timestamp', async () => {
    const handler = healthHandler(mockMisoClient as MisoClient | null);
    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    const callArgs = responseJson.mock.calls[0][0];
    expect(callArgs.timestamp).toBeDefined();
    expect(new Date(callArgs.timestamp).getTime()).not.toBeNaN();
  });

  it('should include uptime', async () => {
    const handler = healthHandler(mockMisoClient as MisoClient | null);
    await handler(mockRequest as Request, mockResponse as Response, mockNext);

    const callArgs = responseJson.mock.calls[0][0];
    expect(callArgs.uptime).toBeDefined();
    expect(typeof callArgs.uptime).toBe('number');
    expect(callArgs.uptime).toBeGreaterThanOrEqual(0);
  });
});
