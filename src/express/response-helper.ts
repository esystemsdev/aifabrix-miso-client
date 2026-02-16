/**
 * Response Helper Utilities
 * Standardizes API response formats across the application
 */

import { Response } from "express";
import { createPaginatedListResponse } from "../utils/pagination.utils";
import { AppError } from "./error-types";

/**
 * Pagination metadata for paginated responses
 */
export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages?: number;
  type: string;
}

/**
 * Response Helper for standardizing API responses
 */
export class ResponseHelper {
  /**
   * Success response with data (200)
   * @param res - Express response object
   * @param data - Response data
   * @param message - Optional success message
   * @param statusCode - HTTP status code (default: 200)
   */
  static success<T>(
    res: Response,
    data: T,
    message?: string,
    statusCode = 200,
  ): Response {
    const response: {
      success: true;
      data: T;
      message?: string;
      timestamp: string;
    } = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    if (message) {
      response.message = message;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Created response (201)
   * @param res - Express response object
   * @param data - Created resource data
   * @param message - Optional success message (default: 'Resource created')
   */
  static created<T>(
    res: Response,
    data: T,
    message = "Resource created",
  ): Response {
    return ResponseHelper.success(res, data, message, 201);
  }

  /**
   * Paginated list response (200)
   * Uses miso-client SDK standard format: { data, meta }
   * @param res - Express response object
   * @param items - Array of items
   * @param meta - Pagination metadata
   */
  static paginated<T>(
    res: Response,
    items: T[],
    meta: PaginationMeta,
  ): Response {
    const response = createPaginatedListResponse(
      items,
      meta.totalItems,
      meta.currentPage,
      meta.pageSize,
      meta.type,
    );
    return res.status(200).json(response);
  }

  /**
   * No content response (204)
   * @param res - Express response object
   */
  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  /**
   * Accepted response (202)
   * Used for async operations that have been accepted but not completed
   * @param res - Express response object
   * @param data - Optional data about the accepted request
   * @param message - Optional message (default: 'Request accepted')
   */
  static accepted<T>(
    res: Response,
    data?: T,
    message = "Request accepted",
  ): Response {
    return ResponseHelper.success(res, data, message, 202);
  }

  /**
   * Error response helper
   * Throws an AppError which will be caught by error middleware
   * @param message - Error message
   * @param statusCode - HTTP status code (default: 400)
   * @param isOperational - Whether error is operational (default: true)
   * @param validationErrors - Optional validation errors
   * @param errorType - Optional error type/code
   */
  static error(
    message: string,
    statusCode = 400,
    isOperational = true,
    validationErrors?: unknown,
    errorType?: string,
  ): never {
    throw new AppError(message, statusCode, isOperational, {
      validationErrors: validationErrors as import("./error-types").ValidationError[] | undefined,
      errorType,
    });
  }
}
