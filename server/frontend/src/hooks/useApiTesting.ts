import { useState } from 'react';
import { toast } from 'sonner';
import { DataClient } from '@aifabrix/miso-client';
import { ApiResult } from '../types';
import { getErrorMessage, getErrorStatus } from '../utils/error-handler';

/**
 * Return type for useApiTesting hook
 */
export interface UseApiTestingReturn {
  /** Whether any operation is currently loading */
  loading: boolean;
  /** Current API result from last operation */
  result: ApiResult | null;
  /** Whether buttons should be disabled */
  isDisabled: boolean;
  /** HTTP method test functions */
  httpMethods: {
    testGet: () => void;
    testGetById: () => void;
    testPost: () => void;
    testPut: () => void;
    testPatch: () => void;
    testDelete: () => void;
  };
  /** Authentication test functions */
  auth: {
    testIsAuthenticated: () => Promise<void>;
    testGetToken: () => Promise<void>;
    testGetClientTokenInfo: () => Promise<void>;
    testLogout: () => Promise<void>;
    testRedirectToLogin: () => Promise<void>;
  };
  /** Error handling test functions */
  errors: {
    testNetworkError: () => Promise<void>;
    testTimeout: () => Promise<void>;
    testApiError: () => Promise<void>;
  };
}

/**
 * Hook for API testing functionality
 * 
 * Provides test functions for HTTP methods, authentication, and error handling.
 * Manages loading state and results for all API test operations.
 * 
 * @param dataClient - DataClient instance (can be null if not initialized)
 * @param contextLoading - Whether DataClient context is loading
 * @returns Object containing test functions, loading state, and results
 * 
 * @example
 * ```tsx
 * const { loading, result, httpMethods, auth, errors } = useApiTesting(dataClient, isLoading);
 * 
 * // Use test functions
 * httpMethods.testGet();
 * await auth.testIsAuthenticated();
 * await errors.testNetworkError();
 * ```
 */
