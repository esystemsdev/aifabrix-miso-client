import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { useDataClient } from '../../hooks/useDataClient';

/**
 * API Testing page component for testing HTTP methods, authentication, and error handling
 * 
 * Provides UI for:
 * - Testing GET, POST, PUT, PATCH, DELETE requests
 * - Testing authentication methods (isAuthenticated, getEnvironmentToken, getClientTokenInfo, logout)
 * - Testing error handling (network errors, timeouts, API errors)
 */
export function ApiTestingPage() {
  const { dataClient, isLoading: contextLoading } = useDataClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  /**
   * Execute HTTP request using DataClient
   */
  const executeRequest = async (method: string, endpoint: string, data?: any) => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      let response: any;
      
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
    } catch (error: any) {
      setResult({
        method,
        endpoint,
        error: error.message || 'Request failed',
        status: error.status || error.response?.status || 'ERROR',
        timestamp: new Date().toISOString(),
      });
      toast.error('Request failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // HTTP Methods Tests
  const testGet = () => executeRequest('GET', '/api/users');
  const testGetById = () => executeRequest('GET', '/api/users/1');
  const testPost = () => executeRequest('POST', '/api/users', {
    name: 'New User',
    email: 'newuser@example.com',
  });
  const testPut = () => executeRequest('PUT', '/api/users/1', {
    name: 'John Doe Updated',
    email: 'john.updated@example.com',
  });
  const testPatch = () => executeRequest('PATCH', '/api/users/1', {
    email: 'john.patched@example.com',
  });
  const testDelete = () => executeRequest('DELETE', '/api/users/1');

  // Authentication Tests
  const testIsAuthenticated = async () => {
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
    } catch (error: any) {
      toast.error('Failed to check authentication', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testGetToken = async () => {
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
    } catch (error: any) {
      toast.error('Failed to get token', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testGetClientTokenInfo = async () => {
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
    } catch (error: any) {
      toast.error('Failed to get token info', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testLogout = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      await dataClient.logout();
      setResult({ message: 'User logged out successfully' });
      toast.success('Logged out successfully');
    } catch (error: any) {
      toast.error('Logout failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testRedirectToLogin = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      setResult({ 
        message: 'Redirecting to login...', 
        note: 'Page will redirect to miso-controller login endpoint',
        timestamp: new Date().toISOString(),
      });
      await dataClient.redirectToLogin();
      // Note: This will redirect the page, so we won't reach here
    } catch (error: any) {
      setResult({
        error: error.message || 'Redirect failed',
        timestamp: new Date().toISOString(),
      });
      toast.error('Redirect to login failed', { description: error.message });
      setLoading(false);
    }
  };

  // Error Handling Tests
  const testNetworkError = async () => {
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
    } catch (error: any) {
      setResult({
        error: error.message || 'Network Error',
        type: 'NETWORK_ERROR',
        message: error.message || 'Failed to connect to server',
        timestamp: new Date().toISOString(),
      });
      toast.error('Network error occurred', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testTimeout = async () => {
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
    } catch (error: any) {
      setResult({
        error: error.message || 'Request Timeout',
        type: 'TIMEOUT_ERROR',
        message: error.message || 'Request exceeded timeout',
        timestamp: new Date().toISOString(),
      });
      toast.error('Request timeout occurred', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const testApiError = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      // Try to trigger a 400 error (e.g., invalid request)
      await dataClient.post('/api/users', { invalid: 'data' });
    } catch (error: any) {
      setResult({
        error: error.message || 'Bad Request',
        status: error.status || error.response?.status || 400,
        details: error.response?.data || error.message,
        timestamp: new Date().toISOString(),
      });
      toast.error('API error occurred', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || contextLoading || !dataClient;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <h1 className="text-2xl">API Testing</h1>
          <p className="text-muted-foreground mt-1">
            Test HTTP methods, authentication, and error handling
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl">
          <Tabs defaultValue="http" className="space-y-6">
            <TabsList>
              <TabsTrigger value="http">HTTP Methods</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="errors">Error Handling</TabsTrigger>
            </TabsList>

            {/* HTTP Methods Tab */}
            <TabsContent value="http" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">GET Requests</CardTitle>
                    <CardDescription>Retrieve data from the server</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button onClick={testGet} disabled={isDisabled} className="w-full bg-green-600 hover:bg-green-700">
                      GET /api/users
                    </Button>
                    <Button onClick={testGetById} disabled={isDisabled} className="w-full bg-green-600 hover:bg-green-700">
                      GET /api/users/:id
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">POST Requests</CardTitle>
                    <CardDescription>Create new resources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testPost} disabled={isDisabled} className="w-full bg-blue-600 hover:bg-blue-700">
                      POST /api/users
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">PUT Requests</CardTitle>
                    <CardDescription>Update existing resources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testPut} disabled={isDisabled} className="w-full bg-orange-600 hover:bg-orange-700">
                      PUT /api/users/:id
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">PATCH Requests</CardTitle>
                    <CardDescription>Partially update resources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testPatch} disabled={isDisabled} className="w-full bg-orange-600 hover:bg-orange-700">
                      PATCH /api/users/:id
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">DELETE Requests</CardTitle>
                    <CardDescription>Remove resources</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testDelete} disabled={isDisabled} variant="destructive" className="w-full">
                      DELETE /api/users/:id
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Authentication Tab */}
            <TabsContent value="auth" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check Authentication</CardTitle>
                    <CardDescription>Verify user authentication status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testIsAuthenticated} disabled={isDisabled} className="w-full">
                      isAuthenticated()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Get Token</CardTitle>
                    <CardDescription>Retrieve environment token</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testGetToken} disabled={isDisabled} className="w-full">
                      getEnvironmentToken()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Get Token Info</CardTitle>
                    <CardDescription>Get client token information</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testGetClientTokenInfo} disabled={isDisabled} className="w-full">
                      getClientTokenInfo()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Logout</CardTitle>
                    <CardDescription>End user session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testLogout} disabled={isDisabled} variant="destructive" className="w-full">
                      logout()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Redirect to Login</CardTitle>
                    <CardDescription>Redirect to miso-controller login page</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testRedirectToLogin} disabled={isDisabled} className="w-full bg-blue-600 hover:bg-blue-700">
                      redirectToLogin()
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Error Handling Tab */}
            <TabsContent value="errors" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Network Error</CardTitle>
                    <CardDescription>Simulate connection failure</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testNetworkError} disabled={isDisabled} variant="destructive" className="w-full">
                      Test Network Error
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Timeout Error</CardTitle>
                    <CardDescription>Simulate request timeout</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testTimeout} disabled={isDisabled} variant="destructive" className="w-full">
                      Test Timeout
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API Error (400)</CardTitle>
                    <CardDescription>Simulate validation error</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testApiError} disabled={isDisabled} variant="destructive" className="w-full">
                      Test API Error
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Result Panel */}
          {result && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg">Response</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
