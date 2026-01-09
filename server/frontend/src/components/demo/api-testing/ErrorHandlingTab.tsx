import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

/**
 * Props for ErrorHandlingTab component
 */
interface ErrorHandlingTabProps {
  /** Whether buttons should be disabled */
  isDisabled: boolean;
  /** Error handling test functions */
  errors: {
    testNetworkError: () => Promise<void>;
    testTimeout: () => Promise<void>;
    testApiError: () => Promise<void>;
  };
}

/**
 * Error Handling tab component for API testing
 * 
 * Provides UI for testing error handling scenarios:
 * - Network errors (invalid endpoints)
 * - Timeout errors (short timeout)
 * - API errors (400 Bad Request)
 * 
 * @param props - Component props
 * @returns Error Handling tab content
 */
export function ErrorHandlingTab({ isDisabled, errors }: ErrorHandlingTabProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Network Error</CardTitle>
          <CardDescription>Simulate connection failure</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={errors.testNetworkError} disabled={isDisabled} variant="destructive" className="w-full">
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
          <Button onClick={errors.testTimeout} disabled={isDisabled} variant="destructive" className="w-full">
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
          <Button onClick={errors.testApiError} disabled={isDisabled} variant="destructive" className="w-full">
            Test API Error
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
