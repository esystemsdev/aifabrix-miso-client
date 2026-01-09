import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { ArrowRight, Zap, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useDataClient } from '../../hooks/useDataClient';
import { getCachedDataClientConfig } from '@aifabrix/miso-client';
import { parseError, getErrorMessage } from '../../utils/error-handler';

/**
 * Configuration page component for DataClient initialization and testing
 * 
 * Provides UI for:
 * - Zero-config auto-initialization (uses context)
 * - Environment variable configuration instructions
 * - Displaying current configuration state and errors
 */
export function ConfigurationPage() {
  const { dataClient, error, isLoading, reinitialize } = useDataClient();
  const [loading, setLoading] = useState(false);
  const [configInfo, setConfigInfo] = useState<{
    baseUrl: string;
    controllerUrl: string;
    clientId: string;
    clientTokenUri?: string;
  } | null>(null);


  /**
   * Read cached config using SDK utility
   * 
   * Uses getCachedDataClientConfig() from miso-client SDK to retrieve
   * configuration that was cached during DataClient initialization.
   * 
   * @returns Configuration object with baseUrl, controllerUrl, clientId, and optional clientTokenUri, or null if not cached
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
   * 
   * Automatically fetches configuration from server endpoint and initializes
   * DataClient. Displays success/error toast notifications based on result.
   * 
   * @throws Will display error toast if initialization fails
   */
  const handleZeroConfigInit = async (): Promise<void> => {
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
      const error = err instanceof Error ? err : new Error(getErrorMessage(err));
      const parsed = parseError(error);
      
      const errorTitle = parsed?.title || 'Failed to initialize DataClient';
      const errorDetail = parsed?.detail || error.message || 'Unknown error occurred';

      toast.error(errorTitle, {
        description: errorDetail,
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
  
  // Parse error message for display
  const parsedError = error ? parseError(error) : null;
  const errorTitle = parsedError?.title || (error ? 'Error' : null);
  const errorDetail = parsedError?.detail || (error ? error.message : null);
  const isErrorParsed = parsedError !== null;
  
  // Determine if we should show status messages (only after initialization attempt completes)
  const showStatus = !isLoading && !loading; // Show status only when not loading (initial or manual)
  const showError = showStatus && error && errorTitle && errorDetail;
  const showSuccess = showStatus && initialized && !error;

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
          {/* Error Card - Only show after initialization attempt completes */}
          {showError && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900 mb-1">{errorTitle}</p>
                    <p className={`text-sm text-red-700 ${isErrorParsed ? '' : 'font-mono break-all'}`}>
                      {errorDetail}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Card - Only show after successful initialization */}
          {showSuccess && (
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
                disabled={isLoading || loading}
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
