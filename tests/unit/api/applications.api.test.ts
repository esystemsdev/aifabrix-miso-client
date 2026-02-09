/**
 * Unit tests for ApplicationsApi
 */

import { ApplicationsApi } from '../../../src/api/applications.api';
import { HttpClient } from '../../../src/utils/http-client';
import { AuthStrategy } from '../../../src/types/config.types';
import {
  UpdateSelfStatusRequest,
  UpdateSelfStatusResponse,
  ApplicationStatusResponse,
} from '../../../src/api/types/applications.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

describe('ApplicationsApi', () => {
  let applicationsApi: ApplicationsApi;
  let mockHttpClient: jest.Mocked<HttpClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockHttpClient = {
      request: jest.fn(),
      authenticatedRequest: jest.fn(),
      requestWithAuthStrategy: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    applicationsApi = new ApplicationsApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('updateSelfStatus', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const body: UpdateSelfStatusRequest = {
        status: 'active',
        url: 'https://app.example.com',
      };
      const mockResponse: UpdateSelfStatusResponse = {
        success: true,
        message: 'Updated',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await applicationsApi.updateSelfStatus('miso', body);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/environments/miso/applications/self/status',
        body,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should replace :envKey in path', async () => {
      const body: UpdateSelfStatusRequest = { port: 8080 };
      mockHttpClient.request.mockResolvedValue({ success: true });

      await applicationsApi.updateSelfStatus('prod-env', body);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/v1/environments/prod-env/applications/self/status',
        body,
      );
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const body: UpdateSelfStatusRequest = { status: 'inactive' };
      const authStrategy: AuthStrategy = { bearerToken: 'test-token' };
      const mockResponse: UpdateSelfStatusResponse = { success: true };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await applicationsApi.updateSelfStatus(
        'miso',
        body,
        authStrategy,
      );

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'POST',
        '/api/v1/environments/miso/applications/self/status',
        authStrategy.bearerToken,
        body,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const body: UpdateSelfStatusRequest = { internalUrl: 'http://internal' };
      const authStrategy: AuthStrategy = { methods: ['client-token'] };
      const mockResponse: UpdateSelfStatusResponse = { success: true };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await applicationsApi.updateSelfStatus(
        'miso',
        body,
        authStrategy,
      );

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'POST',
        '/api/v1/environments/miso/applications/self/status',
        authStrategy,
        body,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const body: UpdateSelfStatusRequest = { status: 'active' };
      const error = new Error('Update failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(
        applicationsApi.updateSelfStatus('miso', body),
      ).rejects.toThrow('Update failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ApplicationsApi]'),
        expect.any(String),
      );
    });
  });

  describe('getApplicationStatus', () => {
    it('should call HttpClient.request when no authStrategy', async () => {
      const mockResponse: ApplicationStatusResponse = {
        id: 'app-1',
        key: 'my-app',
        displayName: 'My App',
        url: 'https://app.example.com',
        status: 'active',
      };

      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await applicationsApi.getApplicationStatus(
        'miso',
        'my-app',
      );

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/environments/miso/applications/my-app/status',
      );
      expect(result).toEqual(mockResponse);
    });

    it('should replace :envKey and :appKey in path', async () => {
      mockHttpClient.request.mockResolvedValue({});

      await applicationsApi.getApplicationStatus('prod', 'backend-service');

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'GET',
        '/api/v1/environments/prod/applications/backend-service/status',
      );
    });

    it('should call HttpClient.authenticatedRequest when bearerToken provided', async () => {
      const authStrategy: AuthStrategy = { bearerToken: 'test-token' };
      const mockResponse: ApplicationStatusResponse = {
        key: 'my-app',
        status: 'active',
      };

      mockHttpClient.authenticatedRequest.mockResolvedValue(mockResponse);

      const result = await applicationsApi.getApplicationStatus(
        'miso',
        'my-app',
        authStrategy,
      );

      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        'GET',
        '/api/v1/environments/miso/applications/my-app/status',
        authStrategy.bearerToken,
        undefined,
        undefined,
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should call HttpClient.requestWithAuthStrategy when authStrategy without bearerToken', async () => {
      const authStrategy: AuthStrategy = { methods: ['api-key'] };
      const mockResponse: ApplicationStatusResponse = { key: 'my-app' };

      mockHttpClient.requestWithAuthStrategy.mockResolvedValue(mockResponse);

      const result = await applicationsApi.getApplicationStatus(
        'miso',
        'my-app',
        authStrategy,
      );

      expect(mockHttpClient.requestWithAuthStrategy).toHaveBeenCalledWith(
        'GET',
        '/api/v1/environments/miso/applications/my-app/status',
        authStrategy,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors', async () => {
      const error = new Error('Get status failed');

      mockHttpClient.request.mockRejectedValue(error);

      await expect(
        applicationsApi.getApplicationStatus('miso', 'my-app'),
      ).rejects.toThrow('Get status failed');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ApplicationsApi]'),
        expect.any(String),
      );
    });
  });
});
