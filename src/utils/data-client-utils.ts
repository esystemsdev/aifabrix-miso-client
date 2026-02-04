/**
 * DataClient utility functions
 * Browser environment utilities and helper functions
 */

import { ApiRequestOptions } from "../types/data-client.types";
import jwt from "jsonwebtoken";

/**
 * Check if running in browser environment
 */
export function isBrowser(): boolean {
  return (
    typeof (globalThis as { window?: unknown }).window !== "undefined" &&
    typeof (globalThis as { localStorage?: unknown }).localStorage !== "undefined" &&
    typeof (globalThis as { fetch?: unknown }).fetch !== "undefined"
  );
}

/**
 * Get value from localStorage (browser only)
 */
export function getLocalStorage(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    return (globalThis as unknown as { localStorage: { getItem: (key: string) => string | null } }).localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Set value in localStorage (browser only)
 */
export function setLocalStorage(key: string, value: string): void {
  if (!isBrowser()) return;
  try {
    (globalThis as unknown as { localStorage: { setItem: (key: string, value: string) => void } }).localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage errors (SSR, private browsing, etc.)
  }
}

/**
 * Remove value from localStorage (browser only)
 */
export function removeLocalStorage(key: string): void {
  if (!isBrowser()) return;
  try {
    (globalThis as unknown as { localStorage: { removeItem: (key: string) => void } }).localStorage.removeItem(key);
  } catch {
    // Ignore localStorage errors (SSR, private browsing, etc.)
  }
}

/**
 * Extract userId from JWT token.
 * Checks fields in order: sub, userId, user_id, id.
 */
export function extractUserIdFromToken(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return null;
    return (decoded.sub || decoded.userId || decoded.user_id || decoded.id) as
      | string
      | null;
  } catch {
    return null;
  }
}

/**
 * Calculate cache key from endpoint and options
 */
export function generateCacheKey(endpoint: string, options?: ApiRequestOptions): string {
  const method = options?.method || "GET";
  const body = options?.body ? JSON.stringify(options.body) : "";
  return `data-client:${method}:${endpoint}:${body}`;
}

/**
 * Truncate large payloads before masking (performance optimization)
 */
export function truncatePayload(
  data: unknown,
  maxSize: number,
): { data: unknown; truncated: boolean } {
  const json = JSON.stringify(data);
  if (json.length <= maxSize) {
    return { data, truncated: false };
  }
  return {
    data: { _message: "Payload truncated for performance", _size: json.length },
    truncated: true,
  };
}

/**
 * Calculate request/response sizes
 */
export function calculateSize(data: unknown): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(statusCode?: number, _error?: Error): boolean {
  if (!statusCode) return true; // Network errors are retryable
  if (statusCode >= 500) return true; // Server errors
  if (statusCode === 408) return true; // Timeout
  if (statusCode === 429) return true; // Rate limit
  if (statusCode === 401 || statusCode === 403) return false; // Auth errors
  if (statusCode >= 400 && statusCode < 500) return false; // Client errors
  return false;
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
}

