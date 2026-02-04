/**
 * Logger context storage using AsyncLocalStorage
 * Provides thread-safe context storage per async execution context
 * Context is automatically isolated per async execution context
 */

import { AsyncLocalStorage } from "async_hooks";

/**
 * Logger context interface
 * Contains all fields that can be automatically extracted from requests or manually set
 */
export interface LoggerContext {
  ipAddress?: string;
  userAgent?: string;
  referer?: string;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  method?: string;
  path?: string;
  hostname?: string;
  applicationId?: string;
  requestId?: string;
  requestSize?: number;
  token?: string; // JWT token for extraction
}

/**
 * Logger context storage singleton
 * Uses AsyncLocalStorage to store context per async execution context
 */
class LoggerContextStorage {
  private static instance: LoggerContextStorage | null = null;
  private readonly asyncLocalStorage: AsyncLocalStorage<LoggerContext>;

  private constructor() {
    this.asyncLocalStorage = new AsyncLocalStorage<LoggerContext>();
  }

  /**
   * Get singleton instance
   * @returns LoggerContextStorage instance
   */
  static getInstance(): LoggerContextStorage {
    if (!LoggerContextStorage.instance) {
      LoggerContextStorage.instance = new LoggerContextStorage();
    }
    return LoggerContextStorage.instance;
  }

  /**
   * Get current context from AsyncLocalStorage
   * @returns Current context or null if not set
   */
  getContext(): LoggerContext | null {
    const store = this.asyncLocalStorage.getStore();
    if (store === undefined) {
      return null;
    }
    return store;
  }

  /**
   * Set context for current async execution context
   * @param context - Context to set (partial, will be merged with existing)
   */
  setContext(context: Partial<LoggerContext>): void {
    const current = this.asyncLocalStorage.getStore() || {};
    this.asyncLocalStorage.enterWith({ ...current, ...context });
  }

  /**
   * Clear context for current async execution context
   */
  clearContext(): void {
    this.asyncLocalStorage.enterWith({});
  }

  /**
   * Merge additional fields into existing context
   * @param additional - Additional context fields to merge
   */
  mergeContext(additional: Partial<LoggerContext>): void {
    const current = this.asyncLocalStorage.getStore() || {};
    this.asyncLocalStorage.enterWith({ ...current, ...additional });
  }

  /**
   * Run function with context set
   * Useful for setting context at the start of an async operation
   * @param context - Context to set
   * @param fn - Function to run with context
   * @returns Result of function execution
   */
  runWithContext<T>(context: Partial<LoggerContext>, fn: () => T): T {
    const merged = { ...(this.asyncLocalStorage.getStore() || {}), ...context };
    return this.asyncLocalStorage.run(merged, fn);
  }

  /**
   * Run async function with context set
   * Useful for setting context at the start of an async operation
   * @param context - Context to set
   * @param fn - Async function to run with context
   * @returns Promise resolving to result of function execution
   */
  async runWithContextAsync<T>(
    context: Partial<LoggerContext>,
    fn: () => Promise<T>,
  ): Promise<T> {
    const merged = { ...(this.asyncLocalStorage.getStore() || {}), ...context };
    return this.asyncLocalStorage.run(merged, fn);
  }
}

export { LoggerContextStorage };
