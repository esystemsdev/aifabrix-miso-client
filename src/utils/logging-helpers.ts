/**
 * Logging helper utilities for extracting indexed context fields
 */

/**
 * Interface for objects that have a key and optional display name
 */
export interface HasKey {
  key: string;
  displayName?: string;
}

/**
 * Interface for objects that have an external system reference
 */
export interface HasExternalSystem extends HasKey {
  externalSystem?: HasKey;
}

/**
 * Indexed logging context fields for fast queries
 */
export interface IndexedLoggingContext {
  sourceKey?: string;
  sourceDisplayName?: string;
  externalSystemKey?: string;
  externalSystemDisplayName?: string;
  recordKey?: string;
  recordDisplayName?: string;
}

/**
 * Extract indexed logging context from source, record, and external system objects
 * 
 * @param options - Options object containing source, record, and externalSystem
 * @param options.source - Source object with key, displayName, and optional externalSystem
 * @param options.record - Record object with key and optional displayName
 * @param options.externalSystem - External system object with key and optional displayName
 * @returns IndexedLoggingContext with extracted fields
 * 
 * @example
 * ```typescript
 * const context = extractLoggingContext({
 *   source: { key: 'datasource-1', displayName: 'PostgreSQL DB', externalSystem: { key: 'system-1' } },
 *   record: { key: 'record-123', displayName: 'User Profile' }
 * });
 * // Returns: { sourceKey: 'datasource-1', sourceDisplayName: 'PostgreSQL DB', externalSystemKey: 'system-1', recordKey: 'record-123', recordDisplayName: 'User Profile' }
 * ```
 */
export function extractLoggingContext(options: {
  source?: HasExternalSystem;
  record?: HasKey;
  externalSystem?: HasKey;
}): IndexedLoggingContext {
  const context: IndexedLoggingContext = {};

  // Extract source fields
  if (options.source) {
    context.sourceKey = options.source.key;
    if (options.source.displayName !== undefined) {
      context.sourceDisplayName = options.source.displayName;
    }

    // Extract external system from source if present
    if (options.source.externalSystem) {
      context.externalSystemKey = options.source.externalSystem.key;
      if (options.source.externalSystem.displayName !== undefined) {
        context.externalSystemDisplayName = options.source.externalSystem.displayName;
      }
    }
  }

  // Extract external system directly if provided (overrides source.externalSystem)
  if (options.externalSystem) {
    context.externalSystemKey = options.externalSystem.key;
    if (options.externalSystem.displayName !== undefined) {
      context.externalSystemDisplayName = options.externalSystem.displayName;
    }
  }

  // Extract record fields
  if (options.record) {
    context.recordKey = options.record.key;
    if (options.record.displayName !== undefined) {
      context.recordDisplayName = options.record.displayName;
    }
  }

  return context;
}

