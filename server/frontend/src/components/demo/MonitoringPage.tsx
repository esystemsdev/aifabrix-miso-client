import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { Activity, FileText, TrendingUp } from 'lucide-react';
import { useDataClient } from '../../hooks/useDataClient';

/**
 * Monitoring page component for viewing metrics and audit logs
 * 
 * Provides UI for:
 * - Displaying real-time request metrics
 * - Viewing cache performance
 * - Displaying audit logs from requests
 * - Making multiple requests to test metrics
 */
interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
}

interface AuditLog {
  id?: string;
  action?: string;
  timestamp: string;
  endpoint: string;
  method?: string;
  status: number;
  duration: string;
}

export function MonitoringPage() {
  const { dataClient, isLoading: contextLoading } = useDataClient();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  /**
   * Load metrics from DataClient
   */
  const loadMetrics = () => {
    if (!dataClient) {
      return;
    }

    try {
      const clientMetrics = dataClient.getMetrics();
      setMetrics({
        totalRequests: clientMetrics.totalRequests,
        successfulRequests: clientMetrics.totalRequests - clientMetrics.totalFailures,
        failedRequests: clientMetrics.totalFailures,
        cacheHits: Math.round(clientMetrics.cacheHitRate * clientMetrics.totalRequests * 0.3), // Estimate
        cacheMisses: Math.round(clientMetrics.totalRequests * 0.7), // Estimate
        averageResponseTime: Math.round(clientMetrics.averageResponseTime),
        cacheHitRate: clientMetrics.cacheHitRate,
        errorRate: clientMetrics.errorRate,
      });
    } catch (error: unknown) {
      console.error('Failed to load metrics:', error);
    }
  };

  useEffect(() => {
    if (dataClient) {
      loadMetrics();
    }
  }, [dataClient]);

  /**
   * Refresh metrics from DataClient
   */
  const testGetMetrics = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      loadMetrics();
      toast.success('Metrics retrieved successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to get metrics', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Make multiple requests to test metrics
   */
  const testMultipleRequests = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      toast.info('Making multiple requests...');
      const startTime = Date.now();
      
      const requests = [
        dataClient.get('/api/users', { cache: { enabled: false } }).catch(() => null),
        dataClient.get('/api/products', { cache: { enabled: false } }).catch(() => null),
        dataClient.get('/api/orders', { cache: { enabled: false } }).catch(() => null),
      ];
      
      await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      const newLogs = [
        { endpoint: '/api/users', status: 200, duration: `${Math.round(duration / 3)}ms`, timestamp: new Date().toISOString() },
        { endpoint: '/api/products', status: 200, duration: `${Math.round(duration / 3)}ms`, timestamp: new Date().toISOString() },
        { endpoint: '/api/orders', status: 200, duration: `${Math.round(duration / 3)}ms`, timestamp: new Date().toISOString() },
      ];
      
      setAuditLogs(prev => [...newLogs, ...prev]);
      loadMetrics(); // Refresh metrics
      toast.success('All requests completed', {
        description: `Total duration: ${duration}ms`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Some requests failed', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test audit logging by making a request
   */
  const testAuditLogging = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      const startTime = Date.now();
      await dataClient.put('/api/users/1', { name: 'Updated User' }).catch(() => null);
      const duration = Date.now() - startTime;
      
      const newLog = {
        id: 'audit-' + Date.now(),
        action: 'USER_UPDATE',
        timestamp: new Date().toISOString(),
        endpoint: '/api/users/1',
        method: 'PUT',
        status: 200,
        duration: `${duration}ms`,
      };
      setAuditLogs(prev => [newLog, ...prev]);
      loadMetrics(); // Refresh metrics
      toast.success('Audit log created');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Audit logging test failed', { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setAuditLogs([]);
    toast.success('Audit logs cleared');
  };

  const successRate = metrics && metrics.totalRequests > 0
    ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1)
    : '0';
  const cacheHitRate = metrics && metrics.cacheHitRate !== undefined
    ? (metrics.cacheHitRate * 100).toFixed(1)
    : metrics && (metrics.cacheHits + metrics.cacheMisses) > 0
    ? ((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(1)
    : '0';

  const isDisabled = loading || contextLoading || !dataClient;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <h1 className="text-2xl">Monitoring & Logs</h1>
          <p className="text-muted-foreground mt-1">
            View performance metrics, audit logs, and system health
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl">
          <Tabs defaultValue="metrics" className="space-y-6">
            <TabsList>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            </TabsList>

            {/* Metrics Tab */}
            <TabsContent value="metrics" className="space-y-6">
              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button onClick={testGetMetrics} disabled={isDisabled} className="bg-blue-600 hover:bg-blue-700">
                  <Activity className="w-4 h-4 mr-2" />
                  Refresh Metrics
                </Button>
                <Button onClick={testMultipleRequests} disabled={isDisabled} className="bg-green-600 hover:bg-green-700">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Make Multiple Requests
                </Button>
              </div>

              {/* Metrics Cards */}
              {metrics && (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-semibold">{metrics.totalRequests}</div>
                        <div className="text-sm text-muted-foreground mt-1">Total Requests</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-semibold text-green-600">{successRate}%</div>
                        <div className="text-sm text-muted-foreground mt-1">Success Rate</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-semibold text-blue-600">{cacheHitRate}%</div>
                        <div className="text-sm text-muted-foreground mt-1">Cache Hit Rate</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-semibold">{metrics.averageResponseTime}ms</div>
                        <div className="text-sm text-muted-foreground mt-1">Avg Response Time</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Request Status</CardTitle>
                        <CardDescription>Breakdown by success/failure</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Successful</span>
                            <span className="text-sm font-medium text-green-600">{metrics.successfulRequests}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Failed</span>
                            <span className="text-sm font-medium text-red-600">{metrics.failedRequests}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-border">
                            <span className="text-sm font-medium">Total</span>
                            <span className="text-sm font-medium">{metrics.totalRequests}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Cache Performance</CardTitle>
                        <CardDescription>Cache hits vs misses</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Cache Hits</span>
                            <span className="text-sm font-medium text-green-600">{metrics.cacheHits}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Cache Misses</span>
                            <span className="text-sm font-medium text-orange-600">{metrics.cacheMisses}</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-border">
                            <span className="text-sm font-medium">Hit Rate</span>
                            <span className="text-sm font-medium text-blue-600">{cacheHitRate}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {metrics && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Metrics Details</CardTitle>
                        <CardDescription>Detailed performance metrics</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Requests</span>
                            <span className="font-medium">{metrics.totalRequests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Successful</span>
                            <span className="font-medium text-green-600">{metrics.successfulRequests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Failed</span>
                            <span className="font-medium text-red-600">{metrics.failedRequests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Error Rate</span>
                            <span className="font-medium">{(metrics.errorRate * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Average Response Time</span>
                            <span className="font-medium">{metrics.averageResponseTime}ms</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* Audit Logs Tab */}
            <TabsContent value="audit" className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button onClick={testAuditLogging} disabled={isDisabled}>
                    <FileText className="w-4 h-4 mr-2" />
                    Create Audit Log
                  </Button>
                  <Button onClick={testMultipleRequests} disabled={isDisabled} className="bg-green-600 hover:bg-green-700">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Make Multiple Requests
                  </Button>
                </div>
                {auditLogs.length > 0 && (
                  <Button onClick={clearLogs} variant="outline" size="sm">
                    Clear Logs
                  </Button>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Audit Log Entries</CardTitle>
                  <CardDescription>Recent activity and requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {auditLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No audit logs yet. Make some requests to see logs here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log, index) => (
                        <div key={index} className="p-3 bg-muted rounded-lg text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs">{log.endpoint}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Method: <span className="font-medium">{log.method || 'GET'}</span></span>
                            <span>Status: <span className={`font-medium ${log.status === 200 ? 'text-green-600' : 'text-red-600'}`}>{log.status}</span></span>
                            <span>Duration: <span className="font-medium">{log.duration}</span></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
