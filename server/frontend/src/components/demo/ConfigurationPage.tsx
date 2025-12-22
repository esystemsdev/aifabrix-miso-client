import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ArrowRight, Zap, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useDataClient } from '../../hooks/useDataClient';
import { getCachedDataClientConfig } from '@aifabrix/miso-client';

/**
 * Configuration page component for DataClient initialization and testing
 * 
 * Provides UI for:
 * - Zero-config auto-initialization (uses context)
 * - Environment variable configuration instructions
 * - Displaying current configuration state and errors
 */
export function ConfigurationPage() {
  const { dataClient, error, reinitialize } = useDataClient();
  const [loading, setLoading] = useState(false);
  const [configInfo, setConfigInfo] = useState<{
    baseUrl: string;
    controllerUrl: string;
    clientId: string;
    clientTokenUri?: string;
  } | null>(null);

  /**
   * Read cached config using SDK utility
   * Uses getCachedDataClientConfig() from miso-client SDK
   */
  const readCachedConfig = (): {
    baseUrl: string;
    controllerUrl: string;
    clientId: string;
    clientTokenUri?: string;
  } | null => {
    const cached = getCachedDataClientConfig();
    if (!cached) {
      return null;
    }

    return {
      baseUrl: cached.baseUrl || '',
      controllerUrl: cached.controllerUrl || '',
      clientId: cached.clientId || '',
      clientTokenUri: cached.clientTokenUri,
    };
  };

  // Load cached config on mount and when DataClient changes
  useEffect(() => {
    if (dataClient) {
      const cached = readCachedConfig();
      if (cached) {
        setConfigInfo(cached);
      } else {
        // Fallback to window location if no cached config
        setConfigInfo({
          baseUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3183',
          controllerUrl: '',
          clientId: '',
        });
      }
    } else {
      setConfigInfo(null);
    }
  }, [dataClient]);

  /**
   * Handle zero-config initialization using context
   */
  const handleZeroConfigInit = async () => {
    setLoading(true);
    try {
      await reinitialize();
      // Refresh config info from cache after successful initialization
      const cached = readCachedConfig();
      if (cached) {
        setConfigInfo(cached);
      }
      toast.success('DataClient initialized successfully', {
        description: 'Configuration fetched from server endpoint',
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      let errorMessage = error.message;
      let description = 'Please check your server configuration and try again.';

      // Categorize errors for better user feedback
      if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error';
        description = 'Unable to connect to server. Please check if the server is running and accessible.';
      } else if (error.message.includes('404')) {
        errorMessage = 'Endpoint not found';
        description = 'The client token endpoint was not found. Please check your server configuration.';
      } else if (error.message.includes('503')) {
        errorMessage = 'Service unavailable';
        description = 'MisoClient is not initialized on the server. Please configure MISO_CLIENTID and MISO_CLIENTSECRET.';
      } else if (error.message.includes('CORS')) {
        errorMessage = 'CORS error';
        description = 'Cross-origin request blocked. Please check CORS configuration on the server.';
      }

      toast.error(`Failed to initialize DataClient: ${errorMessage}`, {
        description,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };


  const initialized = !!dataClient;
  const currentBaseUrl = configInfo?.baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const currentControllerUrl = configInfo?.controllerUrl || 'Not set';
  const currentClientId = configInfo?.clientId || 'Not set';

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
          {/* Error Card */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900 mb-1">Error</p>
                    <p className="text-sm text-red-700 font-mono break-all">{error.message}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Card */}
          {initialized && !error && (
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

          {/* Environment Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle>Configuration Settings</CardTitle>
                  <CardDescription>Configure settings via environment variables</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You can change configuration settings by editing the <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.env</code> file in the root directory:
                </p>
                <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1">
                <div className="text-muted-foreground"># Application port (default: 3083)</div>
                  <div className="text-muted-foreground">PORT=3183</div>
                  <div className="text-muted-foreground"># MISO Application Client Credentials (per application)</div>
                  <div>MISO_CLIENTID=miso-controller-dev-miso-test</div>
                  <div>MISO_CLIENTSECRET=your-secret-here</div>
                  <div className="text-muted-foreground"># MISO Controller URL</div>
                  <div>MISO_CONTROLLER_URL=http://localhost:3000</div>
                </div>
                <p className="text-sm text-muted-foreground">
                  After modifying the <code className="px-1.5 py-0.5 bg-muted rounded text-xs">.env</code> file, restart the server for changes to take effect.
                </p>
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
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Base URL</span>
                  <span className="font-mono text-xs">{currentBaseUrl}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Controller URL</span>
                  <span className="font-mono text-xs">{currentControllerUrl}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Client ID</span>
                  <span className="font-mono text-xs">{currentClientId}</span>
                </div>
                {configInfo?.clientTokenUri && (
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">Client Token URI</span>
                    <span className="font-mono text-xs">{configInfo.clientTokenUri}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
