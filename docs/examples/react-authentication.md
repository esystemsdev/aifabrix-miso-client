# React Authentication Examples

Practical examples for adding authentication to React applications using the AI Fabrix Miso Client SDK.

**You need to:** Add authentication to your React application with context and protected routes.

**Here's how:** Create an authentication context and protected route component.

## Authentication Context

```typescript
// AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { MisoClient, loadConfig, UserInfo } from '@aifabrix/miso-client';

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [client] = useState(() => new MisoClient(loadConfig()));

  useEffect(() => {
    const initAuth = async () => {
      try {
        await client.initialize();

        const token = localStorage.getItem('auth_token');
        if (token) {
          const isValid = await client.validateToken(token);
          if (isValid) {
            const userInfo = await client.getUser(token);
            setUser(userInfo);
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [client]);

  const login = async () => {
    try {
      const response = await client.login({ redirect: 'https://myapp.com/dashboard' });
      window.location.href = response.data.loginUrl;
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await client.logout({ token });
        await client.log.audit('user.logout', 'authentication', {
          userId: user?.id,
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  const hasPermission = async (permission: string): Promise<boolean> => {
    const token = localStorage.getItem('auth_token');
    if (!token) return false;

    try {
      return await client.hasPermission(token, permission);
    } catch (error) {
      console.error('Permission check failed:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      login,
      logout,
      hasRole,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

## Protected Route Component

```typescript
// ProtectedRoute.tsx
import React from 'react';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback = <div>Access Denied</div>
}: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, hasPermission } = useAuth();
  const [hasRequiredPermission, setHasRequiredPermission] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    if (requiredPermission) {
      hasPermission(requiredPermission).then(setHasRequiredPermission);
    } else {
      setHasRequiredPermission(true);
    }
  }, [requiredPermission, hasPermission]);

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <>{fallback}</>;
  }

  if (requiredPermission && hasRequiredPermission === false) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Usage
function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminPanel />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
```

**See Also:**

- [Authentication Reference](../reference-authentication.md) - Complete authentication API reference
- [Authorization Reference](../reference-authorization.md) - Role and permission management
