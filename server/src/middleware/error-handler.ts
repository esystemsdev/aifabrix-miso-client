/**
 * Error handling middleware
 * Provides centralized error handling and response formatting
 *
 * NOTE: This middleware is replaced by handleRouteError from @aifabrix/miso-client
 * This file is kept for backward compatibility but should use handleRouteError in server.ts
 */

import { Request, Response, NextFunction } from 'express';
import { handleRouteError, asyncHandler, AppError } from '@aifabrix/miso-client';

/**
 * Error handling middleware
 * Catches errors and formats error responses
 *
 * @deprecated Use handleRouteError from @aifabrix/miso-client instead
 * This function is kept for backward compatibility
 */
export async function errorHandler(
  err: Error | unknown,
  req: Request,
  _res: Response,
  _next: NextFunction
): Promise<void> {
  // Use handleRouteError from SDK for RFC 7807 compliant error handling
  await handleRouteError(err, req, _res);
}

/**
 * 404 Not Found handler
 * Uses AppError for consistent error formatting
 */
export const notFoundHandler = asyncHandler(async (req: Request, _res: Response): Promise<void> => {
  throw new AppError(`Route ${req.method} ${req.path} not found`, 404);
}, 'notFound');
