/**
 * Health check route tests
 */

import { Request, Response } from 'express';
import { healthHandler } from '../routes/health';

describe('Health Handler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn();
    mockRequest = {};
    mockResponse = {
      json: responseJson,
    };
  });

  it('should return health status', () => {
    healthHandler(mockRequest as Request, mockResponse as Response);

    expect(responseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ok',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      })
    );
  });

  it('should include timestamp', () => {
    healthHandler(mockRequest as Request, mockResponse as Response);

    const callArgs = responseJson.mock.calls[0][0];
    expect(callArgs.timestamp).toBeDefined();
    expect(new Date(callArgs.timestamp).getTime()).not.toBeNaN();
  });

  it('should include uptime', () => {
    healthHandler(mockRequest as Request, mockResponse as Response);

    const callArgs = responseJson.mock.calls[0][0];
    expect(callArgs.uptime).toBeDefined();
    expect(typeof callArgs.uptime).toBe('number');
    expect(callArgs.uptime).toBeGreaterThanOrEqual(0);
  });
});

