/**
 * Logger service for application logging and audit events
 */

import { EventEmitter } from "events";
import { Request } from "express";
import { HttpClient } from "../../utils/http-client";
import { ApiClient } from "../../api";
import { RedisService } from "../redis.service";
import { DataMasker } from "../../utils/data-masker";
import { LogEntry } from "../../types/config.types";
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
  referer?: string;

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
    this.redis = redis;
    this.httpClient = httpClient;
    this.applicationContextService = new ApplicationContextService(httpClient);

    // Initialize audit log queue if batch logging is enabled
    const auditConfig = this.httpClient.config.audit || {};
    if (
      auditConfig.batchSize !== undefined ||
      auditConfig.batchInterval !== undefined
    ) {
      this.auditLogQueue = new AuditLogQueue(
        httpClient,
        redis,
        this.httpClient.config,
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
    const clientPrefix = this.httpClient.config.clientId.substring(0, 10);
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
    if (this.httpClient.config.logLevel === "debug") {
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
    const jwtContext = options?.token
      ? extractJwtContext(options.token)
      : {};
    const metadata = extractEnvironmentMetadata();
    const correlationId =
      options?.correlationId || this.generateCorrelationId();
    const maskedContext = this.maskContext(context, options);
    const appContext = this.applicationContextService.getApplicationContext();
    const logEntry = this.buildLogEntry(
      level,
      message,
      maskedContext,
      stackTrace,
      options,
      jwtContext,
      metadata,
      appContext,
      correlationId,
    );

    if (this.httpClient.config.emitEvents) {
      this.emit("log", logEntry);
      return;
    }

    if (level === "audit" && this.auditLogQueue) {
      await this.auditLogQueue.add(logEntry);
      return;
    }

    if (await this.sendToRedis(logEntry)) {
      return;
    }

    if (this.isCircuitOpen()) {
      return;
    }

    await this.sendToHttp(level, logEntry);
  }

  /**
   * Mask sensitive data in log context if enabled.
   */
  private maskContext(
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions,
  ): Record<string, unknown> | undefined {
    const maskSensitive =
      options?.maskSensitiveData !== false && this.maskSensitiveData;
    if (!maskSensitive || !context) {
      return context;
    }
    return DataMasker.maskSensitiveData(context) as Record<string, unknown>;
  }

  /**
   * Build LogEntry from inputs and context.
   */
  private buildLogEntry(
    level: LogEntry["level"],
    message: string,
    maskedContext: Record<string, unknown> | undefined,
    stackTrace: string | undefined,
    options: ClientLoggingOptions | undefined,
    jwtContext: ReturnType<typeof extractJwtContext>,
    metadata: ReturnType<typeof extractEnvironmentMetadata>,
    appContext: ReturnType<ApplicationContextService["getApplicationContext"]>,
    correlationId: string,
  ): LogEntry {
    const applicationId = this.resolveApplicationId(
      options,
      jwtContext,
      appContext,
    );

    return {
      timestamp: new Date().toISOString(),
      level,
      environment: appContext.environment || "unknown",
      application: appContext.application || this.httpClient.config.clientId,
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
      referer: options?.referer,
      ...metadata,
      sourceKey: options?.sourceKey,
      sourceDisplayName: options?.sourceDisplayName,
      externalSystemKey: options?.externalSystemKey,
      externalSystemDisplayName: options?.externalSystemDisplayName,
      recordKey: options?.recordKey,
      recordDisplayName: options?.recordDisplayName,
      credentialId: options?.credentialId,
      credentialType: options?.credentialType,
      requestSize: options?.requestSize,
      responseSize: options?.responseSize,
      durationMs: options?.durationMs,
      errorCategory: options?.errorCategory,
      httpStatusCategory: options?.httpStatusCategory,
    };
  }

  /**
   * Resolve applicationId from options, app context, or JWT context.
   */
  private resolveApplicationId(
    options: ClientLoggingOptions | undefined,
    jwtContext: ReturnType<typeof extractJwtContext>,
    appContext: ReturnType<ApplicationContextService["getApplicationContext"]>,
  ): string {
    if (options?.applicationId) {
      return options.applicationId;
    }
    if (appContext.applicationId) {
      return appContext.applicationId;
    }
    return jwtContext.applicationId || "";
  }

  /**
   * Attempt to enqueue log entry in Redis.
   */
  private async sendToRedis(logEntry: LogEntry): Promise<boolean> {
    if (!this.redis.isConnected()) {
      return false;
    }
    const queueName = `logs:${this.httpClient.config.clientId}`;
    const success = await this.redis.rpush(
      queueName,
      JSON.stringify(logEntry),
    );
    return Boolean(success);
  }

  /**
   * Check if HTTP logging circuit breaker is open.
   */
  private isCircuitOpen(): boolean {
    const now = Date.now();
    return Boolean(
      this.httpLoggingDisabledUntil && now < this.httpLoggingDisabledUntil,
    );
  }

  /**
   * Map internal log level to API log type/level.
   */
  private mapLogType(level: LogEntry["level"]): {
    logType: "audit" | "error" | "general";
    logLevel: "info" | "error" | "debug";
  } {
    const logType =
      level === "audit" ? "audit" : level === "error" ? "error" : "general";
    const logLevel =
      level === "audit"
        ? "info"
        : level === "error"
          ? "error"
          : level === "info"
            ? "info"
            : "debug";
    return { logType, logLevel };
  }

  /**
   * Build enriched context for API payload.
   */
  private buildEnrichedContext(logEntry: LogEntry): Record<string, unknown> {
    const enrichedContext: Record<string, unknown> = {
      ...logEntry.context,
      userId: logEntry.userId,
      sessionId: logEntry.sessionId,
      requestId: logEntry.requestId,
      ipAddress: logEntry.ipAddress,
      userAgent: logEntry.userAgent,
      referer: logEntry.referer,
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

    Object.keys(enrichedContext).forEach((key) => {
      if (enrichedContext[key] === undefined) {
        delete enrichedContext[key];
      }
    });

    if (logEntry.stackTrace) {
      enrichedContext.stackTrace = logEntry.stackTrace;
    }

    return enrichedContext;
  }

  /**
   * Detect auth-related HTTP errors for circuit breaker logic.
   */
  private isAuthError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    if (error.message.includes("401") || error.message.includes("Unauthorized")) {
      return true;
    }
    return (error as { statusCode?: number }).statusCode === 401;
  }

  /**
   * Send log entry to controller via API client.
   */
  private async sendToHttp(
    level: LogEntry["level"],
    logEntry: LogEntry,
  ): Promise<void> {
    const now = Date.now();
    try {
      if (!this.apiClient) {
        throw new Error(
          "ApiClient not initialized. Call setApiClient() before logging.",
        );
      }

      const { logType, logLevel } = this.mapLogType(level);
      const enrichedContext = this.buildEnrichedContext(logEntry);

      if (level === "audit") {
        const auditAction = enrichedContext.action as string | undefined;
        const auditResource = enrichedContext.resource as string | undefined;
        const providedEntityType = enrichedContext.entityType as string | undefined;
        const providedEntityId = enrichedContext.entityId as string | undefined;
        const providedOldValues = enrichedContext.oldValues as Record<string, unknown> | undefined;
        const providedNewValues = enrichedContext.newValues as Record<string, unknown> | undefined;

        delete enrichedContext.action;
        delete enrichedContext.resource;
        delete enrichedContext.entityType;
        delete enrichedContext.entityId;
        delete enrichedContext.oldValues;
        delete enrichedContext.newValues;

        const entityType =
          providedEntityType ||
          (auditResource && auditResource.startsWith("/api/")
            ? "API Endpoint"
            : "HTTP Request");
        const entityId = providedEntityId || auditResource || "unknown";
        const action = auditAction || "unknown";

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

      this.httpLoggingFailures = 0;
      this.httpLoggingDisabledUntil = null;
    } catch (error) {
      if (!this.isAuthError(error)) {
        this.httpLoggingFailures++;
        if (this.httpLoggingFailures >= LoggerService.MAX_FAILURES) {
          this.httpLoggingDisabledUntil = now + LoggerService.DISABLE_DURATION_MS;
          this.httpLoggingFailures = 0;
        }
      }
    }
  }

  /** Method chaining with context */
  withContext(context: Record<string, unknown>): LoggerChain {
    return new LoggerChain(this, context);
  }

  /** Method chaining with token */
  withToken(token: string): LoggerChain {
    return new LoggerChain(this, {}, { token });
  }

  /** Method chaining without sensitive data masking */
  withoutMasking(): LoggerChain {
    return new LoggerChain(this, {}, { maskSensitiveData: false });
  }

  /** Get LogEntry with request context extracted */
  getLogWithRequest(req: Request, message: string, level: LogEntry["level"] = "info", context?: Record<string, unknown>): LogEntry {
    return getLogWithRequest(req, message, level, context, this.applicationContextService, () => this.generateCorrelationId(), this.maskSensitiveData, this.httpClient.config.clientId);
  }

  /** Get LogEntry with provided context */
  getWithContext(context: Record<string, unknown>, message: string, level: LogEntry["level"] = "info"): LogEntry {
    return getWithContext(context, message, level, this.applicationContextService, () => this.generateCorrelationId(), this.maskSensitiveData, this.httpClient.config.clientId);
  }

  /** Get LogEntry with token context extracted */
  getWithToken(token: string, message: string, level: LogEntry["level"] = "info", context?: Record<string, unknown>): LogEntry {
    return getWithToken(token, message, level, context, this.applicationContextService, () => this.generateCorrelationId(), this.maskSensitiveData, this.httpClient.config.clientId);
  }

  /** Get LogEntry with request context (alias) */
  getForRequest(req: Request, message: string, level: LogEntry["level"] = "info", context?: Record<string, unknown>): LogEntry {
    return this.getLogWithRequest(req, message, level, context);
  }

  /** Create logger chain with request context pre-populated */
  forRequest(req: Request): LoggerChain {
    return new LoggerChain(this, {}, {}).withRequest(req);
  }
}
