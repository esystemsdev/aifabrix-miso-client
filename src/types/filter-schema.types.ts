/**
 * Filter schema types for validation and SQL compilation.
 * Provides type-safe filter definitions per resource.
 */

import type { FilterOperator } from "./filter.types";

/**
 * Field data types for filter schema validation.
 */
export type FilterFieldType =
  | "string"
  | "number"
  | "boolean"
  | "uuid"
  | "timestamp"
  | "enum";

/**
 * Definition of a filterable field in a schema.
 */
export interface FilterFieldDefinition {
  /** Actual database column name. */
  column: string;

  /** Field data type for validation and coercion. */
  type: FilterFieldType;

  /** Allowed operators for this field. */
  operators: FilterOperator[];

  /** Allowed values for enum type fields. */
  enumValues?: string[];

  /** Whether the field can be null (enables isNull/isNotNull operators). */
  nullable?: boolean;

  /** Human-readable description of the field. */
  description?: string;
}

/**
 * Schema defining filterable fields for a resource.
 */
export interface FilterSchema {
  /** Resource name (e.g., "applications", "users"). */
  resource: string;

  /** Schema version for compatibility tracking. */
  version?: string;

  /** Field definitions keyed by field name. */
  fields: Record<string, FilterFieldDefinition>;
}

/**
 * Filter validation error following RFC 7807 Problem Details structure.
 */
export interface FilterValidationError {
  /** Error code (e.g., "INVALID_OPERATOR", "UNKNOWN_FIELD"). */
  code: string;

  /** Human-readable error message. */
  message: string;

  /** Field that caused the error. */
  field?: string;

  /** Operator that caused the error. */
  operator?: string;

  /** Value that caused the error. */
  value?: unknown;

  /** List of allowed operators for the field. */
  allowedOperators?: string[];

  /** List of allowed values (for enum fields). */
  allowedValues?: string[];
}

/**
 * Compiled filter result with parameterized SQL.
 */
export interface CompiledFilter {
  /** SQL WHERE clause (e.g., "status = $1 AND region = ANY($2)"). */
  sql: string;

  /** Parameter values for the SQL query in order. */
  params: unknown[];
}

/**
 * Result of filter validation.
 */
export interface FilterValidationResult {
  /** Whether all filters are valid. */
  valid: boolean;

  /** Array of validation errors (empty if valid). */
  errors: FilterValidationError[];
}

/**
 * Error codes for filter validation.
 */
export const FilterErrorCode = {
  /** Field is not defined in the schema. */
  UNKNOWN_FIELD: "UNKNOWN_FIELD",

  /** Operator is not allowed for the field type. */
  INVALID_OPERATOR: "INVALID_OPERATOR",

  /** Value type does not match field type. */
  INVALID_TYPE: "INVALID_TYPE",

  /** Value is not a valid UUID. */
  INVALID_UUID: "INVALID_UUID",

  /** Value is not a valid timestamp/date. */
  INVALID_DATE: "INVALID_DATE",

  /** Value is not in the allowed enum values. */
  INVALID_ENUM: "INVALID_ENUM",

  /** 'in' or 'nin' operator requires a non-empty array. */
  INVALID_IN: "INVALID_IN",

  /** Filter format parsing failed. */
  INVALID_FORMAT: "INVALID_FORMAT",
} as const;

/**
 * Type for filter error codes.
 */
export type FilterErrorCodeType = (typeof FilterErrorCode)[keyof typeof FilterErrorCode];

/**
 * Default operators allowed per field type.
 */
export const DefaultOperatorsByType: Record<FilterFieldType, FilterOperator[]> = {
  string: ["eq", "neq", "in", "nin", "contains", "like", "ilike"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin"],
  boolean: ["eq"],
  uuid: ["eq", "in"],
  timestamp: ["eq", "gt", "gte", "lt", "lte"],
  enum: ["eq", "in"],
};
