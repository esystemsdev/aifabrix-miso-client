/**
 * Method chaining class for fluent logging API
 */

import { Request } from "express";
import { LoggerService, ClientLoggingOptions } from "./logger.service";
import { IndexedLoggingContext } from "../../utils/logging-helpers";
import { extractRequestContext } from "../../utils/request-context";
import { LoggerContextStorage } from "./logger-context-storage";

/**
 * Method chaining class for fluent logging API
 */
export class LoggerChain {
  private logger: LoggerService;
  private context: Record<string, unknown>;
  private options: ClientLoggingOptions;
  private contextStorage = LoggerContextStorage.getInstance();

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
   * Add response metrics for performance logging
   *
   * @param responseSize - Optional response size in bytes
   * @param durationMs - Optional request duration in milliseconds
   * @returns LoggerChain instance for method chaining
   *
   * @example
   * ```typescript
   * await logger
   *   .withResponseMetrics(2048, 150)
   *   .info('Upstream API call completed');
   * ```
   */
  withResponseMetrics(responseSize?: number, durationMs?: number): LoggerChain {
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
    const token = req.headers.authorization?.replace("Bearer ", "");

    // Merge auto-extracted request context into AsyncLocalStorage
    this.contextStorage.mergeContext({
      ipAddress: ctx.ipAddress,
      method: ctx.method,
      path: ctx.path,
      userAgent: ctx.userAgent,
      correlationId: ctx.correlationId,
      referer: ctx.referer,
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      requestId: ctx.requestId,
      requestSize: ctx.requestSize,
      token,
    });

    // Merge into context (additional request info)
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

  /**
   * Log error with optional stack trace.
   * @param message - Error message.
   * @param stackTrace - Optional stack trace.
   */
  async error(message: string, stackTrace?: string): Promise<void> {
    await this.logger.error(message, this.context, stackTrace, this.options);
  }

  /**
   * Log informational message.
   * @param message - Log message.
   */
  async info(message: string): Promise<void> {
    await this.logger.info(message, this.context, this.options);
  }

  /**
   * Log audit event.
   * @param action - Audit action.
   * @param resource - Resource type.
   */
  async audit(action: string, resource: string): Promise<void> {
    await this.logger.audit(action, resource, this.context, this.options);
  }
}
