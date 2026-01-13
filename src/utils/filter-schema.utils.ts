/**
 * Filter schema utilities for validation and SQL compilation.
 * Provides type-safe filter validation against schemas and PostgreSQL-safe SQL generation.
 */

import type { FilterOption, FilterOperator } from "../types/filter.types";
import type {
  FilterSchema,
  FilterFieldDefinition,
  FilterValidationError,
  FilterValidationResult,
  CompiledFilter,
  FilterErrorCodeType,
} from "../types/filter-schema.types";
import { FilterErrorCode, DefaultOperatorsByType } from "../types/filter-schema.types";

/**
 * Create a structured filter validation error.
 * @param code - Error code from FilterErrorCode
 * @param message - Human-readable error message
 * @param extras - Additional error context (field, operator, value, etc.)
 * @returns FilterValidationError object
 */
export function createFilterError(
  code: FilterErrorCodeType,
  message: string,
  extras?: Partial<Omit<FilterValidationError, "code" | "message">>,
): FilterValidationError {
  return {
    code,
    message,
    ...extras,
  };
}

/**
 * Validate UUID format.
 * @param value - Value to validate
 * @returns True if value is a valid UUID
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validate timestamp format.
 * @param value - Value to validate
 * @returns True if value is a valid timestamp
 */