export function useApiTesting(
  dataClient: DataClient | null,
  contextLoading: boolean
): UseApiTestingReturn {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  /**
   * Execute HTTP request using DataClient
   * 
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param endpoint - API endpoint path (must start with /)
   * @param data - Optional request body data for POST, PUT, PATCH requests
   * @returns Promise that resolves when request completes
   * @throws Will display error toast and set error result if request fails
   */
  const executeRequest = async (
    method: string,
    endpoint: string,
    data?: Record<string, unknown>
  ): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      let response: unknown;
      
      switch (method) {
        case 'GET':
          response = await dataClient.get(endpoint, { cache: { enabled: false } });
          break;
        case 'POST':
          response = await dataClient.post(endpoint, data);
          break;
        case 'PUT':
          response = await dataClient.put(endpoint, data);
          break;
        case 'PATCH':
          response = await dataClient.patch(endpoint, data);
          break;
        case 'DELETE':
          response = await dataClient.delete(endpoint);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      setResult({
        method,
        endpoint,
        status: 200,
        timestamp: new Date().toISOString(),
        data: response,
      });
      toast.success(`${method} ${endpoint} successful`);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const errorStatus = getErrorStatus(error) || 'ERROR';
      setResult({
        method,
        endpoint,
        error: errorMessage,
        status: errorStatus,
        timestamp: new Date().toISOString(),
      });
      toast.error('Request failed', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // HTTP Methods Tests
  /**
   * Test GET request to /api/users endpoint
   */
  const testGet = (): void => {
    executeRequest('GET', '/api/users');
  };
  
  /**
   * Test GET request to /api/users/:id endpoint
   */
  const testGetById = (): void => {
    executeRequest('GET', '/api/users/1');
  };
  
  /**
   * Test POST request to create a new user
   */
  const testPost = (): void => {
    executeRequest('POST', '/api/users', {
      name: 'New User',
      email: 'newuser@example.com',
    });
  };
  
  /**
   * Test PUT request to update a user
   */
  const testPut = (): void => {
    executeRequest('PUT', '/api/users/1', {
      name: 'John Doe Updated',
      email: 'john.updated@example.com',
    });
  };
  
  /**
   * Test PATCH request to partially update a user
   */
  const testPatch = (): void => {
    executeRequest('PATCH', '/api/users/1', {
      email: 'john.patched@example.com',
    });
  };
  
  /**
   * Test DELETE request to delete a user
   */
  const testDelete = (): void => {
    executeRequest('DELETE', '/api/users/1');
  };

  // Authentication Tests
  /**
   * Test checking if user is authenticated
   * 
   * @returns Promise that resolves when check completes
   */
  const testIsAuthenticated = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const isAuth = dataClient.isAuthenticated();
      setResult({
        authenticated: isAuth,
        timestamp: new Date().toISOString(),
      });
      toast.success(isAuth ? 'User is authenticated' : 'User is not authenticated');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to check authentication', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test retrieving environment token
   * 
   * @returns Promise that resolves when token retrieval completes
   */
  const testGetToken = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const token = await dataClient.getEnvironmentToken();
      setResult({
        token: token || 'No token available',
        timestamp: new Date().toISOString(),
      });
      toast.success('Token retrieved successfully');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to get token', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test retrieving client token information
   * 
   * @returns Promise that resolves when token info retrieval completes
   */
  const testGetClientTokenInfo = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const tokenInfo = dataClient.getClientTokenInfo();
      setResult({
        tokenInfo: tokenInfo || 'No token info available',
        timestamp: new Date().toISOString(),
      });
      toast.success('Token info retrieved successfully');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Failed to get token info', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test user logout
   * 
   * @returns Promise that resolves when logout completes
   */
  const testLogout = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      await dataClient.logout();
      setResult({ 
        message: 'User logged out successfully',
        timestamp: new Date().toISOString(),
      });
      toast.success('Logged out successfully');
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast.error('Logout failed', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test redirecting to login page
   * 
   * Note: This will redirect the page, so execution may not complete.
   * 
   * @returns Promise that resolves when redirect is initiated
   */
  const testRedirectToLogin = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      setResult({ 
        message: 'Redirecting to login... (Page will redirect to miso-controller login endpoint)',
        timestamp: new Date().toISOString(),
      });
      await dataClient.redirectToLogin();
      // Note: This will redirect the page, so we won't reach here
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setResult({
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      toast.error('Redirect to login failed', { description: errorMessage });
      setLoading(false);
    }
  };

  // Error Handling Tests
  /**
   * Test network error handling
   * 
   * Attempts to access an invalid endpoint to trigger a network error.
   * 
   * @returns Promise that resolves when error test completes
   */
  const testNetworkError = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      // Try to access an invalid endpoint to trigger network error
      await dataClient.get('/api/invalid-endpoint-that-does-not-exist-12345', {
        cache: { enabled: false },
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setResult({
        error: errorMessage,
        type: 'NETWORK_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      toast.error('Network error occurred', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test timeout error handling
   * 
   * Attempts a request with a very short timeout (100ms) to trigger a timeout error.
   * 
   * @returns Promise that resolves when timeout test completes
   */
  const testTimeout = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      // Try a request with very short timeout
      await dataClient.get('/api/slow-endpoint', {
        cache: { enabled: false },
        timeout: 100, // 100ms timeout
      });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      setResult({
        error: errorMessage,
        type: 'TIMEOUT_ERROR',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      });
      toast.error('Request timeout occurred', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test API error handling (400 Bad Request)
   * 
   * Attempts to trigger a validation error by sending invalid data.
   * 
   * @returns Promise that resolves when error test completes
   */
  const testApiError = async (): Promise<void> => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      // Try to trigger a 400 error (e.g., invalid request)
      await dataClient.post('/api/users', { invalid: 'data' });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const errorStatus = getErrorStatus(error);
      const errorObj = error as { response?: { data?: unknown } };
      setResult({
        error: errorMessage,
        status: errorStatus || 400,
        details: errorObj.response?.data || errorMessage,
        timestamp: new Date().toISOString(),
      });
      toast.error('API error occurred', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || contextLoading || !dataClient;

  return {
    loading,
    result,
    isDisabled,
    httpMethods: {
      testGet,
      testGetById,
      testPost,
      testPut,
      testPatch,
      testDelete,
    },
    auth: {
      testIsAuthenticated,
      testGetToken,
      testGetClientTokenInfo,
      testLogout,
      testRedirectToLogin,
    },
    errors: {
      testNetworkError,
      testTimeout,
      testApiError,
    },
  };
}
