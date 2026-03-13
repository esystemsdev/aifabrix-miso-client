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
import { LoggerContextStorage } from "./logger-context-storage";
import {
  extractJwtContext,
  extractEnvironmentMetadata,
  getLogWithRequest,
  getWithContext,
} from "./logger-context";
import { isAuthError, sendAuditLogPayload } from "./logger-http-utils";
import { shouldLogLevel } from "./log-level-policy";
import {
  buildEnrichedLogContext,
  buildLogEntryFromParams,
  resolveCorrelationId,
} from "./log-entry-builder";

export interface ClientLoggingOptions {
  maskSensitiveData?: boolean;

  // Indexed context fields
  sourceId?: string;
  sourceDisplayName?: string;
  externalSystemId?: string;
  externalSystemDisplayName?: string;
  recordId?: string;
  recordDisplayName?: string;

  // Credential context
  credentialId?: string;
  credentialType?: string;

  // Response metrics
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
  private loggerContextStorage = LoggerContextStorage.getInstance();
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

  setHttpClient(httpClient: HttpClient): void {
    this.httpClient = httpClient;
    this.applicationContextService = new ApplicationContextService(httpClient);
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
    const normalizedAction = action.trim() ? action : "unknown_action";
    const normalizedResource = resource.trim() ? resource : "unknown_resource";
    const auditContext = {
      action: normalizedAction,
      resource: normalizedResource,
      ...context,
    };
    await this.log(
      "audit",
      `Audit: ${normalizedAction} on ${normalizedResource}`,
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
   * Log warning message with enhanced options
   */
  async warn(
    message: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions,
  ): Promise<void> {
    await this.log("warn", message, context, undefined, options);
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
    if (!shouldLogLevel(this.httpClient.config.logLevel, level)) {
      return;
    }

    const loggerContext = this.loggerContextStorage.getContext() || {};
    const jwtContext = loggerContext.token
      ? extractJwtContext(loggerContext.token)
      : {};
    const metadata = extractEnvironmentMetadata();
    const correlationId = resolveCorrelationId(
      context,
      loggerContext.correlationId,
      () => this.generateCorrelationId(),
    );
    const maskedContext = this.maskContext(context, options);
    const appContext = this.applicationContextService.getApplicationContext();
    const logEntry = buildLogEntryFromParams({
      level,
      message,
      maskedContext,
      stackTrace,
      options,
      jwtContext,
      metadata,
      appContext,
      loggerContext,
      correlationId,
      clientId: this.httpClient.config.clientId,
    });

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

  private isCircuitOpen(): boolean {
    const now = Date.now();
    return Boolean(
      this.httpLoggingDisabledUntil && now < this.httpLoggingDisabledUntil,
    );
  }
  private mapLogType(level: LogEntry["level"]): { logType: "audit" | "error" | "general"; logLevel: "info" | "warn" | "error" | "debug" } {
    const logType =
      level === "audit" ? "audit" : level === "error" ? "error" : "general";
    let logLevel: "info" | "warn" | "error" | "debug";
    switch (level) {
      case "audit":
      case "info":
        logLevel = "info";
        break;
      case "warn":
        logLevel = "warn";
        break;
      case "error":
        logLevel = "error";
        break;
      case "debug":
        logLevel = "debug";
        break;
      default:
        logLevel = this.assertNever(level);
    }

    return { logType, logLevel };
  }
  private assertNever(value: never): never {
    throw new Error(`Unhandled log level: ${String(value)}`);
  }
  private async sendToHttp(level: LogEntry["level"], logEntry: LogEntry): Promise<void> {
    const now = Date.now();
    try {
      if (!this.apiClient) {
        throw new Error("ApiClient not initialized. Call setApiClient() before logging.");
      }
      const { logType, logLevel } = this.mapLogType(level);
      const enrichedContext = buildEnrichedLogContext(logEntry);

      if (level === "audit") {
        await sendAuditLogPayload(this.apiClient, logEntry, enrichedContext, logType, logLevel);
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
      if (!isAuthError(error)) {
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
  withoutMasking(): LoggerChain {
    return new LoggerChain(this, {}, { maskSensitiveData: false });
  }
  /** Get LogEntry with request context extracted */
  getLogWithRequest(req: Request, message: string, level: LogEntry["level"] = "info", context?: Record<string, unknown>): LogEntry {
    return getLogWithRequest(req, message, level, context, {
      applicationContextService: this.applicationContextService,
      generateCorrelationId: () => this.generateCorrelationId(),
      maskSensitiveData: this.maskSensitiveData,
      clientId: this.httpClient.config.clientId,
    });
  }
  /** Get LogEntry with provided context */
  getWithContext(context: Record<string, unknown>, message: string, level: LogEntry["level"] = "info"): LogEntry {
    return getWithContext(context, message, level, {
      applicationContextService: this.applicationContextService,
      generateCorrelationId: () => this.generateCorrelationId(),
      maskSensitiveData: this.maskSensitiveData,
      clientId: this.httpClient.config.clientId,
    });
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
