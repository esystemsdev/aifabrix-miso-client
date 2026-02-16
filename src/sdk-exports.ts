/**
 * SDK public exports - split from index.ts to satisfy max-lines rule
 */

export * from "./types/config.types";
export type * from "./types/pagination.types";
export * from "./types/filter.types";
export * from "./types/filter-schema.types";
export type * from "./types/sort.types";
export type {
  ErrorResponse as ErrorResponseFromErrors,
  ErrorEnvelope,
  AuthErrorMethod,
} from "./types/errors.types";
export { detectAuthMethodFromHeaders } from "./utils/http-error-handler";
export { AuthService } from "./services/auth.service";
export { RoleService } from "./services/role.service";
export { PermissionService } from "./services/permission.service";
export { BrowserPermissionService } from "./services/browser-permission.service";
export { BrowserRoleService } from "./services/browser-role.service";
export { LoggerService } from "./services/logger";
export { RedisService } from "./services/redis.service";
export { CacheService } from "./services/cache.service";
export { HttpClient } from "./utils/http-client";
export { getLogger } from "./services/logger/unified-logger.factory";
export { LoggerContextStorage } from "./services/logger";
export type { UnifiedLogger } from "./services/logger/unified-logger.service";
export { loadConfig } from "./utils/config-loader";
export { validateOrigin } from "./utils/origin-validator";
export { getEnvironmentToken } from "./utils/environment-token";
export { extractClientTokenInfo } from "./utils/token-utils";
export type { ClientTokenInfo } from "./utils/token-utils";
export type { OriginValidationResult } from "./utils/origin-validator";
export { resolveControllerUrl, resolveKeycloakUrl, isBrowser, validateUrl } from "./utils/controller-url-resolver";
export { extractLoggingContext } from "./utils/logging-helpers";
export type { IndexedLoggingContext, HasKey, HasExternalSystem } from "./utils/logging-helpers";
export { extractRequestContext } from "./utils/request-context";
export type { RequestContext } from "./utils/request-context";
export * from "./utils/pagination.utils";
export * from "./utils/filter.utils";
export * from "./utils/filter-schema.utils";
export * from "./utils/sort.utils";
export { MisoClientError, ApiErrorException, transformError, handleApiError } from "./utils/errors";
export { EncryptionService } from "./services/encryption.service";
export type { EncryptResult } from "./services/encryption.service";
export { EncryptionError } from "./utils/encryption-error";
export type { EncryptionErrorCode } from "./utils/encryption-error";
export type {
  EncryptRequest,
  EncryptResponse,
  DecryptRequest,
  DecryptResponse,
  EncryptionStorage,
} from "./api/types/encryption.types";
export type {
  ApplicationStatus,
  UpdateSelfStatusRequest,
  UpdateSelfStatusResponse,
  ApplicationStatusResponse,
} from "./api/types/applications.types";
export { APPLICATION_STATUS_VALUES } from "./api/types/applications.types";
export {
  ResponseHelper,
  injectResponseHelpers,
  asyncHandler,
  asyncHandlerNamed,
  ValidationHelper,
  AppError,
  createSuccessResponse,
  createErrorResponse,
  setErrorLogger,
  handleRouteError,
  getErrorTypeUri,
  getErrorTitle,
  sendErrorResponse,
  createClientTokenEndpoint,
  hasConfig,
  loggerContextMiddleware,
} from "./express";
export type {
  PaginationMeta,
  ApiError,
  ValidationError,
  ApiResponse,
  ErrorLogger,
  RBACErrorExtensions,
} from "./express";
export type {
  ClientTokenEndpointOptions,
  ClientTokenResponse,
  DataClientConfigResponse,
} from "./express";
export type { ErrorResponse as ExpressErrorResponse } from "./express/error-response";
export { DataClient, dataClient } from "./utils/data-client";
export type {
  DataClientConfig,
  ApiRequestOptions,
  InterceptorConfig,
  RequestMetrics,
  AuditConfig as DataClientAuditConfig,
  CacheEntry,
  NetworkError,
  TimeoutError,
  AuthenticationError,
  ApiError as DataClientApiError,
} from "./types/data-client.types";
export { autoInitializeDataClient, getCachedDataClientConfig } from "./utils/data-client-auto-init";
export type { AutoInitOptions } from "./utils/data-client-auto-init";
export type {
  TokenType,
  TokenValidationOptions,
  TokenValidationResult,
  TokenPayload,
  KeycloakConfig,
  DelegatedProviderConfig,
  DelegatedProviderLookup,
} from "./types/token-validation.types";
export { TokenValidationService } from "./services/token-validation.service";
