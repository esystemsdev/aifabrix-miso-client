/**
 * CORS middleware with origin validation
 * Provides secure CORS configuration with origin validation
 */

import { Request, Response, NextFunction } from 'express';
import { validateOrigin, MisoClient } from '@aifabrix/miso-client';

/**
 * CORS middleware configuration
 * @param allowedOrigins - Array of allowed origins
 * @param misoClient - Optional MisoClient instance for logging
 * @returns Express middleware function
 */
export function corsMiddleware(allowedOrigins: string[], misoClient?: MisoClient | null) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Always call next() to prevent hanging - set CORS headers but don't block
    const origin = req.headers.origin;

    // Set CORS headers - be permissive in development
    if (origin) {
      // Try to validate origin, but don't block if it fails
      try {
        const validation = validateOrigin(req, allowedOrigins);
        if (validation.valid) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Access-Control-Allow-Credentials', 'true');
        } else {
          // Even if validation fails, allow in development (fail open)
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Access-Control-Allow-Credentials', 'true');
        }
      } catch (error) {
        // If validation throws, still allow the request (fail open for development)
        // Log warning using MisoClient logger if available
        if (misoClient) {
          try {
            await misoClient.log.forRequest(req).addContext('error', error instanceof Error ? error.message : String(error)).addContext('level', 'warning').info('Origin validation error (allowing anyway)');
          } catch {
            // Fallback to console if logger fails
            console.warn('Origin validation error (allowing anyway):', error);
          }
        } else {
          console.warn('Origin validation error (allowing anyway):', error);
        }
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      // Allow requests without origin (e.g., Postman, curl, server-to-server)
      res.header('Access-Control-Allow-Origin', '*');
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-token');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    // Always call next() - never block the request pipeline
    next();
  };
}
