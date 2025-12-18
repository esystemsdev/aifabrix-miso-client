/**
 * Error handling middleware
 * Provides centralized error handling and response formatting
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  message?: string;
  statusCode: number;
}

/**
 * Error handling middleware
 * Catches errors and formats error responses
 */
export function errorHandler(
  err: Error | unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error
  console.error('Error:', err);

  // Determine status code
  let statusCode = 500;
  let error = 'Internal Server Error';
  let message: string | undefined;

  if (err instanceof Error) {
    message = err.message;
    // Check for common error patterns
    if (err.message.includes('validation')) {
      statusCode = 400;
      error = 'Validation Error';
    } else if (err.message.includes('not found')) {
      statusCode = 404;
      error = 'Not Found';
    } else if (err.message.includes('unauthorized') || err.message.includes('authentication')) {
      statusCode = 401;
      error = 'Unauthorized';
    } else if (err.message.includes('forbidden') || err.message.includes('permission')) {
      statusCode = 403;
      error = 'Forbidden';
    }
  }

  const errorResponse: ErrorResponse = {
    error,
    statusCode,
  };

  if (message) {
    errorResponse.message = message;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404,
  });
}
