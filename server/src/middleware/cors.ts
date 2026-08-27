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
  const trustedOrigins = new Set(
    allowedOrigins.filter((allowedOrigin) => allowedOrigin !== '*' && allowedOrigin !== 'null')
  );

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const origin = req.headers.origin;

    if (origin) {
      try {
        const validation = validateOrigin(req, allowedOrigins);
        if (validation.valid && trustedOrigins.has(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
          res.header('Access-Control-Allow-Credentials', 'true');
        }
      } catch (error) {
        // Validation failure should not fail open for credentialed requests.
        if (misoClient) {
          try {
            await misoClient.log
              .forRequest(req)
              .addContext('error', error instanceof Error ? error.message : String(error))
              .addContext('level', 'warning')
              .info('Origin validation error (blocked for credentialed CORS)');
          } catch {
            console.warn('Origin validation error (blocked):', error);
          }
        } else {
          console.warn('Origin validation error (blocked):', error);
        }
      }
    }

    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-token');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  };
}
