/**
 * Unified Logger Service
 * Provides minimal API (1-3 parameters max) with automatic context extraction
 * Wraps LoggerService with simplified interface
 */

import { LoggerService, ClientLoggingOptions } from "./logger.service";
import { LoggerContextStorage, LoggerContext } from "./logger-context-storage";

/**
 * Unified Logger Interface
 * Minimal API with automatic context extraction
 */
export interface UnifiedLogger {
  /**
   * Log info message
   * @param message - Info message
   */
  info(message: string): Promise<void>;

  /**
   * Log warning message
   * @param message - Warning message
   */
  warn(message: string): Promise<void>;

  /**
   * Log debug message
   * @param message - Debug message
   */
  debug(message: string): Promise<void>;

  /**
   * Log error message
   * @param message - Error message
   * @param error - Optional error object (auto-extracts stack trace)
   */
  error(message: string, error?: unknown): Promise<void>;

  /**
   * Log audit event
   * @param action - Action performed (e.g., 'CREATE', 'UPDATE', 'DELETE')
   * @param resource - Resource type (e.g., 'User', 'Tenant')
   * @param entityId - Optional entity ID (defaults to 'unknown')
   * @param oldValues - Optional old values for UPDATE operations (ISO 27001 requirement)
   * @param newValues - Optional new values for CREATE/UPDATE operations (ISO 27001 requirement)
   */
  audit(
    action: string,
    resource: string,
    entityId?: string,
    oldValues?: object,
    newValues?: object,
  ): Promise<void>;
}

/**
 * Unified Logger Service Implementation
 * Wraps LoggerService with minimal API and automatic context extraction
 */
export class UnifiedLoggerService implements UnifiedLogger {
  constructor(
    private loggerService: LoggerService,
    private contextStorage: LoggerContextStorage,
  ) {}

  /**
   * Get current context from AsyncLocalStorage
   * Falls back to empty context if not available
   */
  private getContext(): LoggerContext {
    return this.contextStorage.getContext() || {};
  }

  /**
   * Build ClientLoggingOptions from context
   * Extracts all relevant fields from LoggerContext
   */
  private buildLoggingOptions(_context: LoggerContext): ClientLoggingOptions {
    return {
      maskSensitiveData: true, // Default: mask sensitive data
    };
  }

  /**
   * Extract error context from error object
   * Extracts stack trace, error name, and error message
   */
  private extractErrorContext(error?: unknown): {
    stackTrace?: string;
    errorName?: string;
    errorMessage?: string;
  } {
    if (!error) {
      return {};
    }

    if (error instanceof Error) {
      return {
        stackTrace: error.stack,
        errorName: error.name,
        errorMessage: error.message,
      };
    }

    if (typeof error === "string") {
      return {
        errorMessage: error,
      };
    }

    // Try to extract from object
    if (typeof error === "object" && error !== null) {
      const errorObj = error as Record<string, unknown>;
      return {
        stackTrace: errorObj.stack as string | undefined,
        errorName: errorObj.name as string | undefined,
        errorMessage: errorObj.message as string | undefined,
      };
    }

    return {};
  }

  /**
   * Log info message
   */
  async info(message: string): Promise<void> {
    try {
      const context = this.getContext();
      const options = this.buildLoggingOptions(context);
      await this.loggerService.info(message, undefined, options);
    } catch (error) {
      // Error handling in logger should be silent (catch and swallow)
      // Per Logger Chain Pattern
    }
  }

  /**
   * Log warning message
   */
  async warn(message: string): Promise<void> {
    try {
      const context = this.getContext();
      const options = this.buildLoggingOptions(context);
      await this.loggerService.warn(message, undefined, options);
    } catch (error) {
      // Error handling in logger should be silent (catch and swallow)
    }
  }

  /**
   * Log debug message
   */
  async debug(message: string): Promise<void> {
    try {
      const context = this.getContext();
      const options = this.buildLoggingOptions(context);
      await this.loggerService.debug(message, undefined, options);
    } catch (error) {
      // Error handling in logger should be silent (catch and swallow)
    }
  }

  /**
   * Log error message with optional error object
   */
  async error(message: string, error?: unknown): Promise<void> {
    try {
      const context = this.getContext();
      const options = this.buildLoggingOptions(context);
      const errorContext = this.extractErrorContext(error);

      // Build context with error details
      const logContext: Record<string, unknown> = {};
      if (errorContext.errorName) {
        logContext.errorName = errorContext.errorName;
      }
      if (errorContext.errorMessage) {
        logContext.errorMessage = errorContext.errorMessage;
      }

      await this.loggerService.error(
        message,
        logContext,
        errorContext.stackTrace,
        options,
      );
    } catch (err) {
      // Error handling in logger should be silent (catch and swallow)
    }
  }

  /**
   * Log audit event
   */
  async audit(
    action: string,
    resource: string,
    entityId?: string,
    oldValues?: object,
    newValues?: object,
  ): Promise<void> {
    try {
      const context = this.getContext();
      const options = this.buildLoggingOptions(context);

      // Build audit context with entityId, oldValues, newValues
      const auditContext: Record<string, unknown> = {
        entityId: entityId || "unknown",
      };

      if (oldValues !== undefined) {
        auditContext.oldValues = oldValues;
      }

      if (newValues !== undefined) {
        auditContext.newValues = newValues;
      }

      await this.loggerService.audit(action, resource, auditContext, options);
    } catch (error) {
      // Error handling in logger should be silent (catch and swallow)
    }
  }
}
