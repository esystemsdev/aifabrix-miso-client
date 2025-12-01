/**
 * Async Handler Utility
 * Wraps async route handlers to automatically catch and handle errors
 *
 * This eliminates the need for try-catch blocks in every route handler
 * and provides consistent error handling across the application.
 *
 * @example
 * ```typescript
 * router.get('/users/:id',
 *   asyncHandler(async (req, res) => {
 *     const user = await userService.findById(req.params.id);
 *     res.success(user);
 *   })
 * );
 * ```
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import { handleRouteError } from "./error-handler";

/**
 * Wraps an async route handler to catch errors automatically
 *
 * @param fn - Async route handler function
 * @param operationName - Optional operation name for error logging
 * @returns Express RequestHandler that catches errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  operationName?: string,
): RequestHandler {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error) {
      // Extract operation name from route if not provided
      const operation =
        operationName || `${req.method} ${req.route?.path || req.path}`;
      await handleRouteError(error, req, res, operation);
    }
  };
}

/**
 * Alternative syntax for named operations
 *
 * @example
 * ```typescript
 * router.get('/users/:id',
 *   asyncHandlerNamed('getUser', async (req, res) => {
 *     const user = await userService.findById(req.params.id);
 *     res.success(user);
 *   })
 * );
 * ```
 */
export function asyncHandlerNamed(
  operationName: string,
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return asyncHandler(fn, operationName);
}
