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

// Client token endpoint helper
export {
  createClientTokenEndpoint,
  hasConfig,
} from "./client-token-endpoint";
export type {
  ClientTokenEndpointOptions,
  ClientTokenResponse,
  DataClientConfigResponse,
} from "./client-token-endpoint";

// Logger context middleware
export { loggerContextMiddleware } from "./logger-context.middleware";

// Note: express.d.ts provides type augmentation for Express Response types.
// It doesn't need to be imported - TypeScript automatically picks up .d.ts files
// in the same directory. The build script copies it to dist/express/express.d.ts.
