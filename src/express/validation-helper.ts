/**
 * ValidationHelper Service
 * Provides reusable validation patterns to reduce code duplication
 */

import { Request } from "express";
import { AppError } from "./error-types";

export class ValidationHelper {
  /**
   * Find entity or throw 404
   * @param finder - Function that returns the entity or null
   * @param entityName - Name of the entity for error messages
   * @param id - Optional ID for error message
   * @returns The found entity
   * @throws AppError with 404 if entity not found
   */
  static async findOrFail<T>(
    finder: () => Promise<T | null>,
    entityName: string,
    id?: string,
  ): Promise<T> {
    const entity = await finder();
    if (!entity) {
      throw new AppError(
        `${entityName} not found${id ? `: ${id}` : ""}`,
        404,
        true,
        undefined,
        "/Errors/NotFound",
      );
    }
    return entity;
  }

  /**
   * Check entity doesn't exist or throw 409
   * @param finder - Function that returns the entity or null
   * @param entityName - Name of the entity for error messages
   * @param identifier - Optional identifier for error message
   * @throws AppError with 409 if entity exists
   */
  static async ensureNotExists<T>(
    finder: () => Promise<T | null>,
    entityName: string,
    identifier?: string,
  ): Promise<void> {
    const entity = await finder();
    if (entity) {
      throw new AppError(
        `${entityName} already exists${identifier ? `: ${identifier}` : ""}`,
        409,
        true,
        undefined,
        "/Errors/Conflict",
      );
    }
  }

  /**
   * Check ownership or admin role
   * @param req - Express request object with userId
   * @param resourceUserId - User ID that owns the resource
   * @param message - Custom error message
   * @throws AppError with 403 if not owner and not admin
   */
  static ensureOwnershipOrAdmin(
    req: { userId?: string; userRoles?: string[] },
    resourceUserId: string,
    message = "No permission to access this resource",
  ): void {
    const isOwner = req.userId === resourceUserId;
    const isAdmin =
      req.userRoles?.includes("admin") || req.userRoles?.includes("superuser");

    if (!isOwner && !isAdmin) {
      throw new AppError(message, 403, true, undefined, "/Errors/Forbidden");
    }
  }

  /**
   * Batch validation - run multiple validations in parallel
   * @param validations - Array of validation functions to execute
   */
  static async validateAll(
    validations: Array<() => Promise<void>>,
  ): Promise<void> {
    await Promise.all(validations.map((v) => v()));
  }

  /**
   * Validate required fields in object
   * @param data - Object to validate
   * @param requiredFields - Array of required field names
   * @param entityName - Name of entity for error message
   * @throws AppError with 400 if required fields are missing
   */
  static validateRequiredFields(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
    requiredFields: string[],
    entityName: string,
  ): void {
    const missingFields = requiredFields.filter(
      (field) =>
        data[field] === undefined || data[field] === null || data[field] === "",
    );

    if (missingFields.length > 0) {
      throw new AppError(
        `Missing required fields for ${entityName}: ${missingFields.join(", ")}`,
        400,
        true,
        undefined,
        "/Errors/BadRequest",
      );
    }
  }

  /**
   * Ensure authenticated user
   * @param req - Express request object with optional userId
   * @throws AppError with 401 if not authenticated
   */
  static ensureAuthenticated(req: Request & { userId?: string }): void {
    if (!req.userId) {
      throw new AppError(
        "Authentication required",
        401,
        true,
        undefined,
        "/Errors/Unauthorized",
      );
    }
  }

  /**
   * Validate string length
   * @param value - String to validate
   * @param fieldName - Field name for error message
   * @param min - Minimum length (optional)
   * @param max - Maximum length (optional)
   * @throws AppError with 400 if validation fails
   */
  static validateStringLength(
    value: string,
    fieldName: string,
    min?: number,
    max?: number,
  ): void {
    if (min !== undefined && value.length < min) {
      throw new AppError(
        `${fieldName} must be at least ${min} characters`,
        400,
        true,
        undefined,
        "/Errors/BadRequest",
      );
    }

    if (max !== undefined && value.length > max) {
      throw new AppError(
        `${fieldName} must not exceed ${max} characters`,
        400,
        true,
        undefined,
        "/Errors/BadRequest",
      );
    }
  }
}
