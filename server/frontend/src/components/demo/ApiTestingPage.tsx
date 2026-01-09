import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useDataClient } from '../../hooks/useDataClient';
import { useApiTesting } from '../../hooks/useApiTesting';
import { HttpMethodsTab } from './api-testing/HttpMethodsTab';
import { AuthenticationTab } from './api-testing/AuthenticationTab';
import { ErrorHandlingTab } from './api-testing/ErrorHandlingTab';

/**
 * API Testing page component for testing HTTP methods, authentication, and error handling
 * 
 * Provides UI for:
 * - Testing GET, POST, PUT, PATCH, DELETE requests
 * - Testing authentication methods (isAuthenticated, getEnvironmentToken, getClientTokenInfo, logout)
 * - Testing error handling (network errors, timeouts, API errors)
 * 
 * Uses the useApiTesting hook for all test logic and sub-components for tab content.
 */
export function ApiTestingPage() {
  const { dataClient, isLoading: contextLoading } = useDataClient();
  const { result, isDisabled, httpMethods, auth, errors } = useApiTesting(dataClient, contextLoading);


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
              <HttpMethodsTab isDisabled={isDisabled} httpMethods={httpMethods} />
            </TabsContent>

            {/* Authentication Tab */}
            <TabsContent value="auth" className="space-y-6">
              <AuthenticationTab isDisabled={isDisabled} auth={auth} />
            </TabsContent>

            {/* Error Handling Tab */}
            <TabsContent value="errors" className="space-y-6">
              <ErrorHandlingTab isDisabled={isDisabled} errors={errors} />
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
