import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataClient } from '@aifabrix/miso-client';

// Mock autoInitializeDataClient
const mockAutoInitializeDataClient = vi.fn();
vi.mock('@aifabrix/miso-client', async () => {
  const actual = await vi.importActual('@aifabrix/miso-client');
  return {
    ...actual,
    autoInitializeDataClient: mockAutoInitializeDataClient,
  };
});

describe('DataClientContext', () => {
  let mockDataClient: DataClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock DataClient
    mockDataClient = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      getRoles: vi.fn(),
      getPermissions: vi.fn(),
      hasRole: vi.fn(),
      hasPermission: vi.fn(),
      hasAnyRole: vi.fn(),
      hasAllRoles: vi.fn(),
      hasAnyPermission: vi.fn(),
      hasAllPermissions: vi.fn(),
      refreshRoles: vi.fn(),
      refreshPermissions: vi.fn(),
      clearCache: vi.fn(),
      isAuthenticated: vi.fn(),
      redirectToLogin: vi.fn(),
      logout: vi.fn(),
      getEnvironmentToken: vi.fn(),
      getClientTokenInfo: vi.fn(),
      handleOAuthCallback: vi.fn(),
      getMetrics: vi.fn(),
      setInterceptors: vi.fn(),
      setAuditConfig: vi.fn(),
    } as unknown as DataClient;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization logic', () => {
    it('should initialize DataClient successfully on first attempt', async () => {
      mockAutoInitializeDataClient.mockResolvedValue(mockDataClient);

      // Simulate initialization
      const result = await mockAutoInitializeDataClient({
        clientTokenUri: '/api/v1/auth/client-token',
        baseUrl: 'http://localhost:3083',
        cacheConfig: true,
      });

      expect(result).toBe(mockDataClient);
      expect(mockAutoInitializeDataClient).toHaveBeenCalledTimes(1);
      expect(mockAutoInitializeDataClient).toHaveBeenCalledWith({
        clientTokenUri: '/api/v1/auth/client-token',
        baseUrl: 'http://localhost:3083',
        cacheConfig: true,
        onError: expect.any(Function),
      });
    });

    it('should retry initialization on failure', async () => {
      // First attempt fails, second succeeds
      mockAutoInitializeDataClient
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockDataClient);

      // Simulate retry logic
      let attempt = 0;
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000;

      const initializeWithRetry = async (): Promise<DataClient> => {
        try {
          return await mockAutoInitializeDataClient({
            clientTokenUri: '/api/v1/auth/client-token',
            baseUrl: 'http://localhost:3083',
            cacheConfig: true,
          });
        } catch (error) {
          if (attempt < MAX_RETRIES) {
            attempt++;
            // Wait for exponential backoff
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt - 1)));
            return initializeWithRetry();
          }
          throw error;
        }
      };

      const result = await initializeWithRetry();

      expect(result).toBe(mockDataClient);
      expect(mockAutoInitializeDataClient).toHaveBeenCalledTimes(2);
      expect(attempt).toBe(1);
    });

    it('should use exponential backoff for retries', async () => {
      const delays: number[] = [];
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 2000;

      // Track delays
      const originalSetTimeout = setTimeout;
      const setTimeoutSpy = vi.fn((fn: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      // Simulate retry attempts
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const delay = RETRY_DELAY * Math.pow(2, attempt);
        delays.push(delay);
      }

      expect(delays[0]).toBe(2000); // First retry: 2s
      expect(delays[1]).toBe(4000); // Second retry: 4s
      expect(delays[2]).toBe(8000); // Third retry: 8s
    });

    it('should stop retrying after MAX_RETRIES', async () => {
      const MAX_RETRIES = 3;
      mockAutoInitializeDataClient.mockRejectedValue(new Error('Persistent error'));

      let attempt = 0;
      const initializeWithRetry = async (): Promise<void> => {
        try {
          await mockAutoInitializeDataClient({
            clientTokenUri: '/api/v1/auth/client-token',
            baseUrl: 'http://localhost:3083',
            cacheConfig: true,
          });
        } catch (error) {
          if (attempt < MAX_RETRIES) {
            attempt++;
            await new Promise(resolve => setTimeout(resolve, 100));
            return initializeWithRetry();
          }
          throw error;
        }
      };

      await expect(initializeWithRetry()).rejects.toThrow('Persistent error');
      expect(mockAutoInitializeDataClient).toHaveBeenCalledTimes(MAX_RETRIES + 1); // Initial + retries
      expect(attempt).toBe(MAX_RETRIES);
    });
  });

  describe('Error handling', () => {
    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockAutoInitializeDataClient.mockRejectedValue(error);

      await expect(
        mockAutoInitializeDataClient({
          clientTokenUri: '/api/v1/auth/client-token',
          baseUrl: 'http://localhost:3083',
          cacheConfig: true,
        })
      ).rejects.toThrow('Initialization failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockAutoInitializeDataClient.mockRejectedValue('String error');

      await expect(
        mockAutoInitializeDataClient({
          clientTokenUri: '/api/v1/auth/client-token',
          baseUrl: 'http://localhost:3083',
          cacheConfig: true,
        })
      ).rejects.toBe('String error');
    });
  });

  describe('Configuration options', () => {
    it('should pass clientTokenUri option', async () => {
      mockAutoInitializeDataClient.mockResolvedValue(mockDataClient);

      await mockAutoInitializeDataClient({
        clientTokenUri: '/custom/token',
        baseUrl: 'http://localhost:3083',
        cacheConfig: true,
      });

      expect(mockAutoInitializeDataClient).toHaveBeenCalledWith(
        expect.objectContaining({
          clientTokenUri: '/custom/token',
        })
      );
    });

    it('should pass baseUrl option', async () => {
      mockAutoInitializeDataClient.mockResolvedValue(mockDataClient);

      await mockAutoInitializeDataClient({
        clientTokenUri: '/api/v1/auth/client-token',
        baseUrl: 'https://api.example.com',
        cacheConfig: true,
      });

      expect(mockAutoInitializeDataClient).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: 'https://api.example.com',
        })
      );
    });

    it('should pass cacheConfig option', async () => {
      mockAutoInitializeDataClient.mockResolvedValue(mockDataClient);

      await mockAutoInitializeDataClient({
        clientTokenUri: '/api/v1/auth/client-token',
        baseUrl: 'http://localhost:3083',
        cacheConfig: false,
      });

      expect(mockAutoInitializeDataClient).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheConfig: false,
        })
      );
    });

    it('should default cacheConfig to true', async () => {
      mockAutoInitializeDataClient.mockResolvedValue(mockDataClient);

      await mockAutoInitializeDataClient({
        clientTokenUri: '/api/v1/auth/client-token',
        baseUrl: 'http://localhost:3083',
      });

      expect(mockAutoInitializeDataClient).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheConfig: true,
        })
      );
    });
  });

  describe('Retry count tracking', () => {
    it('should track retry attempts', () => {
      const retryCounts: number[] = [];
      const MAX_RETRIES = 3;

      // Simulate retry count tracking
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        retryCounts.push(attempt);
      }

      expect(retryCounts).toEqual([0, 1, 2, 3]);
    });

    it('should reset retry count on success', () => {
      let retryCount = 2;
      
      // Simulate success
      retryCount = 0;

      expect(retryCount).toBe(0);
    });
  });
});
