/**
 * Audit log queue for batching multiple logs into single requests
 * Reduces network overhead by batching audit logs
 */

import { EventEmitter } from "events";
import { LogEntry, MisoClientConfig } from "../types/config.types";
import { HttpClient } from "./http-client";
import { ApiClient } from "../api";
import { RedisService } from "../services/redis.service";

interface QueuedLogEntry {
  entry: LogEntry;
  timestamp: number;
}

export class AuditLogQueue {
  private queue: QueuedLogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private httpClient: HttpClient;
  private apiClient?: ApiClient;
  private redis: RedisService;
  private config: MisoClientConfig;
  private batchSize: number;
  private batchInterval: number;
  private isFlushing = false;
  private eventEmitter?: EventEmitter;
  // Circuit breaker for HTTP logging - skip attempts after repeated failures
  private httpLoggingFailures = 0;
  private httpLoggingDisabledUntil: number | null = null;
  private static readonly MAX_FAILURES = 3;
  private static readonly DISABLE_DURATION_MS = 60000; // 1 minute

  constructor(
    httpClient: HttpClient,
    redis: RedisService,
    config: MisoClientConfig,
    eventEmitter?: EventEmitter,
  ) {
    this.httpClient = httpClient;
    this.redis = redis;
    this.config = config;
    this.eventEmitter = eventEmitter;
    const auditConfig = config.audit || {};
    this.batchSize = auditConfig.batchSize ?? 10;
    this.batchInterval = auditConfig.batchInterval ?? 100;

    // Setup graceful shutdown handler (Node.js only)
    if (typeof process !== "undefined") {
      process.on("SIGINT", () => this.flush(true));
      process.on("SIGTERM", () => this.flush(true));
      process.on("beforeExit", () => this.flush(true));
    }
  }

  /**
   * Set ApiClient instance (used to resolve circular dependency)
   * @param apiClient - ApiClient instance
   */
  setApiClient(apiClient: ApiClient): void {
    this.apiClient = apiClient;
  }

  /**
   * Add log entry to queue
   * Automatically flushes if batch size is reached
   */
  async add(entry: LogEntry): Promise<void> {
    this.queue.push({
      entry,
      timestamp: Date.now(),
    });

    // Flush if batch size reached
    if (this.queue.length >= this.batchSize) {
      await this.flush(false);
      return;
    }

    // Setup flush timer if not already set
    if (!this.flushTimer && this.queue.length > 0) {
      this.flushTimer = setTimeout(() => {
        this.flush(false).catch(() => {
          // Silently swallow flush errors
        });
      }, this.batchInterval);
      if (this.flushTimer && typeof this.flushTimer.unref === "function") {
        this.flushTimer.unref();
      }
    }
  }

  /**
   * Flush queued logs
   * @param _sync - Reserved for future use (wait for flush to complete for shutdown)
   */
  async flush(_sync: boolean = false): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    // Clear flush timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    try {
      const entries = this.queue.splice(0); // Clear queue

      if (entries.length === 0) {
        this.isFlushing = false;
        return;
      }

      const logEntries = entries.map((e) => e.entry);

      // If emitEvents is enabled, emit batch event and skip HTTP/Redis
      if (this.config.emitEvents && this.eventEmitter) {
        // Emit batch event - same payload structure as REST API
        this.eventEmitter.emit("log:batch", logEntries);
        this.isFlushing = false;
        return;
      }

      // Try Redis first (if available)
      if (this.redis.isConnected()) {
        const queueName = `audit-logs:${this.config.clientId}`;
        const success = await this.redis.rpush(
          queueName,
          JSON.stringify(logEntries),
        );

        if (success) {
          this.isFlushing = false;
          return; // Successfully queued in Redis
        }
      }

      // Check circuit breaker - skip HTTP logging if we've had too many failures
      const now = Date.now();
      if (this.httpLoggingDisabledUntil && now < this.httpLoggingDisabledUntil) {
        // Circuit breaker is open - skip HTTP logging attempt
        return;
      }

      // Fallback to HTTP batch endpoint
      try {
        // Use ApiClient if available, otherwise fallback to HttpClient
        if (this.apiClient) {
          await this.apiClient.logs.createBatchLogs({
            logs: logEntries.map((e) => ({
              ...e,
              // Remove fields that backend extracts from credentials
              environment: undefined,
              application: undefined,
            })),
          });
        } else {
          // Fallback to HttpClient (shouldn't happen after initialization)
          await this.httpClient.request("POST", "/api/v1/logs/batch", {
            logs: logEntries.map((e) => ({
              ...e,
              // Remove fields that backend extracts from credentials
              environment: undefined,
              application: undefined,
            })),
          });
        }
        // Success - reset failure counter
        this.httpLoggingFailures = 0;
        this.httpLoggingDisabledUntil = null;
      } catch (error) {
        // Failed to send logs - increment failure counter and open circuit breaker
        this.httpLoggingFailures++;
        if (this.httpLoggingFailures >= AuditLogQueue.MAX_FAILURES) {
          // Open circuit breaker - disable HTTP logging for a period
          this.httpLoggingDisabledUntil = now + AuditLogQueue.DISABLE_DURATION_MS;
          this.httpLoggingFailures = 0; // Reset counter for next attempt after cooldown
        }
        // Silently fail to avoid infinite loops
      }
    } catch (error) {
      // Silently swallow errors - never break logging
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear queue (for testing/cleanup)
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.queue = [];
  }
}