function isValidTimestamp(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Coerce a value to the appropriate type based on field definition.
 * @param value - Value to coerce
 * @param fieldDef - Field definition with type information
 * @returns Coerced value
 * @throws Error if value cannot be coerced
 */
export function coerceValue(
  value: unknown,
  fieldDef: FilterFieldDefinition,
): unknown {
  if (value === null) return null;
  switch (fieldDef.type) {
    case "number": {
      if (Array.isArray(value)) {
        return value.map((v) => {
          const num = Number(v);
          if (isNaN(num)) {
            throw new Error(`Cannot coerce "${v}" to number`);
          }
          return num;
        });
      }
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Cannot coerce "${value}" to number`);
      }
      return num;
    }

    case "boolean": {
      if (typeof value === "boolean") {
        return value;
      }
      if (value === "true" || value === "1") {
        return true;
      }
      if (value === "false" || value === "0") {
        return false;
      }
      throw new Error(`Cannot coerce "${value}" to boolean`);
    }

    case "timestamp": {
      if (typeof value === "string") {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error(`Cannot coerce "${value}" to timestamp`);
        }
        return date.toISOString();
      }
      return value;
    }

    case "uuid":
    case "string":
    case "enum":
    default:
      return value;
  }
}

/**
 * Validate a single filter against a schema.
 * @param filter - Filter option to validate
 * @param schema - Filter schema to validate against
 * @returns FilterValidationError if invalid, null if valid
 */
export function validateFilter(
  filter: FilterOption,
  schema: FilterSchema,
): FilterValidationError | null {
  const fieldDef = schema.fields[filter.field];

  // Check if field exists in schema
  if (!fieldDef) {
    return createFilterError(
      FilterErrorCode.UNKNOWN_FIELD,
      `Field '${filter.field}' is not allowed for filtering on '${schema.resource}'`,
      { field: filter.field },
    );
  }

  // Check if operator is allowed for this field
  if (!fieldDef.operators.includes(filter.op)) {
    return createFilterError(
      FilterErrorCode.INVALID_OPERATOR,
      `Operator '${filter.op}' is not allowed for field '${filter.field}'`,
      {
        field: filter.field,
        operator: filter.op,
        allowedOperators: fieldDef.operators,
      },
    );
  }

  // Skip value validation for null operators
  if (filter.op === "isNull" || filter.op === "isNotNull") {
    return null;
  }

  // Validate value based on field type
  const valueError = validateFieldValue(filter.value, fieldDef, filter.field, filter.op);
  if (valueError) {
    return valueError;
  }

  return null;
}

/**
 * Validate field value against field definition.
 */
function validateFieldValue(
  value: unknown,
  fieldDef: FilterFieldDefinition,
  fieldName: string,
  op: FilterOperator,
): FilterValidationError | null {
  if (value === null) {
    return null;
  }

  // Validate array for in/nin operators
  if (op === "in" || op === "nin") {
    if (!Array.isArray(value)) {
      return createFilterError(
        FilterErrorCode.INVALID_IN,
        `Operator '${op}' requires an array value for field '${fieldName}'`,
        { field: fieldName, operator: op, value },
      );
    }
    if (value.length === 0) {
      return createFilterError(
        FilterErrorCode.INVALID_IN,
        `Operator '${op}' requires a non-empty array for field '${fieldName}'`,
        { field: fieldName, operator: op, value },
      );
    }
    // Validate each array element
    for (const item of value) {
      const itemError = validateSingleValue(item, fieldDef, fieldName);
      if (itemError) {
        return itemError;
      }
    }
    return null;
  }

  return validateSingleValue(value, fieldDef, fieldName);
}

/**
 * Validate a single value against field definition.
 */
function validateSingleValue(
  value: unknown,
  fieldDef: FilterFieldDefinition,
  fieldName: string,
): FilterValidationError | null {
  switch (fieldDef.type) {
    case "uuid":
      if (typeof value !== "string" || !isValidUUID(value)) {
        return createFilterError(
          FilterErrorCode.INVALID_UUID,
          `Invalid UUID value for field '${fieldName}': ${value}`,
          { field: fieldName, value },
        );
      }
      break;

    case "timestamp":
      if (typeof value !== "string" || !isValidTimestamp(value)) {
        return createFilterError(
          FilterErrorCode.INVALID_DATE,
          `Invalid timestamp value for field '${fieldName}': ${value}`,
          { field: fieldName, value },
        );
      }
      break;

    case "number":
      if (typeof value !== "number" && isNaN(Number(value))) {
        return createFilterError(
          FilterErrorCode.INVALID_TYPE,
          `Expected number for field '${fieldName}', got ${typeof value}`,
          { field: fieldName, value },
        );
      }
      break;

    case "boolean":
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        return createFilterError(
          FilterErrorCode.INVALID_TYPE,
          `Expected boolean for field '${fieldName}', got ${typeof value}`,
          { field: fieldName, value },
        );
      }
      break;

    case "enum":
      if (fieldDef.enumValues && !fieldDef.enumValues.includes(String(value))) {
        return createFilterError(
          FilterErrorCode.INVALID_ENUM,
          `Invalid value '${value}' for field '${fieldName}'. Allowed: ${fieldDef.enumValues.join(", ")}`,
          { field: fieldName, value, allowedValues: fieldDef.enumValues },
        );
      }
      break;
  }

  return null;
}

/**
 * Validate multiple filters against a schema.
 * @param filters - Array of filter options to validate
 * @param schema - Filter schema to validate against
 * @returns FilterValidationResult with valid flag and any errors
 */
export function validateFilters(
  filters: FilterOption[],
  schema: FilterSchema,
): FilterValidationResult {
  const errors: FilterValidationError[] = [];

  for (const filter of filters) {
    const error = validateFilter(filter, schema);
    if (error) {
      errors.push(error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Map filter operator to SQL operator.
 */
function operatorToSql(
  op: FilterOperator,
  column: string,
  paramIndex: number,
): { sql: string; hasParam: boolean } {
  switch (op) {
    case "eq":
      return { sql: `${column} = $${paramIndex}`, hasParam: true };
    case "neq":
      return { sql: `${column} != $${paramIndex}`, hasParam: true };
    case "gt":
      return { sql: `${column} > $${paramIndex}`, hasParam: true };
    case "gte":
      return { sql: `${column} >= $${paramIndex}`, hasParam: true };
    case "lt":
      return { sql: `${column} < $${paramIndex}`, hasParam: true };
    case "lte":
      return { sql: `${column} <= $${paramIndex}`, hasParam: true };
    case "in":
      return { sql: `${column} = ANY($${paramIndex})`, hasParam: true };
    case "nin":
      return { sql: `${column} != ALL($${paramIndex})`, hasParam: true };
    case "like":
      return { sql: `${column} LIKE $${paramIndex}`, hasParam: true };
    case "ilike":
      return { sql: `${column} ILIKE $${paramIndex}`, hasParam: true };
    case "contains":
      return { sql: `${column} ILIKE $${paramIndex}`, hasParam: true };
    case "isNull":
      return { sql: `${column} IS NULL`, hasParam: false };
    case "isNotNull":
      return { sql: `${column} IS NOT NULL`, hasParam: false };
    default:
      return { sql: `${column} = $${paramIndex}`, hasParam: true };
  }
}

/**
 * Compile filters to PostgreSQL-safe parameterized SQL.
 * @param filters - Array of filter options to compile
 * @param schema - Filter schema for column name mapping
 * @param logic - Logic operator to join clauses ("and" or "or"), defaults to "and"
 * @returns CompiledFilter with SQL string and params array
 * @throws Error if a filter references an unknown field
 * 
 * @example
 * ```typescript
 * const schema: FilterSchema = {
 *   resource: "applications",
 *   fields: {
 *     name: { column: "name", type: "string", operators: ["eq", "ilike"] },
 *     status: { column: "status", type: "enum", operators: ["eq", "in"], enumValues: ["active", "disabled"] }
 *   }
 * };
 * 
 * const filters = [
 *   { field: "status", op: "eq", value: "active" },
 *   { field: "name", op: "ilike", value: "%test%" }
 * ];
 * 
 * const result = compileFilter(filters, schema);
 * // result.sql = "status = $1 AND name ILIKE $2"
 * // result.params = ["active", "%test%"]
 * ```
 */
export function compileFilter(
  filters: FilterOption[],
  schema: FilterSchema,
  logic: "and" | "or" = "and",
): CompiledFilter {
  if (filters.length === 0) return { sql: "", params: [] };
  const params: unknown[] = [];
  const clauses: string[] = [];

  for (const filter of filters) {
    const fieldDef = schema.fields[filter.field];
    if (!fieldDef) {
      throw new Error(`Unknown field '${filter.field}' in schema '${schema.resource}'`);
    }

    const column = fieldDef.column;
    let value: unknown = filter.value;

    // Coerce value based on field type
    try {
      value = coerceValue(value, fieldDef);
    } catch {
      // If coercion fails, use original value (validation should catch type errors)
    }

    // Handle contains operator - wrap value with %
    if (filter.op === "contains" && typeof value === "string") {
      value = `%${value}%`;
    }

    const paramIndex = params.length + 1;
    const { sql, hasParam } = operatorToSql(filter.op, column, paramIndex);

    clauses.push(sql);
    if (hasParam) {
      params.push(value);
    }
  }

  const joinOperator = logic === "or" ? " OR " : " AND ";
  return {
    sql: clauses.join(joinOperator),
    params,
  };
}

/**
 * Create a filter schema from field definitions.
 * Convenience function for creating schemas with default operators.
 * @param resource - Resource name
 * @param fields - Partial field definitions (operators will be filled from defaults)
 * @param version - Optional schema version
 * @returns Complete FilterSchema
 */
export function createFilterSchema(
  resource: string,
  fields: Record<string, Omit<FilterFieldDefinition, "operators"> & { operators?: FilterOperator[] }>,
  version?: string,
): FilterSchema {
  const completeFields: Record<string, FilterFieldDefinition> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    completeFields[fieldName] = {
      ...fieldDef,
      operators: fieldDef.operators || DefaultOperatorsByType[fieldDef.type],
    };
  }

  return {
    resource,
    version,
    fields: completeFields,
  };
}

/**
 * Load a filter schema from a JSON object.
 * @param json - JSON object representing a filter schema
 * @returns Parsed FilterSchema
 * @throws Error if schema format is invalid
 */
export function loadFilterSchema(json: unknown): FilterSchema {
  if (typeof json !== "object" || json === null) {
    throw new Error("Invalid filter schema: expected object");
  }

  const obj = json as Record<string, unknown>;

  if (typeof obj.resource !== "string") {
    throw new Error("Invalid filter schema: missing 'resource' field");
  }

  if (typeof obj.fields !== "object" || obj.fields === null) {
    throw new Error("Invalid filter schema: missing 'fields' object");
  }

  const fields = obj.fields as Record<string, unknown>;
  const parsedFields: Record<string, FilterFieldDefinition> = {};

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    if (typeof fieldDef !== "object" || fieldDef === null) {
      throw new Error(`Invalid filter schema: field '${fieldName}' must be an object`);
    }

    const def = fieldDef as Record<string, unknown>;

    if (typeof def.column !== "string") {
      throw new Error(`Invalid filter schema: field '${fieldName}' missing 'column'`);
    }

    if (typeof def.type !== "string") {
      throw new Error(`Invalid filter schema: field '${fieldName}' missing 'type'`);
    }

    if (!Array.isArray(def.operators)) {
      throw new Error(`Invalid filter schema: field '${fieldName}' missing 'operators' array`);
    }

    parsedFields[fieldName] = {
      column: def.column,
      type: def.type as FilterFieldDefinition["type"],
      operators: def.operators as FilterOperator[],
      enumValues: Array.isArray(def.enumValues) ? (def.enumValues as string[]) : undefined,
      nullable: typeof def.nullable === "boolean" ? def.nullable : undefined,
      description: typeof def.description === "string" ? def.description : undefined,
    };
  }

  return {
    resource: obj.resource,
    version: typeof obj.version === "string" ? obj.version : undefined,
    fields: parsedFields,
  };
}
