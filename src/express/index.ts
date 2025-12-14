/**
 * Express.js Utilities
 * Generic helpers for building Express.js REST APIs
 */

// Response helpers
export { ResponseHelper, PaginationMeta } from "./response-helper";
export { injectResponseHelpers } from "./response-middleware";

// Async handler
export { asyncHandler, asyncHandlerNamed } from "./async-handler";

// Validation
export { ValidationHelper } from "./validation-helper";

// Error handling - Types
export {
  AppError,
  ApiError,
  ValidationError,
  ApiResponse,
  createSuccessResponse,
  createErrorResponse,
} from "./error-types";

// Error handling - Utilities
export { ErrorLogger, setErrorLogger, handleRouteError } from "./error-handler";

// Error handling - Response
export {
  ErrorResponse,
  RBACErrorExtensions,
  getErrorTypeUri,
  getErrorTitle,
  sendErrorResponse,
} from "./error-response";

// Encryption
export { EncryptionUtil } from "./encryption";

// Origin validation and environment token utilities
export { validateOrigin } from "../utils/origin-validator";
export { getEnvironmentToken } from "../utils/environment-token";
export { extractClientTokenInfo } from "../utils/token-utils";
export type { ClientTokenInfo } from "../utils/token-utils";
export type { OriginValidationResult } from "../utils/origin-validator";

// Type augmentation (imported for side effects)
import "./express.d.ts";
