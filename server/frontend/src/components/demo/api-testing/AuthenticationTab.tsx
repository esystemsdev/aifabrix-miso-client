import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

/**
 * Props for AuthenticationTab component
 */
interface AuthenticationTabProps {
  /** Whether buttons should be disabled */
  isDisabled: boolean;
  /** Authentication test functions */
  auth: {
    testIsAuthenticated: () => Promise<void>;
    testGetToken: () => Promise<void>;
    testGetClientTokenInfo: () => Promise<void>;
    testGetUser: () => Promise<void>;
    testLogout: () => Promise<void>;
    testRedirectToLogin: () => Promise<void>;
  };
}

/**
 * Authentication tab component for API testing
 * 
 * Provides UI for testing authentication methods:
 * - isAuthenticated()
 * - getEnvironmentToken()
 * - getClientTokenInfo()
 * - logout()
 * - redirectToLogin()
 * 
 * @param props - Component props
 * @returns Authentication tab content
 */
export function AuthenticationTab({ isDisabled, auth }: AuthenticationTabProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Check Authentication</CardTitle>
          <CardDescription>Verify user authentication status</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={auth.testIsAuthenticated} disabled={isDisabled} className="w-full">
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
          <Button onClick={auth.testGetToken} disabled={isDisabled} className="w-full">
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
          <Button onClick={auth.testGetClientTokenInfo} disabled={isDisabled} className="w-full">
            getClientTokenInfo()
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Get User</CardTitle>
          <CardDescription>Get current user information</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={auth.testGetUser} 
            disabled={isDisabled} 
            className="w-full !bg-purple-600 hover:!bg-purple-700 !text-white"
          >
            getUser()
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logout</CardTitle>
          <CardDescription>End user session</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={auth.testLogout} disabled={isDisabled} variant="destructive" className="w-full">
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
          <Button onClick={auth.testRedirectToLogin} disabled={isDisabled} className="w-full bg-blue-600 hover:bg-blue-700">
            redirectToLogin()
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
