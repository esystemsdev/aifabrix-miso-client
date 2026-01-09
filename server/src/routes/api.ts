/**
 * API routes for DataClient testing
 * Provides mock endpoints for demonstrating DataClient capabilities
 */

import { Request, Response } from 'express';
import { MisoClient, asyncHandler, AppError } from '@aifabrix/miso-client';

// Mock data store (in-memory)
const users: Array<{ id: string; name: string; email: string; createdAt: string }> = [
  { id: '1', name: 'John Doe', email: 'john@example.com', createdAt: new Date().toISOString() },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date().toISOString() },
];

/**
 * GET /api/users - List all users
 * Demonstrates GET with caching
 */
export function getUsers(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Simulate delay for caching demonstration
    await new Promise(resolve => {
      const timeout = setTimeout(resolve, 100);
      // Unref timeout so it doesn't keep the process alive in tests
      if (timeout.unref) {
        timeout.unref();
      }
    });
    
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Fetching users list');
    }
    
    res.json({
      users,
      count: users.length,
    });
  }, 'getUsers');
}

/**
 * GET /api/users/:id - Get user by ID
 */
export function getUserById(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const user = users.find((u) => u.id === id);

    if (!user) {
    if (misoClient) {
      await misoClient.log.forRequest(req).addContext('level', 'warning').info(`User not found: ${id}`);
    }
      throw new AppError('User not found', 404);
    }

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`Fetching user: ${id}`);
    }

    res.json({ user });
  }, 'getUserById');
}

/**
 * POST /api/users - Create user
 * Demonstrates POST with data
 */
export function createUser(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { name, email } = req.body;

    if (!name || !email) {
      if (misoClient) {
        await misoClient.log.forRequest(req).info('Create user failed: Name and email are required');
      }
      throw new AppError('Name and email are required', 400);
    }

    const newUser = {
      id: String(users.length + 1),
      name,
      email,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`User created: ${newUser.id}`);
    }

    res.status(201).json({ user: newUser });
  }, 'createUser');
}

/**
 * PUT /api/users/:id - Update user (full update)
 * Demonstrates PUT
 */
export function updateUser(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, email } = req.body;

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      if (misoClient) {
        await misoClient.log.forRequest(req).info(`Update user failed: User not found: ${id}`);
      }
      throw new AppError('User not found', 404);
    }

    if (!name || !email) {
      if (misoClient) {
        await misoClient.log.forRequest(req).info(`Update user failed: Name and email are required: ${id}`);
      }
      throw new AppError('Name and email are required', 400);
    }

    users[userIndex] = {
      ...users[userIndex],
      name,
      email,
    };

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`User updated: ${id}`);
    }

    res.json({ user: users[userIndex] });
  }, 'updateUser');
}

/**
 * PATCH /api/users/:id - Partial update user
 * Demonstrates PATCH
 */
export function patchUser(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const updates = req.body;

    if (misoClient) {
      await misoClient.log.forRequest(req).addContext('id', id).addContext('updates', updates).info(`PATCH /api/users/${id} request received`);
    }

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      if (misoClient) {
        await misoClient.log.forRequest(req).info(`PATCH /api/users/${id} failed: User not found`);
      }
      throw new AppError('User not found', 404);
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
    };

    if (misoClient) {
      await misoClient.log.forRequest(req).addContext('user', users[userIndex]).info(`PATCH /api/users/${id} user updated`);
    }

    res.json({ user: users[userIndex] });
  }, 'patchUser');
}

/**
 * DELETE /api/users/:id - Delete user
 * Demonstrates DELETE
 */
export function deleteUser(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      if (misoClient) {
        await misoClient.log.forRequest(req).info(`Delete user failed: User not found: ${id}`);
      }
      throw new AppError('User not found', 404);
    }

    users.splice(userIndex, 1);

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`User deleted: ${id}`);
    }

    res.status(204).send();
  }, 'deleteUser');
}

/**
 * GET /api/metrics - Return mock metrics
 * Demonstrates metrics endpoint
 */
export function getMetrics(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Fetching metrics');
    }

    res.json({
      totalRequests: 100,
      totalFailures: 5,
      averageResponseTime: 150,
      errorRate: 0.05,
      cacheHitRate: 0.75,
      responseTimeDistribution: {
        '<100ms': 30,
        '100-200ms': 50,
        '200-500ms': 15,
        '>500ms': 5,
      },
    });
  }, 'getMetrics');
}

/**
 * GET /api/slow - Slow endpoint for timeout/retry testing
 * Demonstrates timeout scenarios
 */
export function slowEndpoint(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const delay = parseInt(req.query.delay as string) || 5000;

    if (misoClient) {
      await misoClient.log.forRequest(req).info(`Slow endpoint called with delay: ${delay}ms`);
    }

    await new Promise(resolve => {
      const timeout = setTimeout(resolve, delay);
      // Unref timeout so it doesn't keep the process alive in tests
      // This allows Jest to exit gracefully after tests complete
      if (timeout.unref) {
        timeout.unref();
      }
    });

    res.json({
      message: 'Slow response',
      delay,
      timestamp: new Date().toISOString(),
    });
  }, 'slowEndpoint');
}

/**
 * POST /api/v1/logs - Logging endpoint for MisoClient logger
 * Accepts audit logs and application logs from the SDK
 */
export function logEndpoint(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const logEntry = req.body;

    // Log using MisoClient logger if available, otherwise console (for demo/testing)
    if (misoClient) {
      // Add log entry as context - iterate over keys
      let chain = misoClient.log.forRequest(req);
      for (const [key, value] of Object.entries(logEntry)) {
        chain = chain.addContext(key, value);
      }
      await chain.info('Log entry received');
    } else {
      // Fallback for when MisoClient is not initialized (shouldn't happen in production)
      console.log('[LOG]', JSON.stringify(logEntry, null, 2));
    }

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Log received',
      timestamp: new Date().toISOString(),
    });
  }, 'logEndpoint');
}

/**
 * GET /api/error/:code - Error endpoint for error handling testing
 * Demonstrates various error scenarios
 */
export function errorEndpoint(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, _res: Response): Promise<void> => {
    const { code } = req.params;
    const statusCode = parseInt(code, 10) || 500;

    const errorMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      503: 'Service Unavailable',
    };

    const message = errorMessages[statusCode] || 'Unknown Error';

    if (misoClient) {
      await misoClient.log.forRequest(req).addContext('level', 'warning').addContext('statusCode', statusCode).addContext('message', message).info(`Simulated error endpoint called: ${statusCode} ${message}`);
    }

    // Throw AppError to test error handling
    throw new AppError(`Simulated ${statusCode} error for testing`, statusCode);
  }, 'errorEndpoint');
}
