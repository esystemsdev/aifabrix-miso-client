/**
 * Logger service for application logging and audit events
 */

import { EventEmitter } from "events";
import { Request } from "express";
import { HttpClient } from "../utils/http-client";
import { RedisService } from "./redis.service";
import { DataMasker } from "../utils/data-masker";
import { MisoClientConfig, LogEntry } from "../types/config.types";
import { AuditLogQueue } from "../utils/audit-log-queue";
import { extractRequestContext } from "../utils/request-context";
import { IndexedLoggingContext } from "../utils/logging-helpers";
import jwt from "jsonwebtoken";

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
  private redis: RedisService;
  private config: MisoClientConfig;
  private maskSensitiveData = true; // Default: mask sensitive data
  private correlationCounter = 0;
  private auditLogQueue: AuditLogQueue | null = null;
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
   * Enable or disable sensitive data masking
   */
  setMasking(enabled: boolean): void {
    this.maskSensitiveData = enabled;
  }

  /**
   * Generate unique correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    this.correlationCounter = (this.correlationCounter + 1) % 10000;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    // Use clientId instead of applicationKey
    const clientPrefix = this.config.clientId.substring(0, 10);
    return `${clientPrefix}-${timestamp}-${this.correlationCounter}-${random}`;
  }

  /**
   * Extract JWT token information
   */
  private extractJWTContext(token?: string): {
    userId?: string;
    applicationId?: string;
    sessionId?: string;
    roles?: string[];
    permissions?: string[];
  } {
    if (!token) return {};

    try {
      const decoded = jwt.decode(token) as Record<string, unknown> | null;
      if (!decoded) return {};

      return {
        userId: (decoded.sub || decoded.userId || decoded.user_id) as
          | string
          | undefined,
        applicationId: (decoded.applicationId || decoded.app_id) as
          | string
          | undefined,
        sessionId: (decoded.sessionId || decoded.sid) as string | undefined,
        roles: (decoded.roles ||
          (decoded.realm_access as { roles?: string[] } | undefined)?.roles ||
          []) as string[],
        permissions: (decoded.permissions ||
          (decoded.scope as string | undefined)?.split(" ") ||
          []) as string[],
      };
    } catch (error) {
      // JWT parsing failed, return empty context
      return {};
    }
  }

  /**
   * Extract metadata from environment (browser or Node.js)
   */
  private extractMetadata(): Partial<LogEntry> {
    const metadata: Record<string, unknown> = {};

    // Try to extract browser metadata
    if (typeof globalThis !== "undefined" && "window" in globalThis) {
      const win = globalThis as Record<string, unknown>;
      const navigator = (win.window as Record<string, unknown>)?.navigator as
        | Record<string, unknown>
        | undefined;
      const location = (win.window as Record<string, unknown>)?.location as
        | Record<string, unknown>
        | undefined;

      metadata.userAgent = navigator?.userAgent as string | undefined;
      metadata.hostname = location?.hostname as string | undefined;
    }

    // Try to extract Node.js metadata
    if (typeof process !== "undefined" && process.env) {
      metadata.hostname = process.env["HOSTNAME"] || "unknown";
    }

    return metadata as Partial<LogEntry>;
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
      ? this.extractJWTContext(options.token)
      : {};

    // Extract environment metadata
    const metadata = this.extractMetadata();

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

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      environment: "unknown", // Backend extracts from client credentials
      application: this.config.clientId, // Use clientId as application identifier
      applicationId: options?.applicationId || "", // Optional from options
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

    // Fallback to unified logging endpoint with client credentials
    try {
      // Backend extracts environment and application from client credentials
      await this.httpClient.request("POST", "/api/v1/logs", {
        ...logEntry,
        // Remove fields that backend extracts from credentials
        environment: undefined,
        application: undefined,
      });
      // Success - reset failure counter
      this.httpLoggingFailures = 0;
      this.httpLoggingDisabledUntil = null;
    } catch (error) {
      // Failed to send log to controller
      // Increment failure counter and open circuit breaker after too many failures
      this.httpLoggingFailures++;
      if (this.httpLoggingFailures >= LoggerService.MAX_FAILURES) {
        // Open circuit breaker - disable HTTP logging for a period
        this.httpLoggingDisabledUntil = now + LoggerService.DISABLE_DURATION_MS;
        this.httpLoggingFailures = 0; // Reset counter for next attempt after cooldown
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

/**
 * Method chaining class for fluent logging API
 */
export class LoggerChain {
  private logger: LoggerService;
  private context: Record<string, unknown>;
  private options: ClientLoggingOptions;

  constructor(
    logger: LoggerService,
    context: Record<string, unknown> = {},
    options: ClientLoggingOptions = {},
  ) {
    this.logger = logger;
    this.context = context;
    this.options = options;
  }

  addContext(key: string, value: unknown): LoggerChain {
    this.context[key] = value;
    return this;
  }

  addUser(userId: string): LoggerChain {
    this.options.userId = userId;
    return this;
  }

  addApplication(applicationId: string): LoggerChain {
    this.options.applicationId = applicationId;
    return this;
  }

  addCorrelation(correlationId: string): LoggerChain {
    this.options.correlationId = correlationId;
    return this;
  }

  withToken(token: string): LoggerChain {
    this.options.token = token;
    return this;
  }

  withoutMasking(): LoggerChain {
    this.options.maskSensitiveData = false;
    return this;
  }

  /**
   * Add indexed logging context fields for fast queries
   * 
   * @param context - Indexed logging context with source, external system, and record fields
   * @returns LoggerChain instance for method chaining
   * 
   * @example
   * ```typescript
   * await logger
   *   .withIndexedContext({
   *     sourceKey: 'datasource-1',
   *     sourceDisplayName: 'PostgreSQL DB',
   *     externalSystemKey: 'system-1',
   *     recordKey: 'record-123'
   *   })
   *   .info('Sync completed');
   * ```
   */
  withIndexedContext(context: IndexedLoggingContext): LoggerChain {
    this.options.sourceKey = context.sourceKey;
    this.options.sourceDisplayName = context.sourceDisplayName;
    this.options.externalSystemKey = context.externalSystemKey;
    this.options.externalSystemDisplayName = context.externalSystemDisplayName;
    this.options.recordKey = context.recordKey;
    this.options.recordDisplayName = context.recordDisplayName;
    return this;
  }

  /**
   * Add credential context for audit logging
   * 
   * @param credentialId - Optional credential identifier
   * @param credentialType - Optional credential type (e.g., 'oauth2', 'api-key')
   * @returns LoggerChain instance for method chaining
   * 
   * @example
   * ```typescript
   * await logger
   *   .withCredentialContext('cred-123', 'oauth2')
   *   .info('API call completed');
   * ```
   */
  withCredentialContext(credentialId?: string, credentialType?: string): LoggerChain {
    this.options.credentialId = credentialId;
    this.options.credentialType = credentialType;
    return this;
  }

  /**
   * Add request/response metrics for performance logging
   * 
   * @param requestSize - Optional request size in bytes
   * @param responseSize - Optional response size in bytes
   * @param durationMs - Optional request duration in milliseconds
   * @returns LoggerChain instance for method chaining
   * 
   * @example
   * ```typescript
   * await logger
   *   .withRequestMetrics(1024, 2048, 150)
   *   .info('Upstream API call completed');
   * ```
   */
  withRequestMetrics(requestSize?: number, responseSize?: number, durationMs?: number): LoggerChain {
    this.options.requestSize = requestSize;
    this.options.responseSize = responseSize;
    this.options.durationMs = durationMs;
    return this;
  }

  /**
   * Auto-extract logging context from Express Request
   * Extracts: IP, method, path, user-agent, correlation ID, user from JWT
   *
   * @param req - Express Request object
   * @returns LoggerChain instance for method chaining
   *
   * @example
   * ```typescript
   * await miso.log
   *   .withRequest(req)
   *   .info("Processing request");
   * ```
   */
  withRequest(req: Request): LoggerChain {
    const ctx = extractRequestContext(req);

    // Merge into options (these become top-level LogEntry fields)
    if (ctx.userId) {
      this.options.userId = ctx.userId;
    }
    if (ctx.sessionId) {
      this.options.sessionId = ctx.sessionId;
    }
    if (ctx.correlationId) {
      this.options.correlationId = ctx.correlationId;
    }
    if (ctx.requestId) {
      this.options.requestId = ctx.requestId;
    }
    if (ctx.ipAddress) {
      this.options.ipAddress = ctx.ipAddress;
    }
    if (ctx.userAgent) {
      this.options.userAgent = ctx.userAgent;
    }

    // Merge into context (additional request info, not top-level LogEntry fields)
    if (ctx.method) {
      this.context.method = ctx.method;
    }
    if (ctx.path) {
      this.context.path = ctx.path;
    }
    if (ctx.referer) {
      this.context.referer = ctx.referer;
    }
    if (ctx.requestSize !== undefined) {
      this.context.requestSize = ctx.requestSize;
    }

    return this;
  }

  async error(message: string, stackTrace?: string): Promise<void> {
    await this.logger.error(message, this.context, stackTrace, this.options);
  }

  async info(message: string): Promise<void> {
    await this.logger.info(message, this.context, this.options);
  }

  async audit(action: string, resource: string): Promise<void> {
    await this.logger.audit(action, resource, this.context, this.options);
  }
}
