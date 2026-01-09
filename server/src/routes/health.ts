/**
 * Health check route
 * Provides health check endpoint for monitoring
 */

import { Request, Response } from 'express';
import { MisoClient, asyncHandler } from '@aifabrix/miso-client';

/**
 * Health check endpoint
 * Returns server status and uptime
 */
export function healthHandler(misoClient: MisoClient | null) {
  return asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (misoClient) {
      await misoClient.log.forRequest(req).info('Health check called');
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }, 'healthCheck');
}
