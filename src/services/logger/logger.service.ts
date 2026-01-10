/**
 * Logger service for application logging and audit events
 */

import { EventEmitter } from "events";
import { Request } from "express";
import { HttpClient } from "../../utils/http-client";
import { ApiClient } from "../../api";
import { RedisService } from "../redis.service";
import { DataMasker } from "../../utils/data-masker";
import { MisoClientConfig, LogEntry } from "../../types/config.types";
import { AuditLogQueue } from "../../utils/audit-log-queue";
import { LoggerChain } from "./logger-chain";
import { ApplicationContextService } from "../application-context.service";
import {
  extractJwtContext,
  extractEnvironmentMetadata,
  getLogWithRequest,
  getWithContext,
  getWithToken,
} from "./logger-context";

export interface ClientLoggingOptions {
  applicationId?: string;
  userId?: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  token?: string; // JWT token for context extraction
  maskSensitiveData?: boolean;
  // Request metadata (top-level LogEntry fields)
  ipAddress?: string;
  userAgent?: string;

  // Indexed context fields
  sourceKey?: string;
  sourceDisplayName?: string;
  externalSystemKey?: string;
  externalSystemDisplayName?: string;
  recordKey?: string;
  recordDisplayName?: string;

  // Credential context
  credentialId?: string;
  credentialType?: string;

  // Request metrics
  requestSize?: number;
  responseSize?: number;
  durationMs?: number;

  // Error classification
  errorCategory?: string;
  httpStatusCategory?: string;
}

export class LoggerService extends EventEmitter {
  private httpClient: HttpClient;
  private apiClient?: ApiClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private maskSensitiveData = true; // Default: mask sensitive data
  private correlationCounter = 0;
  private auditLogQueue: AuditLogQueue | null = null;
  private applicationContextService: ApplicationContextService;
  // Circuit breaker for HTTP logging - skip attempts after repeated failures
  private httpLoggingFailures = 0;
  private httpLoggingDisabledUntil: number | null = null;
  private static readonly MAX_FAILURES = 3;
  private static readonly DISABLE_DURATION_MS = 60000; // 1 minute

  constructor(httpClient: HttpClient, redis: RedisService) {
    super(); // Initialize EventEmitter
    this.config = httpClient.config;
    this.redis = redis;
    this.httpClient = httpClient;
    this.applicationContextService = new ApplicationContextService(httpClient);

    // Initialize audit log queue if batch logging is enabled
    const auditConfig = this.config.audit || {};
    if (
      auditConfig.batchSize !== undefined ||
      auditConfig.batchInterval !== undefined
    ) {
      this.auditLogQueue = new AuditLogQueue(
        httpClient,
        redis,
        this.config,
        this,
      );
    }
  }

  /**
   * Set ApiClient instance (used to resolve circular dependency)
   * @param apiClient - ApiClient instance
   */
  setApiClient(apiClient: ApiClient): void {
    this.apiClient = apiClient;
    // Also set ApiClient in AuditLogQueue if available
    if (this.auditLogQueue) {
      this.auditLogQueue.setApiClient(apiClient);
    }
  }

  /**
   * Get ApplicationContextService instance
   * Used by UnifiedLoggerService to access application context
   * @returns ApplicationContextService instance
   */
  getApplicationContextService(): ApplicationContextService {
    return this.applicationContextService;
  }

  /**
   * Enable or disable sensitive data masking
   */
  setMasking(enabled: boolean): void {
    this.maskSensitiveData = enabled;
  }

  /**
   * Generate unique correlation ID for request tracking
   * Public method to allow other modules to generate consistent correlation IDs
   *
   * @returns Unique correlation ID string
   *
   * @example
   * ```typescript
   * const correlationId = loggerService.generateCorrelationId();
   * ```
   */
  public generateCorrelationId(): string {
    this.correlationCounter = (this.correlationCounter + 1) % 10000;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    // Use clientId instead of applicationKey
    const clientPrefix = this.config.clientId.substring(0, 10);
    return `${clientPrefix}-${timestamp}-${this.correlationCounter}-${random}`;
  }

  /**
   * Log error message with optional stack trace and enhanced options
   */
  async error(
    message: string,
    context?: Record<string, unknown>,
    stackTrace?: string,
    options?: ClientLoggingOptions,
  ): Promise<void> {
    await this.log("error", message, context, stackTrace, options);
  }

