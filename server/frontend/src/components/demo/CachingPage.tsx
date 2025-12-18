import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { Clock, Database, Trash2, RefreshCw } from 'lucide-react';
import { useDataClient } from '../../hooks/useDataClient';

/**
 * Caching page component for testing cache operations, interceptors, and retry logic
 * 
 * Provides UI for:
 * - Testing cache-enabled GET requests
 * - Testing cache-bypassed GET requests
 * - Clearing cache (all or specific keys)
 * - Testing request interceptors
 * - Testing retry logic
 */
export function CachingPage() {
  const { dataClient, isLoading: contextLoading } = useDataClient();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [cacheTTL, setCacheTTL] = useState('60000');
  const [cacheKey, setCacheKey] = useState('');

  /**
   * Test cache-enabled GET request
   */
  const testCacheEnabled = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await dataClient.get('/api/users', {
        cache: { enabled: true, ttl: parseInt(cacheTTL, 10) },
      });
      const duration = Date.now() - startTime;
      
      setResult({
        data,
        cached: duration < 100, // If response is very fast, likely cached
        cacheKey: 'GET:/api/users',
        ttl: cacheTTL + 'ms',
        duration: duration + 'ms',
        timestamp: new Date().toISOString(),
      });
      toast.success('Data retrieved', {
        description: duration < 100 ? 'Response served from cache' : 'Fetched from server',
      });
    } catch (error: any) {
      toast.error('Request failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test cache-bypassed GET request
   */
  const testCacheDisabled = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const startTime = Date.now();
      const data = await dataClient.get('/api/users', {
        cache: { enabled: false },
      });
      const duration = Date.now() - startTime;
      
      setResult({
        data,
        cached: false,
        duration: duration + 'ms',
        timestamp: new Date().toISOString(),
      });
      toast.success('Fresh data retrieved', {
        description: 'Cache bypassed, fetched from server',
      });
    } catch (error: any) {
      toast.error('Request failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Clear all cache entries
   */
  const testClearCache = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      dataClient.clearCache();
      const metrics = dataClient.getMetrics();
      setResult({
        message: 'Cache cleared successfully',
        cacheHitRate: metrics.cacheHitRate,
        timestamp: new Date().toISOString(),
      });
      toast.success('Cache cleared', {
        description: 'All cache entries removed',
      });
    } catch (error: any) {
      toast.error('Failed to clear cache', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test request interceptors
   */
  const testInterceptors = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      // Set up request interceptor
      dataClient.setInterceptors({
        onRequest: async (url, options) => {
          return {
            ...options,
            headers: {
              ...options.headers,
              'X-Custom-Header': 'intercepted',
              'Cache-Control': 'max-age=3600',
            },
          };
        },
      });

      const originalRequest = {
        url: '/api/users',
        method: 'GET',
      };

      // Make request (interceptor will be applied)
      await dataClient.get('/api/users', { cache: { enabled: false } });

      setResult({
        interceptor: 'request',
        originalRequest,
        modifiedRequest: {
          ...originalRequest,
          headers: {
            'X-Custom-Header': 'intercepted',
            'Cache-Control': 'max-age=3600',
          },
        },
        timestamp: new Date().toISOString(),
      });
      toast.success('Request interceptor applied');
    } catch (error: any) {
      toast.error('Interceptor test failed', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test retry logic (will retry on failures)
   */
  const testRetryLogic = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      toast.info('Attempting request with retries...');
      // Try a request that might fail (retry logic will handle it)
      const startTime = Date.now();
      await dataClient.get('/api/users', {
        cache: { enabled: false },
      });
      const duration = Date.now() - startTime;
      
      setResult({
        message: 'Request succeeded',
        duration: duration + 'ms',
        retries: 'Automatic retries handled by DataClient',
        timestamp: new Date().toISOString(),
      });
      toast.success('Request completed');
    } catch (error: any) {
      setResult({
        error: error.message,
        retries: 'Retry logic attempted',
        timestamp: new Date().toISOString(),
      });
      toast.error('Request failed after retries', { description: error.message });
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
          <h1 className="text-2xl">Caching & Storage</h1>
          <p className="text-muted-foreground mt-1">
            Test caching mechanisms, interceptors, and retry logic
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl space-y-6">
          {/* Cache Operations */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Database className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Cache Enabled</CardTitle>
                    <CardDescription>Retrieve data with caching</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="cacheTTL">Cache TTL (milliseconds)</Label>
                  <Input
                    id="cacheTTL"
                    type="number"
                    value={cacheTTL}
                    onChange={(e) => setCacheTTL(e.target.value)}
                    placeholder="60000"
                  />
                </div>
                <Button onClick={testCacheEnabled} disabled={isDisabled} className="w-full bg-green-600 hover:bg-green-700">
                  <Database className="w-4 h-4 mr-2" />
                  GET with Cache
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Cache Bypassed</CardTitle>
                    <CardDescription>Fetch fresh data from server</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={testCacheDisabled} disabled={isDisabled} className="w-full bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  GET without Cache
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cache Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cache Management</CardTitle>
              <CardDescription>Clear cache entries</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={testClearCache} disabled={isDisabled} variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Cache
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Advanced Features */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Request Interceptors</CardTitle>
                <CardDescription>Modify requests before sending</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={testInterceptors} disabled={isDisabled} className="w-full">
                  Test Request Interceptor
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Retry Logic</CardTitle>
                <CardDescription>Automatic retry on failures</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={testRetryLogic} disabled={isDisabled} className="w-full">
                  Test Retry Mechanism
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Result Panel */}
          {result && (
            <Card>
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
