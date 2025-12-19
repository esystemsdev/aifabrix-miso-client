import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ArrowRight, Zap, Settings, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDataClient } from '../../hooks/useDataClient';
import { DataClient } from '@aifabrix/miso-client';

/**
 * Configuration page component for DataClient initialization and testing
 * 
 * Provides UI for:
 * - Zero-config auto-initialization (uses context)
 * - Manual configuration with custom settings
 * - Connection testing
 * - Displaying current configuration state
 */
export function ConfigurationPage() {
  const { dataClient, isLoading, error, reinitialize, setManualClient } = useDataClient();
  const [baseUrl, setBaseUrl] = useState('http://localhost:3083');
  const [controllerUrl, setControllerUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [configInfo, setConfigInfo] = useState<{
    baseUrl: string;
    controllerUrl: string;
    clientId: string;
  } | null>(null);

  // Update config info when DataClient changes
  useEffect(() => {
    if (dataClient) {
      // Extract config info from DataClient instance
      // Note: DataClient doesn't expose config directly, so we use what we know
      setConfigInfo({
        baseUrl: baseUrl || window.location.origin,
        controllerUrl: controllerUrl || '',
        clientId: clientId || '',
      });
    }
  }, [dataClient, baseUrl, controllerUrl, clientId]);

  /**
   * Handle zero-config initialization using context
   */
  const handleZeroConfigInit = async () => {
    setLoading(true);
    try {
      await reinitialize();
      toast.success('DataClient initialized successfully (Zero-Config)', {
        description: 'Configuration fetched from server endpoint',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error('Failed to initialize DataClient', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle manual initialization with custom configuration
   */
  const handleManualInit = async () => {
    if (!baseUrl) {
      toast.error('Base URL is required');
      return;
    }

    setLoading(true);
    try {
      const config: Record<string, unknown> = {
        baseUrl,
      };

      if (controllerUrl) {
        config.misoConfig = {
          controllerUrl,
        };
      }

      if (clientId) {
        config.misoConfig = {
          ...(config.misoConfig as Record<string, unknown> || {}),
          clientId,
        };
      }

      const client = new DataClient(config as Parameters<typeof DataClient>[0]);
      setManualClient(client);  // Updates shared context - AuthSection will see this
      
      toast.success('DataClient initialized successfully (Manual)', {
        description: 'Custom configuration applied',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      toast.error('Failed to initialize DataClient', {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test connection using DataClient
   */
  const handleTestConnection = async () => {
    if (!dataClient) {
      toast.error('DataClient not initialized');
      return;
    }

    setLoading(true);
    try {
      // Try a simple GET request to test connection
      await dataClient.get('/api/health', { cache: { enabled: false } });
      toast.success('Connection test successful', {
        description: 'Server is responding normally',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      // Even if health endpoint doesn't exist, if we get a response, connection works
      if (errorMessage && !errorMessage.includes('Network')) {
        toast.success('Connection test successful', {
          description: 'Server is responding (endpoint may not exist)',
        });
      } else {
        toast.error('Connection test failed', {
          description: errorMessage || 'Unable to connect to server',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const initialized = !!dataClient;
  const currentBaseUrl = configInfo?.baseUrl || baseUrl || window.location.origin;
  const currentControllerUrl = configInfo?.controllerUrl || controllerUrl || 'Not set';
  const currentClientId = configInfo?.clientId || clientId || 'Auto-generated';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <h1 className="text-2xl">Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Initialize and configure the Data Client connection
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl space-y-6">
          {/* Status Card */}
          {initialized && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">DataClient Initialized</p>
                    <p className="text-sm text-green-700">Ready to make API requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Zero-Config Setup */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Zero-Config Setup</CardTitle>
                  <CardDescription>Automatically fetch configuration from server (Recommended)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleZeroConfigInit}
                disabled={loading}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Initializing...
                  </>
                ) : (
                  <>
                    Auto-Initialize DataClient
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Manual Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Settings className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Manual Configuration</CardTitle>
                  <CardDescription>Configure DataClient with custom settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">Base URL</Label>
                <Input
                  id="baseUrl"
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:3083"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="controllerUrl">Controller URL (Optional)</Label>
                <Input
                  id="controllerUrl"
                  type="text"
                  value={controllerUrl}
                  onChange={(e) => setControllerUrl(e.target.value)}
                  placeholder="https://miso.aifabrix.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID (Optional)</Label>
                <Input
                  id="clientId"
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter client ID"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleManualInit}
                  disabled={loading}
                  variant="secondary"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Initializing...
                    </>
                  ) : (
                    'Initialize DataClient'
                  )}
                </Button>
                <Button
                  onClick={handleTestConnection}
                  disabled={loading || !baseUrl}
                  variant="outline"
                >
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Connection Info */}
          <Card>
            <CardHeader>
              <CardTitle>Connection Information</CardTitle>
              <CardDescription>Current configuration settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Status</span>
                  <span className={initialized ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                    {initialized ? 'Connected' : 'Not Initialized'}
                  </span>
                </div>
                {error && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Error</span>
                    <span className="font-mono text-xs text-red-600">{error.message}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Base URL</span>
                  <span className="font-mono text-xs">{currentBaseUrl}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Controller URL</span>
                  <span className="font-mono text-xs">{currentControllerUrl}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Client ID</span>
                  <span className="font-mono text-xs">{currentClientId}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
