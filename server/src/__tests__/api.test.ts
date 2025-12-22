/**
 * API routes tests
 */

import { Request, Response } from 'express';
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
} from '../routes/api';

describe('API Routes', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let responseStatus: jest.Mock;
  let responseSend: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getUsers', () => {
    it('should return list of users', () => {
      getUsers(mockRequest as Request, mockResponse as Response);

      jest.advanceTimersByTime(100);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          users: expect.any(Array),
          count: expect.any(Number),
        })
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', () => {
      mockRequest.params = { id: '1' };
      getUserById(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            id: '1',
          }),
        })
      );
    });

    it('should return 404 when user not found', () => {
      mockRequest.params = { id: '999' };
      getUserById(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'User not found',
        })
      );
    });
  });

  describe('createUser', () => {
    it('should create user with valid data', () => {
      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
      };
      createUser(mockRequest as Request, mockResponse as Response);

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

    it('should return 400 when data is missing', () => {
      mockRequest.body = {};
      createUser(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(400);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });

  describe('updateUser', () => {
    it('should update user when found', () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = {
        name: 'Updated User',
        email: 'updated@example.com',
      };
      updateUser(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            name: 'Updated User',
            email: 'updated@example.com',
          }),
        })
      );
    });

    it('should return 404 when user not found', () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = {
        name: 'Updated User',
        email: 'updated@example.com',
      };
      updateUser(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('patchUser', () => {
    it('should partially update user', () => {
      mockRequest.params = { id: '1' };
      mockRequest.body = { email: 'patched@example.com' };
      patchUser(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({
            email: 'patched@example.com',
          }),
        })
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete user when found', () => {
      mockRequest.params = { id: '1' };
      deleteUser(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(204);
      expect(responseSend).toHaveBeenCalled();
    });

    it('should return 404 when user not found', () => {
      mockRequest.params = { id: '999' };
      deleteUser(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics', () => {
      getMetrics(mockRequest as Request, mockResponse as Response);

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
    it('should return response after delay', () => {
      mockRequest.query = { delay: '100' };
      slowEndpoint(mockRequest as Request, mockResponse as Response);

      jest.advanceTimersByTime(100);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow response',
          delay: 100,
        })
      );
    });

    it('should use default delay when not specified', () => {
      mockRequest.query = {};
      slowEndpoint(mockRequest as Request, mockResponse as Response);

      jest.advanceTimersByTime(5000);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow response',
          delay: 5000,
        })
      );
    });

    it('should handle invalid delay query parameter', () => {
      mockRequest.query = { delay: 'invalid' };
      slowEndpoint(mockRequest as Request, mockResponse as Response);

      jest.advanceTimersByTime(5000);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Slow response',
          delay: 5000, // Should default to 5000 when parseInt fails
        })
      );
    });
  });

  describe('errorEndpoint', () => {
    it('should return error with specified status code', () => {
      mockRequest.params = { code: '404' };
      errorEndpoint(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(404);
      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Not Found',
          statusCode: 404,
        })
      );
    });

    it('should default to 500 for invalid code', () => {
      mockRequest.params = { code: 'invalid' };
      errorEndpoint(mockRequest as Request, mockResponse as Response);

      expect(responseStatus).toHaveBeenCalledWith(500);
    });
  });
});