  /**
   * Log audit event with enhanced options
   */
  async audit(
    action: string,
    resource: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions,
  ): Promise<void> {
    const auditContext = {
      action,
      resource,
      ...context,
    };
    await this.log(
      "audit",
      `Audit: ${action} on ${resource}`,
      auditContext,
      undefined,
      options,
    );
  }

  /**
   * Log info message with enhanced options
   */
  async info(
    message: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions,
  ): Promise<void> {
    await this.log("info", message, context, undefined, options);
  }

  /**
   * Log debug message with enhanced options
   */
  async debug(
    message: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions,
  ): Promise<void> {
    if (this.config.logLevel === "debug") {
      await this.log("debug", message, context, undefined, options);
    }
  }

  /**
   * Internal log method with enhanced features
   */
  private async log(
    level: LogEntry["level"],
    message: string,
    context?: Record<string, unknown>,
    stackTrace?: string,
    options?: ClientLoggingOptions,
  ): Promise<void> {
    // Extract JWT context if token provided
    const jwtContext = options?.token
      ? extractJwtContext(options.token)
      : {};

    // Extract environment metadata
    const metadata = extractEnvironmentMetadata();

    // Generate correlation ID if not provided
    const correlationId =
      options?.correlationId || this.generateCorrelationId();

    // Mask sensitive data in context if enabled
    const maskSensitive =
      options?.maskSensitiveData !== false && this.maskSensitiveData;
    const maskedContext =
      maskSensitive && context
        ? (DataMasker.maskSensitiveData(context) as Record<string, unknown>)
        : context;

    // Get application context
    const appContext = this.applicationContextService.getApplicationContext();
    
    // Extract applicationId from options, then try client token, then user JWT
    let applicationId = options?.applicationId || "";
    if (!applicationId && appContext.applicationId) {
      applicationId = appContext.applicationId;
    }
    if (!applicationId && jwtContext.applicationId) {
      applicationId = jwtContext.applicationId;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      environment: appContext.environment || "unknown",
      application: appContext.application || this.config.clientId,
      applicationId,
      message,
      context: maskedContext,
      stackTrace,
      correlationId,
      userId: options?.userId || jwtContext.userId,
      sessionId: options?.sessionId || jwtContext.sessionId,
      requestId: options?.requestId,
      ipAddress: options?.ipAddress || metadata.ipAddress,
      userAgent: options?.userAgent || metadata.userAgent,
      ...metadata,
      // Indexed context fields
      sourceKey: options?.sourceKey,
      sourceDisplayName: options?.sourceDisplayName,
      externalSystemKey: options?.externalSystemKey,
      externalSystemDisplayName: options?.externalSystemDisplayName,
      recordKey: options?.recordKey,
      recordDisplayName: options?.recordDisplayName,
      // Credential context
      credentialId: options?.credentialId,
      credentialType: options?.credentialType,
      // Request metrics
      requestSize: options?.requestSize,
      responseSize: options?.responseSize,
      durationMs: options?.durationMs,
      // Error classification
      errorCategory: options?.errorCategory,
      httpStatusCategory: options?.httpStatusCategory,
    };

    // If emitEvents is enabled, emit event and skip HTTP/Redis
    if (this.config.emitEvents) {
      // Emit log event - same payload structure as REST API
      // Listener can check logEntry.level to filter by log level if needed
      this.emit("log", logEntry);
      return;
    }

    // Use batch queue for audit logs if available
    if (level === "audit" && this.auditLogQueue) {
      await this.auditLogQueue.add(logEntry);
      return;
    }

    // Try Redis first (if available)
    if (this.redis.isConnected()) {
      const queueName = `logs:${this.config.clientId}`;
      const success = await this.redis.rpush(
        queueName,
        JSON.stringify(logEntry),
      );

      if (success) {
        return; // Successfully queued in Redis
      }
    }

    // Check circuit breaker - skip HTTP logging if we've had too many failures
    const now = Date.now();
    if (this.httpLoggingDisabledUntil && now < this.httpLoggingDisabledUntil) {
      // Circuit breaker is open - skip HTTP logging attempt
      return;
    }

    // Send to unified logging endpoint with client credentials
    try {
      if (!this.apiClient) {
        throw new Error('ApiClient not initialized. Call setApiClient() before logging.');
      }

      // Map LogEntry to CreateLogRequest format
      const logType = level === 'audit' ? 'audit' : level === 'error' ? 'error' : 'general';
      // Map level: 'audit' -> 'info', others map directly (CreateLogRequest.data.level doesn't accept 'audit')
      const logLevel = level === 'audit' ? 'info' : level === 'error' ? 'error' : level === 'info' ? 'info' : 'debug';
      
      // Build context with all LogEntry fields (backend extracts environment/application from credentials)
      const enrichedContext: Record<string, unknown> = {
        ...logEntry.context,
        // Include additional LogEntry fields in context
        userId: logEntry.userId,
        sessionId: logEntry.sessionId,
        requestId: logEntry.requestId,
        ipAddress: logEntry.ipAddress,
        userAgent: logEntry.userAgent,
        hostname: logEntry.hostname,
        applicationId: logEntry.applicationId,
        sourceKey: logEntry.sourceKey,
        sourceDisplayName: logEntry.sourceDisplayName,
        externalSystemKey: logEntry.externalSystemKey,
        externalSystemDisplayName: logEntry.externalSystemDisplayName,
        recordKey: logEntry.recordKey,
        recordDisplayName: logEntry.recordDisplayName,
        credentialId: logEntry.credentialId,
        credentialType: logEntry.credentialType,
        requestSize: logEntry.requestSize,
        responseSize: logEntry.responseSize,
        durationMs: logEntry.durationMs,
        errorCategory: logEntry.errorCategory,
        httpStatusCategory: logEntry.httpStatusCategory,
      };
      
      // Remove undefined values to keep payload clean
      Object.keys(enrichedContext).forEach(key => {
        if (enrichedContext[key] === undefined) {
          delete enrichedContext[key];
        }
      });
      
      // Include stackTrace in context if present
      if (logEntry.stackTrace) {
        enrichedContext.stackTrace = logEntry.stackTrace;
      }
      
      // For audit logs, extract required fields from context
      if (level === 'audit') {
        // Extract action and resource from context (set by audit() method)
        const auditAction = enrichedContext.action as string | undefined;
        const auditResource = enrichedContext.resource as string | undefined;
        
        // Extract entityType and entityId if already provided in context
        const providedEntityType = enrichedContext.entityType as string | undefined;
        const providedEntityId = enrichedContext.entityId as string | undefined;
        const providedOldValues = enrichedContext.oldValues as Record<string, unknown> | undefined;
        const providedNewValues = enrichedContext.newValues as Record<string, unknown> | undefined;
        
        // Remove fields that will be moved to data object (not in context)
        delete enrichedContext.action;
        delete enrichedContext.resource;
        delete enrichedContext.entityType;
        delete enrichedContext.entityId;
        delete enrichedContext.oldValues;
        delete enrichedContext.newValues;
        
        // Map to required audit log fields
        // entityType: Type of entity (use provided, or default to "HTTP Request" for HTTP requests, or "API Endpoint" for API paths)
        // entityId: The resource/URL being acted upon (use provided, or default to resource/URL)
        // action: The action being performed (use provided action from audit() call)
        const entityType = providedEntityType || 
                          (auditResource && auditResource.startsWith('/api/') ? 'API Endpoint' : 'HTTP Request');
        const entityId = providedEntityId || auditResource || 'unknown';
        const action = auditAction || 'unknown';
        
        await this.apiClient.logs.createLog({
          type: logType,
          data: {
            level: logLevel,
            message: logEntry.message,
            context: enrichedContext,
            correlationId: logEntry.correlationId,
            entityType,
            entityId,
            action,
            // Include oldValues and newValues if present
            oldValues: providedOldValues,
            newValues: providedNewValues,
          },
        });
      } else {
        await this.apiClient.logs.createLog({
          type: logType,
          data: {
            level: logLevel,
            message: logEntry.message,
            context: enrichedContext,
            correlationId: logEntry.correlationId,
          },
        });
      }
      // Success - reset failure counter
      this.httpLoggingFailures = 0;
      this.httpLoggingDisabledUntil = null;
    } catch (error) {
      // Failed to send log to controller
      // Check if it's a 401 (token expired) - don't count towards failure threshold
      const isAuthError = error instanceof Error && 
        (error.message.includes('401') || 
         error.message.includes('Unauthorized') ||
         (error as { statusCode?: number }).statusCode === 401);
      
      if (!isAuthError) {
        // Only increment failure counter for non-auth errors
        this.httpLoggingFailures++;
        if (this.httpLoggingFailures >= LoggerService.MAX_FAILURES) {
          // Open circuit breaker - disable HTTP logging for a period
          this.httpLoggingDisabledUntil = now + LoggerService.DISABLE_DURATION_MS;
          this.httpLoggingFailures = 0; // Reset counter for next attempt after cooldown
        }
      }
      // Silently fail to avoid infinite logging loops
      // Application should implement retry or buffer strategy if needed
    }
  }

