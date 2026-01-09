import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';

/**
 * Props for HttpMethodsTab component
 */
interface HttpMethodsTabProps {
  /** Whether buttons should be disabled */
  isDisabled: boolean;
  /** HTTP method test functions */
  httpMethods: {
    testGet: () => void;
    testGetById: () => void;
    testPost: () => void;
    testPut: () => void;
    testPatch: () => void;
    testDelete: () => void;
  };
}

/**
 * HTTP Methods tab component for API testing
 * 
 * Provides UI for testing GET, POST, PUT, PATCH, and DELETE requests.
 * 
 * @param props - Component props
 * @returns HTTP Methods tab content
 */
export function HttpMethodsTab({ isDisabled, httpMethods }: HttpMethodsTabProps) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">GET Requests</CardTitle>
          <CardDescription>Retrieve data from the server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={httpMethods.testGet} disabled={isDisabled} className="w-full bg-green-600 hover:bg-green-700">
            GET /api/users
          </Button>
          <Button onClick={httpMethods.testGetById} disabled={isDisabled} className="w-full bg-green-600 hover:bg-green-700">
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
          <Button onClick={httpMethods.testPost} disabled={isDisabled} className="w-full bg-blue-600 hover:bg-blue-700">
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
          <Button onClick={httpMethods.testPut} disabled={isDisabled} className="w-full bg-orange-600 hover:bg-orange-700">
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
          <Button onClick={httpMethods.testPatch} disabled={isDisabled} className="w-full bg-orange-600 hover:bg-orange-700">
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
          <Button onClick={httpMethods.testDelete} disabled={isDisabled} variant="destructive" className="w-full">
            DELETE /api/users/:id
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
