import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Shield, RefreshCw, Trash2 } from 'lucide-react';
import { useDataClient } from '../../hooks/useDataClient';
import { useAuthorizationTests } from '../../hooks/useAuthorizationTests';

/**
 * Authorization page component for testing roles and permissions
 * 
 * Provides UI for:
 * - Getting user roles and permissions
 * - Checking specific roles and permissions
 * - Testing role/permission combinations (hasAny, hasAll)
 * - Refreshing roles/permissions cache
 * - Clearing roles/permissions cache
 */
export function AuthorizationPage() {
  const { dataClient, isLoading: contextLoading } = useDataClient();
  const {
    result,
    roles,
    permissions,
    isDisabled,
    testGetRoles,
    testGetPermissions,
    testHasRole,
    testHasPermission,
    testHasAnyRole,
    testHasAllRoles,
    testHasAnyPermission,
    testHasAllPermissions,
    testRefreshRoles,
    testRefreshPermissions,
    testClearRolesCache,
    testClearPermissionsCache,
  } = useAuthorizationTests(dataClient, contextLoading);
  
  const [roleToCheck, setRoleToCheck] = useState('');
  const [permissionToCheck, setPermissionToCheck] = useState('');
  const [rolesToCheck, setRolesToCheck] = useState('');
  const [permissionsToCheck, setPermissionsToCheck] = useState('');


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border bg-white">
        <div className="px-8 py-6">
          <h1 className="text-2xl">Authorization</h1>
          <p className="text-muted-foreground mt-1">
            Test roles and permissions using DataClient methods
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl">
          <Tabs defaultValue="roles" className="space-y-6">
            <TabsList>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="permissions">Permissions</TabsTrigger>
            </TabsList>

            {/* Roles Tab */}
            <TabsContent value="roles" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Get Roles</CardTitle>
                    <CardDescription>Retrieve user roles (auto-retrieves token from localStorage)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testGetRoles} disabled={isDisabled} className="w-full">
                      <Shield className="w-4 h-4 mr-2" />
                      getRoles()
                    </Button>
                    {roles.length > 0 && (
                      <div className="mt-4">
                        <Label>Current Roles: {roles.length}</Label>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check Role</CardTitle>
                    <CardDescription>Check if user has a specific role</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="roleToCheck">Role Name</Label>
                      <Input
                        id="roleToCheck"
                        value={roleToCheck}
                        onChange={(e) => setRoleToCheck(e.target.value)}
                        placeholder="admin"
                      />
                    </div>
                    <Button onClick={() => testHasRole(roleToCheck)} disabled={isDisabled} className="w-full">
                      hasRole()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check Any Role</CardTitle>
                    <CardDescription>Check if user has any of the specified roles</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="rolesToCheck">Roles (comma-separated)</Label>
                      <Input
                        id="rolesToCheck"
                        value={rolesToCheck}
                        onChange={(e) => setRolesToCheck(e.target.value)}
                        placeholder="admin, user"
                      />
                    </div>
                    <Button onClick={() => testHasAnyRole(rolesToCheck)} disabled={isDisabled} className="w-full">
                      hasAnyRole()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check All Roles</CardTitle>
                    <CardDescription>Check if user has all of the specified roles</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="rolesToCheckAll">Roles (comma-separated)</Label>
                      <Input
                        id="rolesToCheckAll"
                        value={rolesToCheck}
                        onChange={(e) => setRolesToCheck(e.target.value)}
                        placeholder="admin, user"
                      />
                    </div>
                    <Button onClick={() => testHasAllRoles(rolesToCheck)} disabled={isDisabled} className="w-full">
                      hasAllRoles()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Refresh Roles</CardTitle>
                    <CardDescription>Force refresh roles (bypass cache)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testRefreshRoles} disabled={isDisabled} className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      refreshRoles()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Clear Roles Cache</CardTitle>
                    <CardDescription>Clear cached roles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testClearRolesCache} disabled={isDisabled} variant="outline" className="w-full">
                      <Trash2 className="w-4 h-4 mr-2" />
                      clearRolesCache()
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Permissions Tab */}
            <TabsContent value="permissions" className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Get Permissions</CardTitle>
                    <CardDescription>Retrieve user permissions (auto-retrieves token from localStorage)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testGetPermissions} disabled={isDisabled} className="w-full">
                      <Shield className="w-4 h-4 mr-2" />
                      getPermissions()
                    </Button>
                    {permissions.length > 0 && (
                      <div className="mt-4">
                        <Label>Current Permissions: {permissions.length}</Label>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check Permission</CardTitle>
                    <CardDescription>Check if user has a specific permission</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="permissionToCheck">Permission Name</Label>
                      <Input
                        id="permissionToCheck"
                        value={permissionToCheck}
                        onChange={(e) => setPermissionToCheck(e.target.value)}
                        placeholder="users:read"
                      />
                    </div>
                    <Button onClick={() => testHasPermission(permissionToCheck)} disabled={isDisabled} className="w-full">
                      hasPermission()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check Any Permission</CardTitle>
                    <CardDescription>Check if user has any of the specified permissions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="permissionsToCheck">Permissions (comma-separated)</Label>
                      <Input
                        id="permissionsToCheck"
                        value={permissionsToCheck}
                        onChange={(e) => setPermissionsToCheck(e.target.value)}
                        placeholder="users:read, users:write"
                      />
                    </div>
                    <Button onClick={() => testHasAnyPermission(permissionsToCheck)} disabled={isDisabled} className="w-full">
                      hasAnyPermission()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Check All Permissions</CardTitle>
                    <CardDescription>Check if user has all of the specified permissions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="permissionsToCheckAll">Permissions (comma-separated)</Label>
                      <Input
                        id="permissionsToCheckAll"
                        value={permissionsToCheck}
                        onChange={(e) => setPermissionsToCheck(e.target.value)}
                        placeholder="users:read, users:write"
                      />
                    </div>
                    <Button onClick={() => testHasAllPermissions(permissionsToCheck)} disabled={isDisabled} className="w-full">
                      hasAllPermissions()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Refresh Permissions</CardTitle>
                    <CardDescription>Force refresh permissions (bypass cache)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testRefreshPermissions} disabled={isDisabled} className="w-full">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      refreshPermissions()
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Clear Permissions Cache</CardTitle>
                    <CardDescription>Clear cached permissions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={testClearPermissionsCache} disabled={isDisabled} variant="outline" className="w-full">
                      <Trash2 className="w-4 h-4 mr-2" />
                      clearPermissionsCache()
                    </Button>
                  </CardContent>
                </Card>
              </div>
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

