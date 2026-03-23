/**
 * Logs API request and response type definitions
 * All types use camelCase naming convention for public API outputs
 */

/**
 * Foreign key reference object
 * Used for applicationId and userId fields in log entry responses
 * Matches OpenAPI schema: ForeignKeyReference
 */
export interface ForeignKeyReference {
  id: string;
  key: string;
  name: string;
  type: string;
}

/**
 * Log entry base structure
 * Used in batch log requests and responses
 */
export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'audit' | 'info' | 'debug';
  message: string;
  environment?: string;
  application?: string;
  clientId?: string;
  applicationId?: ForeignKeyReference | null;
  sourceId?: string;
  sourceDisplayName?: string;
  externalSystemId?: string;
  externalSystemDisplayName?: string;
  recordId?: string;
  recordDisplayName?: string;
  userId?: ForeignKeyReference | null;
  context?: Record<string, unknown>;
  stackTrace?: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  hostname?: string;
}

/**
 * General log entry
 * Response type from GET /api/v1/logs/general
 */
export interface GeneralLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  environment: string;
  application: string;
  clientId?: string;
  applicationId?: ForeignKeyReference | null;
  sourceId?: string;
  sourceDisplayName?: string;
  externalSystemId?: string;
  externalSystemDisplayName?: string;
  recordId?: string;
  recordDisplayName?: string;
  userId?: ForeignKeyReference | null;
  message: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  hostname?: string;
  requestId?: string;
  sessionId?: string;
}

/**
 * Audit log entry
 * Response type from GET /api/v1/logs/audit
 */
export interface AuditLogEntry {
  timestamp: string;
  environment: string;
  application: string;
  clientId?: string;
  applicationId?: ForeignKeyReference | null;
  sourceId?: string;
  sourceDisplayName?: string;
  externalSystemId?: string;
  externalSystemDisplayName?: string;
  recordId?: string;
  recordDisplayName?: string;
  userId?: ForeignKeyReference | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  hostname?: string;
  requestId?: string;
  sessionId?: string;
  correlationId?: string;
}

/**
 * Job log entry
 */
export interface JobLogEntry {
  id: string;
  jobId: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Create log request (unified endpoint for error/general/audit logs)
 */
export interface CreateLogRequest {
  type: 'error' | 'general' | 'audit';
  data: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    message: string;
    context?: Record<string, unknown>;
    correlationId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  };
}

/**
 * Create log response
 */
export interface CreateLogResponse {
  success: boolean;
  data: null;
  message: string;
  timestamp: string;
}

/**
 * Batch log entry for requests
 * Controller accepts strings and converts them to ForeignKeyReference objects
 */
export interface BatchLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'audit' | 'info' | 'debug';
  message: string;
  environment?: string;
  application?: string;
  clientId?: string;
  applicationId?: ForeignKeyReference | string | null;
  sourceId?: string;
  sourceDisplayName?: string;
  externalSystemId?: string;
  externalSystemDisplayName?: string;
  recordId?: string;
  recordDisplayName?: string;
  userId?: ForeignKeyReference | string | null;
  context?: Record<string, unknown>;
  stackTrace?: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  hostname?: string;
}

/**
 * Batch log request (1-100 items)
 * Uses BatchLogEntry which accepts both strings and ForeignKeyReference objects
 */
export interface BatchLogRequest {
  logs: BatchLogEntry[];
}

/**
 * Batch log response
 */
export interface BatchLogResponse {
  success: boolean;
  message: string;
  processed: number;
  failed: number;
  errors?: Array<{
    index: number;
    error: string;
    log: Record<string, unknown>;
  }>;
  timestamp: string;
}

/**
 * Shared pagination and list query parameters
 */
export interface BaseListLogsQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  filter?: string;
  level?: string;
  environment?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Query parameters for general and audit log list endpoints.
 * Id-based filters are required for these surfaces.
 */
export interface LogsListQueryParams extends BaseListLogsQueryParams {
  applicationId?: string;
  clientId?: string;
  sourceId?: string;
  externalSystemId?: string;
  recordId?: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Query parameters for job log list endpoints.
 * Uses id-based application filter.
 */
export interface JobLogsQueryParams extends BaseListLogsQueryParams {
  applicationId?: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Paginated logs response
 */
export interface PaginatedLogsResponse<T> {
  data: T[];
  meta: {
    totalItems: number;
    currentPage: number;
    pageSize: number;
    type: string;
  };
  links: {
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
  };
}

/**
 * Get log stats query parameters
 */
export interface GetLogStatsQueryParams {
  environment?: string;
  applicationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Log stats summary response
 */
export interface LogStatsSummaryResponse {
  success: boolean;
  data: {
    totalLogs: number;
    byLevel: Record<string, number>;
    byApplication: Record<string, number>;
    environment: string;
  };
  timestamp: string;
}

/**
 * Error stats query parameters
 */
export interface ErrorStatsQueryParams extends GetLogStatsQueryParams {
  limit?: number;
}

/**
 * Error stats response
 */
export interface ErrorStatsResponse {
  success: boolean;
  data: {
    totalErrors: number;
    topErrors: Array<{
      message: string;
      count: number;
    }>;
    environment: string;
  };
  timestamp: string;
}

/**
 * User activity stats query parameters
 */
export interface UserActivityStatsQueryParams extends GetLogStatsQueryParams {
  limit?: number;
}

/**
 * User activity stats response
 */
export interface UserActivityStatsResponse {
  success: boolean;
  data: {
    totalUsers: number;
    topUsers: Array<{
      userId: string;
      actionCount: number;
    }>;
    byAction: Record<string, number>;
    environment: string;
  };
  timestamp: string;
}

/**
 * Application stats response
 */
export interface ApplicationStatsResponse {
  success: boolean;
  data: {
    totalApplications: number;
    applications: Array<{
      application: string;
      logCount: number;
    }>;
    environment: string;
  };
  timestamp: string;
}

/**
 * Export logs query parameters
 */
export interface ExportLogsQueryParams {
  type: 'general' | 'audit' | 'jobs';
  format: 'csv' | 'json';
  environment?: string;
  applicationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Export logs response (JSON format)
 */
export interface ExportLogsResponse {
  success: boolean;
  data: Record<string, unknown>[];
  meta: {
    type: string;
    environment: string;
    exportedAt: string;
    count: number;
  };
}

