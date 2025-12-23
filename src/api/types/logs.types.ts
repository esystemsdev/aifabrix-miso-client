/**
 * Logs API request and response type definitions
 * All types use camelCase naming convention for public API outputs
 */

/**
 * Log entry base structure
 */
export interface LogEntry {
  timestamp: string;
  level: 'error' | 'audit' | 'info' | 'debug';
  message: string;
  environment?: string;
  application?: string;
  applicationId?: string;
  userId?: string;
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
 */
export interface GeneralLogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  environment: string;
  application: string;
  applicationId?: string;
  userId?: string;
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
 */
export interface AuditLogEntry {
  timestamp: string;
  environment: string;
  application: string;
  applicationId?: string;
  userId?: string;
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
  message: string;
  timestamp: string;
}

/**
 * Batch log request (1-100 items)
 */
export interface BatchLogRequest {
  logs: LogEntry[];
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
 * List logs query parameters
 */
export interface ListLogsQueryParams {
  page?: number;
  pageSize?: number;
  sort?: string;
  filter?: string;
  level?: string;
  environment?: string;
  application?: string;
  userId?: string;
  correlationId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
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
  application?: string;
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
  application?: string;
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

