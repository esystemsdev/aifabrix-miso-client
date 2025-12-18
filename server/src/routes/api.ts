/**
 * API routes for DataClient testing
 * Provides mock endpoints for demonstrating DataClient capabilities
 */

import { Request, Response } from 'express';

// Mock data store (in-memory)
const users: Array<{ id: string; name: string; email: string; createdAt: string }> = [
  { id: '1', name: 'John Doe', email: 'john@example.com', createdAt: new Date().toISOString() },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', createdAt: new Date().toISOString() },
];

/**
 * GET /api/users - List all users
 * Demonstrates GET with caching
 */
export function getUsers(req: Request, res: Response): void {
  try {
    // Simulate delay for caching demonstration
    setTimeout(() => {
      res.json({
        users,
        count: users.length,
      });
    }, 100);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

/**
 * GET /api/users/:id - Get user by ID
 */
export function getUserById(req: Request, res: Response): void {
  try {
    const { id } = req.params;
    const user = users.find((u) => u.id === id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
}

/**
 * POST /api/users - Create user
 * Demonstrates POST with data
 */
export function createUser(req: Request, res: Response): void {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    const newUser = {
      id: String(users.length + 1),
      name,
      email,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    res.status(201).json({ user: newUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
}

/**
 * PUT /api/users/:id - Update user (full update)
 * Demonstrates PUT
 */
export function updateUser(req: Request, res: Response): void {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required' });
      return;
    }

    users[userIndex] = {
      ...users[userIndex],
      name,
      email,
    };

    res.json({ user: users[userIndex] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
}

/**
 * PATCH /api/users/:id - Partial update user
 * Demonstrates PATCH
 */
export function patchUser(req: Request, res: Response): void {
  try {
    const { id } = req.params;
    const updates = req.body;

    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    users[userIndex] = {
      ...users[userIndex],
      ...updates,
    };

    res.json({ user: users[userIndex] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
}

/**
 * DELETE /api/users/:id - Delete user
 * Demonstrates DELETE
 */
export function deleteUser(req: Request, res: Response): void {
  try {
    const { id } = req.params;
    const userIndex = users.findIndex((u) => u.id === id);

    if (userIndex === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    users.splice(userIndex, 1);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
}

/**
 * GET /api/metrics - Return mock metrics
 * Demonstrates metrics endpoint
 */
export function getMetrics(req: Request, res: Response): void {
  try {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}

/**
 * GET /api/slow - Slow endpoint for timeout/retry testing
 * Demonstrates timeout scenarios
 */
export function slowEndpoint(req: Request, res: Response): void {
  const delay = parseInt(req.query.delay as string) || 5000;

  setTimeout(() => {
    res.json({
      message: 'Slow response',
      delay,
      timestamp: new Date().toISOString(),
    });
  }, delay);
}

/**
 * GET /api/error/:code - Error endpoint for error handling testing
 * Demonstrates various error scenarios
 */
export function errorEndpoint(req: Request, res: Response): void {
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

  res.status(statusCode).json({
    error: errorMessages[statusCode] || 'Unknown Error',
    statusCode,
    message: `Simulated ${statusCode} error for testing`,
  });
}
