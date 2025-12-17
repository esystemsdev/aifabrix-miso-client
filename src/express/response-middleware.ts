/**
 * Response Helpers Injector Middleware
 * Injects response helper methods into Express Response object
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./express.d.ts" />
import { Request, Response, NextFunction } from "express";
import { ResponseHelper, PaginationMeta } from "./response-helper";

/**
 * Inject response helper methods into Express Response
 * Makes standardized response methods available on all responses
 *
 * Usage in routes:
 * - res.success(data, 'User retrieved')
 * - res.created(user, 'User created')
 * - res.paginated(users, meta)
 * - res.noContent()
 * - res.accepted(job, 'Job queued')
 */
export function injectResponseHelpers(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Inject helper methods
  res.success = <T>(data: T, message?: string) =>
    ResponseHelper.success(res, data, message);

  res.created = <T>(data: T, message?: string) =>
    ResponseHelper.created(res, data, message);

  res.paginated = <T>(items: T[], meta: PaginationMeta) =>
    ResponseHelper.paginated(res, items, meta);

  res.noContent = () => ResponseHelper.noContent(res);

  res.accepted = <T>(data?: T, message?: string) =>
    ResponseHelper.accepted(res, data, message);

  next();
}