  /**
   * Method chaining support for complex logging scenarios
   */
  withContext(context: Record<string, unknown>): LoggerChain {
    return new LoggerChain(this, context);
  }

  withToken(token: string): LoggerChain {
    return new LoggerChain(this, {}, { token });
  }

  withoutMasking(): LoggerChain {
    return new LoggerChain(this, {}, { maskSensitiveData: false });
  }

  /**
   * Get LogEntry object with request context extracted
   * Extracts IP, method, path, userAgent, correlationId, userId from Express Request
   * Returns structured LogEntry object ready for external logger tables
   *
   * @param req - Express Request object
   * @param message - Log message
   * @param level - Optional log level (defaults to 'info')
   * @param context - Optional additional context
   * @returns Complete LogEntry object with all request context extracted
   *
   * @example
   * ```typescript
   * const logEntry = client.log.getLogWithRequest(req, 'User action', 'info', { action: 'login' });
   * await myCustomLogger.save(logEntry); // Save to own logger table
   * ```
   */
  getLogWithRequest(
    req: Request,
    message: string,
    level: LogEntry["level"] = "info",
    context?: Record<string, unknown>,
  ): LogEntry {
    return getLogWithRequest(
      req,
      message,
      level,
      context,
      this.applicationContextService,
      () => this.generateCorrelationId(),
      this.maskSensitiveData,
      this.config.clientId,
    );
  }

