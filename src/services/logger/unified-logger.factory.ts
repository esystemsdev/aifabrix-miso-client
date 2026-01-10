/**
 * Unified Logger Factory
 * Provides factory function to get UnifiedLogger instance with automatic context detection
 */

import { LoggerService } from "./logger.service";
import { UnifiedLoggerService, UnifiedLogger } from "./unified-logger.service";
import { LoggerContextStorage, LoggerContext } from "./logger-context-storage";

/**
 * Global registry for LoggerService instance
 * Allows factory function to access LoggerService without requiring MisoClient parameter
 */
class LoggerServiceRegistry {
  private static instance: LoggerService | null = null;

  /**
   * Register LoggerService instance
   * Should be called during MisoClient initialization
   * @param loggerService - LoggerService instance to register
   */
  static register(loggerService: LoggerService): void {
    LoggerServiceRegistry.instance = loggerService;
  }

  /**
   * Get registered LoggerService instance
   * @returns LoggerService instance or null if not registered
   */
  static get(): LoggerService | null {
    return LoggerServiceRegistry.instance;
  }

  /**
   * Clear registered LoggerService instance
   */
  static clear(): void {
    LoggerServiceRegistry.instance = null;
  }
}

/**
 * Get logger instance with automatic context detection from AsyncLocalStorage
 * Returns UnifiedLogger instance that automatically extracts context
 *
 * @param loggerService - Optional LoggerService instance (if not provided, uses registered instance)
 * @returns UnifiedLogger instance
 *
 * @example
 * ```typescript
 * const logger = getLogger();
 * await logger.info('Message'); // Auto-extracts context from AsyncLocalStorage
 * ```
 */
export function getLogger(loggerService?: LoggerService): UnifiedLogger {
  const contextStorage = LoggerContextStorage.getInstance();

  // Use provided loggerService or get from registry
  const service = loggerService || LoggerServiceRegistry.get();

  if (!service) {
    // If no LoggerService available, throw error with helpful message
    throw new Error(
      "LoggerService not available. Either pass LoggerService to getLogger() or ensure MisoClient is initialized.",
    );
  }

  return new UnifiedLoggerService(service, contextStorage);
}

/**
 * Set logger context for current async execution context
 * Context is automatically available to all code in the same async context
 *
 * @param context - Context to set (partial, will be merged with existing)
 *
 * @example
 * ```typescript
 * setLoggerContext({
 *   userId: 'user-123',
 *   correlationId: 'req-456',
 *   ipAddress: '192.168.1.1',
 * });
 * ```
 */
export function setLoggerContext(context: Partial<LoggerContext>): void {
  const contextStorage = LoggerContextStorage.getInstance();
  contextStorage.setContext(context);
}

/**
 * Clear logger context for current async execution context
 *
 * @example
 * ```typescript
 * clearLoggerContext();
 * ```
 */
export function clearLoggerContext(): void {
  const contextStorage = LoggerContextStorage.getInstance();
  contextStorage.clearContext();
}

/**
 * Merge additional fields into existing logger context
 *
 * @param additional - Additional context fields to merge
 *
 * @example
 * ```typescript
 * mergeLoggerContext({ userId: 'user-123' });
 * ```
 */
export function mergeLoggerContext(additional: Partial<LoggerContext>): void {
  const contextStorage = LoggerContextStorage.getInstance();
  contextStorage.mergeContext(additional);
}

/**
 * Register LoggerService instance for global access
 * Called automatically by MisoClient during initialization
 * @param loggerService - LoggerService instance to register
 */
export function registerLoggerService(loggerService: LoggerService): void {
  LoggerServiceRegistry.register(loggerService);
}

// Export registry for testing purposes
export { LoggerServiceRegistry };
