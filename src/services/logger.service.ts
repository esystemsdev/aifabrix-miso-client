/**
 * Logger service for application logging and audit events
 */

import { HttpClient } from '../utils/http-client';
import { RedisService } from './redis.service';
import { DataMasker } from '../utils/data-masker';
import { MisoClientConfig, LogEntry } from '../types/config.types';
import jwt from 'jsonwebtoken';

export interface ClientLoggingOptions {
  applicationId?: string;
  userId?: string;
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  token?: string; // JWT token for context extraction
  maskSensitiveData?: boolean;
  performanceMetrics?: boolean;
}

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

export class LoggerService {
  private httpClient: HttpClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private maskSensitiveData = true; // Default: mask sensitive data
  private correlationCounter = 0;
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  constructor(config: MisoClientConfig, redis: RedisService) {
    this.config = config;
    this.redis = redis;
    this.httpClient = new HttpClient(config);
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
    return `${this.config.applicationKey}-${timestamp}-${this.correlationCounter}-${random}`;
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
        userId: (decoded.sub || decoded.userId || decoded.user_id) as string | undefined,
        applicationId: (decoded.applicationId || decoded.app_id) as string | undefined,
        sessionId: (decoded.sessionId || decoded.sid) as string | undefined,
        roles: (decoded.roles || (decoded.realm_access as { roles?: string[] } | undefined)?.roles || []) as string[],
        permissions: (decoded.permissions || (decoded.scope as string | undefined)?.split(' ') || []) as string[]
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
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      const win = globalThis as Record<string, unknown>;
      const navigator = (win.window as Record<string, unknown>)?.navigator as Record<string, unknown> | undefined;
      const location = (win.window as Record<string, unknown>)?.location as Record<string, unknown> | undefined;
      
      metadata.userAgent = navigator?.userAgent as string | undefined;
      metadata.hostname = location?.hostname as string | undefined;
    }

    // Try to extract Node.js metadata
    if (typeof process !== 'undefined' && process.env) {
      metadata.hostname = process.env['HOSTNAME'] || 'unknown';
    }

    return metadata as Partial<LogEntry>;
  }

  /**
   * Start performance tracking
   */
  startPerformanceTracking(operationId: string): void {
    this.performanceMetrics.set(operationId, {
      startTime: Date.now(),
      memoryUsage: typeof process !== 'undefined' ? process.memoryUsage() : undefined
    });
  }

  /**
   * End performance tracking and get metrics
   */
  endPerformanceTracking(operationId: string): PerformanceMetrics | null {
    const metrics = this.performanceMetrics.get(operationId);
    if (!metrics) return null;

    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    if (typeof process !== 'undefined') {
      metrics.memoryUsage = process.memoryUsage();
    }

    this.performanceMetrics.delete(operationId);
    return metrics;
  }

  /**
   * Log error message with optional stack trace and enhanced options
   */
  async error(
    message: string,
    context?: Record<string, unknown>,
    stackTrace?: string,
    options?: ClientLoggingOptions
  ): Promise<void> {
    await this.log('error', message, context, stackTrace, options);
  }

  /**
   * Log audit event with enhanced options
   */
  async audit(
    action: string,
    resource: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions
  ): Promise<void> {
    const auditContext = {
      action,
      resource,
      ...context
    };
    await this.log('audit', `Audit: ${action} on ${resource}`, auditContext, undefined, options);
  }

  /**
   * Log info message with enhanced options
   */
  async info(
    message: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions
  ): Promise<void> {
    await this.log('info', message, context, undefined, options);
  }

  /**
   * Log debug message with enhanced options
   */
  async debug(
    message: string,
    context?: Record<string, unknown>,
    options?: ClientLoggingOptions
  ): Promise<void> {
    if (this.config.logLevel === 'debug') {
      await this.log('debug', message, context, undefined, options);
    }
  }

  /**
   * Internal log method with enhanced features
   */
  private async log(
    level: LogEntry['level'],
    message: string,
    context?: Record<string, unknown>,
    stackTrace?: string,
    options?: ClientLoggingOptions
  ): Promise<void> {
    // Extract JWT context if token provided
    const jwtContext = options?.token ? this.extractJWTContext(options.token) : {};

    // Extract environment metadata
    const metadata = this.extractMetadata();

    // Generate correlation ID if not provided
    const correlationId = options?.correlationId || this.generateCorrelationId();

    // Mask sensitive data in context if enabled
    const maskSensitive = options?.maskSensitiveData !== false && this.maskSensitiveData;
    const maskedContext =
      maskSensitive && context
        ? (DataMasker.maskSensitiveData(context) as Record<string, unknown>)
        : context;

    // Add performance metrics if requested
    let enhancedContext = maskedContext;
    if (options?.performanceMetrics && typeof process !== 'undefined') {
      enhancedContext = {
        ...enhancedContext,
        performance: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      environment: this.config.environment,
      application: this.config.applicationKey,
      applicationId: this.config.applicationId,
      message,
      context: enhancedContext,
      stackTrace,
      correlationId,
      userId: options?.userId || jwtContext.userId,
      sessionId: options?.sessionId || jwtContext.sessionId,
      requestId: options?.requestId,
      ...metadata
    };

    // Try Redis first (if available)
    if (this.redis.isConnected()) {
      const queueName = `logs:${this.config.environment}:${this.config.applicationKey}`;
      const success = await this.redis.rpush(queueName, JSON.stringify(logEntry));

      if (success) {
        return; // Successfully queued in Redis
      }
    }

    // Fallback to HTTP endpoint with API key
    try {
      const headers: Record<string, string> = {};
      if (this.config.apiKey) {
        headers['x-api-key'] = this.config.apiKey;
      }

      await this.httpClient.post('/logs', logEntry, { headers });
    } catch (error) {
      // Failed to send log to controller
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

  withPerformance(): LoggerChain {
    return new LoggerChain(this, {}, { performanceMetrics: true });
  }

  withoutMasking(): LoggerChain {
    return new LoggerChain(this, {}, { maskSensitiveData: false });
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
    options: ClientLoggingOptions = {}
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

  withPerformance(): LoggerChain {
    this.options.performanceMetrics = true;
    return this;
  }

  withoutMasking(): LoggerChain {
    this.options.maskSensitiveData = false;
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