  /**
   * Get LogEntry object with provided context
   * Generates correlation ID automatically and extracts metadata from environment
   *
   * @param context - Context object to include in logs
   * @param message - Log message
   * @param level - Optional log level (defaults to 'info')
   * @returns Complete LogEntry object
   *
   * @example
   * ```typescript
   * const logEntry = client.log.getWithContext({ operation: 'sync' }, 'Sync started');
   * await myCustomLogger.save(logEntry);
   * ```
   */
  getWithContext(
    context: Record<string, unknown>,
    message: string,
    level: LogEntry["level"] = "info",
  ): LogEntry {
    return getWithContext(
      context,
      message,
      level,
      this.applicationContextService,
      () => this.generateCorrelationId(),
      this.maskSensitiveData,
      this.config.clientId,
    );
  }

  /**
   * Get LogEntry object with token context extracted
   * Extracts userId, sessionId, applicationId from JWT token
   * Generates correlation ID automatically
   *
   * @param token - JWT token to extract user context from
   * @param message - Log message
   * @param level - Optional log level (defaults to 'info')
   * @param context - Optional additional context
   * @returns Complete LogEntry object with user context
   *
   * @example
   * ```typescript
   * const logEntry = client.log.getWithToken(token, 'Token validated', 'audit');
   * await myCustomLogger.save(logEntry);
   * ```
   */
  getWithToken(
    token: string,
    message: string,
    level: LogEntry["level"] = "info",
    context?: Record<string, unknown>,
  ): LogEntry {
    return getWithToken(
      token,
      message,
      level,
      context,
      this.applicationContextService,
      () => this.generateCorrelationId(),
      this.maskSensitiveData,
      this.config.clientId,
    );
  }

  /**
   * Get LogEntry object with request context extracted (alias for getLogWithRequest)
   * Alias for getLogWithRequest() for consistency with existing forRequest() pattern
   *
   * @param req - Express Request object
   * @param message - Log message
   * @param level - Optional log level (defaults to 'info')
   * @param context - Optional additional context
   * @returns Complete LogEntry object
   *
   * @example
   * ```typescript
   * const logEntry = client.log.getForRequest(req, 'User action', 'info', { action: 'login' });
   * await myCustomLogger.save(logEntry);
   * ```
   */
  getForRequest(
    req: Request,
    message: string,
    level: LogEntry["level"] = "info",
    context?: Record<string, unknown>,
  ): LogEntry {
    return this.getLogWithRequest(req, message, level, context);
  }

  /**
   * Create logger chain with request context pre-populated
   * Auto-extracts: IP, method, path, user-agent, correlation ID, user from JWT
   *
   * @param req - Express Request object
   * @returns LoggerChain with request context pre-populated
   *
   * @example
   * ```typescript
   * await miso.log.forRequest(req).info("Processing request");
   * ```
   */
  forRequest(req: Request): LoggerChain {
    return new LoggerChain(this, {}, {}).withRequest(req);
  }
}
