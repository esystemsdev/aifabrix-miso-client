import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { codeExamples } from './codeExamplesData';

/**
 * Code Examples page component displaying copyable code examples for DataClient usage
 * 
 * Provides copyable code examples for:
 * - Getting started guide (server and client setup)
 * - DataClient initialization (zero-config and manual)
 * - HTTP methods usage
 * - Authentication methods
 * - Caching configuration
 * - Interceptors setup
 * - Roles/permissions checks
 * - Error handling patterns
 */
export function CodeExamplesPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /**
   * Copy code to clipboard
   */
  const copyToClipboard = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  /**
   * Render code block with copy button
   */
  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="group">
      <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto relative">
        <code>{code}</code>
        <Button
          size="sm"
          variant="ghost"
          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
          className="z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
          onClick={() => copyToClipboard(code, id)}
        >
          {copiedId === id ? (
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
      </pre>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <h1 className="text-2xl">Code Examples</h1>
          <p className="text-muted-foreground mt-1">
            Copyable code examples for using DataClient
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl">
          <Tabs defaultValue="gettingStarted" className="space-y-6">
            <TabsList className="grid w-full grid-cols-8">
              <TabsTrigger value="gettingStarted">Getting Started</TabsTrigger>
              <TabsTrigger value="initialization">Init</TabsTrigger>
              <TabsTrigger value="http">HTTP</TabsTrigger>
              <TabsTrigger value="auth">Auth</TabsTrigger>
              <TabsTrigger value="caching">Cache</TabsTrigger>
              <TabsTrigger value="interceptors">Interceptors</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            </TabsList>

            {/* Getting Started Tab */}
            <TabsContent value="gettingStarted" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Server Setup</CardTitle>
                  <CardDescription>
                    Set up Express.js server with client token endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.gettingStarted.serverSetup} id="getting-started-server" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Environment Variables</CardTitle>
                  <CardDescription>
                    Configure server-side environment variables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.gettingStarted.environmentVariables} id="getting-started-env" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Client Setup</CardTitle>
                  <CardDescription>
                    Initialize DataClient in your browser application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.gettingStarted.clientSetup} id="getting-started-client" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Complete Example</CardTitle>
                  <CardDescription>
                    Full server and client integration example
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.gettingStarted.completeExample} id="getting-started-complete" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>How It Works</CardTitle>
                  <CardDescription>
                    Understanding the authentication flow and security model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.gettingStarted.howItWorks} id="getting-started-how-it-works" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Validating User Tokens in Routes</CardTitle>
                  <CardDescription>
                    How to protect your API routes with user token validation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.gettingStarted.validateUserTokens} id="getting-started-validate-tokens" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Initialization Tab */}
            <TabsContent value="initialization" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Zero-Config Initialization</CardTitle>
                  <CardDescription>Automatically fetch configuration from server</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.initialization.zeroConfig} id="init-zero" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Manual Initialization</CardTitle>
                  <CardDescription>Configure DataClient with custom settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.initialization.manual} id="init-manual" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>React Context Setup</CardTitle>
                  <CardDescription>Use DataClient with React Context</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.initialization.reactContext} id="init-context" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* HTTP Methods Tab */}
            <TabsContent value="http" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>GET Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.httpMethods.get} id="http-get" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>POST Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.httpMethods.post} id="http-post" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>PUT Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.httpMethods.put} id="http-put" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>PATCH Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.httpMethods.patch} id="http-patch" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>DELETE Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.httpMethods.delete} id="http-delete" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Authentication Tab */}
            <TabsContent value="auth" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Check Authentication</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.isAuthenticated} id="auth-check" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Get Token</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.getToken} id="auth-token" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Get Token Info</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.getTokenInfo} id="auth-token-info" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Logout</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.logout} id="auth-logout" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Redirect to Login</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.redirectToLogin} id="auth-redirect" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>OAuth Callback Handling</CardTitle>
                  <CardDescription>
                    Automatically extract and store tokens from OAuth redirect (hash fragment)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.handleOAuthCallback} id="auth-oauth-callback" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Token Refresh Callback</CardTitle>
                  <CardDescription>
                    Configure automatic token refresh on 401 errors using secure backend endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.authentication.tokenRefresh} id="auth-token-refresh" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Caching Tab */}
            <TabsContent value="caching" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cache-Enabled Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.caching.enabled} id="cache-enabled" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cache-Bypassed Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.caching.disabled} id="cache-disabled" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clear Cache</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.caching.clearCache} id="cache-clear" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Interceptors Tab */}
            <TabsContent value="interceptors" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Request Interceptor</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.interceptors.request} id="interceptor-request" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Interceptor</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.interceptors.response} id="interceptor-response" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Interceptor</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.interceptors.error} id="interceptor-error" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Get Roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.roles.getRoles} id="roles-get" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.roles.hasRole} id="roles-has" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check Any Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.roles.hasAnyRole} id="roles-any" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check All Roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.roles.hasAllRoles} id="roles-all" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Refresh Roles</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.roles.refreshRoles} id="roles-refresh" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clear Roles Cache</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.roles.clearRolesCache} id="roles-clear" />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Get Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.permissions.getPermissions} id="perms-get" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check Permission</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.permissions.hasPermission} id="perms-has" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check Any Permission</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.permissions.hasAnyPermission} id="perms-any" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Check All Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.permissions.hasAllPermissions} id="perms-all" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Refresh Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.permissions.refreshPermissions} id="perms-refresh" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Clear Permissions Cache</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock code={codeExamples.permissions.clearPermissionsCache} id="perms-clear" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Error Handling & Metrics */}
          <div className="mt-6 grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Error Handling</CardTitle>
                <CardDescription>Patterns for handling errors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Basic Try-Catch</h4>
                  <CodeBlock code={codeExamples.errorHandling.tryCatch} id="error-basic" />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">Network Errors</h4>
                  <CodeBlock code={codeExamples.errorHandling.networkError} id="error-network" />
                </div>
                <div>
                  <h4 className="text-sm font-medium mb-2">API Errors</h4>
                  <CodeBlock code={codeExamples.errorHandling.apiError} id="error-api" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Metrics</CardTitle>
                <CardDescription>Get request metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock code={codeExamples.metrics.getMetrics} id="metrics-get" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

