/**
 * Filter utility functions for parsing and building filter queries
 */

import type { FilterOption, FilterQuery, FilterOperator } from "../types/filter.types";
import { FilterBuilder } from "../types/filter.types";

/**
 * Normalize operator aliases to standard operator names.
 * @param op - Operator name (may be alias)
 * @returns Standard operator name
 */
function _normalizeOperator(op: string): FilterOperator {
  const operatorMap: Record<string, FilterOperator> = {
    equals: "eq",
    notEquals: "neq",
    ">": "gt",
    "<": "lt",
    ">=": "gte",
    "<=": "lte",
    equal: "eq",
    notEqual: "neq",
    greaterThan: "gt",
    lessThan: "lt",
    greaterThanOrEqual: "gte",
    lessThanOrEqual: "lte",
  };

  const normalized = operatorMap[op.toLowerCase()] || op;
  return normalized as FilterOperator;
}

/**
 * Validate filter value for specific operators.
 * @param op - Filter operator
 * @param value - Filter value to validate
 * @throws Error if value is invalid for the operator
 */
function _validateFilterValue(
  op: FilterOperator,
  value: unknown,
): void {
  if (op === "in" || op === "nin") {
    if (!Array.isArray(value)) {
      throw new Error(
        `Operator '${op}' requires array value, got ${typeof value}. Example: {"field": {"${op}": ["value1", "value2"]}}`,
      );
    }
  }

  if (op === "isNull" || op === "isNotNull") {
    if (value !== null) {
      throw new Error(
        `Operator '${op}' requires null value, got ${typeof value}. Example: {"field": {"${op}": null}}`,
      );
    }
  }
}

/**
 * Parse JSON filter format into FilterOption array.
 * @param jsonFilter - JSON filter object (e.g., {"status": {"eq": "active"}})
 * @returns Array of parsed filter options
 * @throws Error if filter format is invalid
 */
function _parseJsonFilter(jsonFilter: Record<string, unknown>): FilterOption[] {
  const result: FilterOption[] = [];

  for (const [field, fieldValue] of Object.entries(jsonFilter)) {
    if (!field || typeof field !== "string") {
      throw new Error(
        `Invalid filter format. Field names must be non-empty strings. Got: ${typeof field}`,
      );
    }

    if (typeof fieldValue !== "object" || fieldValue === null || Array.isArray(fieldValue)) {
      throw new Error(
        `Field '${field}' must have operator dictionary, got ${typeof fieldValue}. Expected format: {"${field}": {"op": value}}`,
      );
    }

    const operators = fieldValue as Record<string, unknown>;
    for (const [opStr, value] of Object.entries(operators)) {
      const op = _normalizeOperator(opStr);
      _validateFilterValue(op, value);

      let normalizedValue: string | number | boolean | Array<string | number> | null;
      if (op === "isNull" || op === "isNotNull") {
        normalizedValue = null;
      } else if (Array.isArray(value)) {
        normalizedValue = value as Array<string | number>;
      } else {
        normalizedValue = value as string | number | boolean;
      }

      result.push({
        field,
        op,
        value: normalizedValue,
      });
    }
  }

  return result;
}

/**
 * Parse filter query parameters into structured FilterOption array.
 * Supports JSON format: object, JSON string, or URL-encoded JSON string.
 * 
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Array of parsed filter options
 * @throws Error if filter format is invalid
 * 
 * @example
 * ```typescript
 * // Direct object format
 * parseFilterParams({ filter: { status: { eq: 'active' } } });
 * 
 * // JSON string format
 * parseFilterParams({ filter: '{"status": {"eq": "active"}}' });
 * 
 * // URL-encoded JSON (from query string)
 * parseFilterParams({ filter: '%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%7D' });
 * 
 * // Multiple filters with null checks
 * parseFilterParams({ 
 *   filter: { 
 *     status: { eq: 'active' }, 
 *     deletedAt: { isNull: null },
 *     region: { in: ['eu', 'us'] }
 *   } 
 * });
 * ```
 */
export function parseFilterParams(
  query: Record<string, unknown>,
): FilterOption[] {
  const filterParam = query.filter;

  if (!filterParam) {
    return [];
  }

  try {
    let jsonFilter: Record<string, unknown>;

    if (typeof filterParam === "object" && !Array.isArray(filterParam) && filterParam !== null) {
      jsonFilter = filterParam as Record<string, unknown>;
    } else if (typeof filterParam === "string") {
      try {
        const decoded = decodeURIComponent(filterParam);
        jsonFilter = JSON.parse(decoded);
      } catch {
        jsonFilter = JSON.parse(filterParam);
      }
    } else if (Array.isArray(filterParam)) {
      const result: FilterOption[] = [];
      for (const item of filterParam) {
        if (typeof item === "string") {
          try {
            const decoded = decodeURIComponent(item);
            const parsed = JSON.parse(decoded);
            result.push(..._parseJsonFilter(parsed));
          } catch {
            const parsed = JSON.parse(item);
            result.push(..._parseJsonFilter(parsed));
          }
        } else if (typeof item === "object" && item !== null) {
          result.push(..._parseJsonFilter(item as Record<string, unknown>));
        }
      }
      return result;
    } else {
      throw new Error(
        `Invalid filter format. Expected object or string, got ${typeof filterParam}. Example: {"status": {"eq": "active"}}`,
      );
    }

    if (typeof jsonFilter !== "object" || jsonFilter === null || Array.isArray(jsonFilter)) {
      throw new Error(
        `Invalid filter format. Expected JSON object format: {"field": {"op": value}}. Got: ${typeof jsonFilter}`,
      );
    }

    return _parseJsonFilter(jsonFilter);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(
        `Invalid filter format. Expected JSON format: {"field": {"op": value}}. ${error.message}`,
      );
    }
    throw new Error(
      `Invalid filter format. Expected JSON format: {"field": {"op": value}}. Got: ${typeof filterParam}`,
    );
  }
}

/**
 * Build query string from FilterQuery object using JSON format for filters.
 * 
 * @param options - FilterQuery object with filters, sort, pagination, and field selection
 * @returns Query string with URL-encoded JSON filter format
 * 
 * @example
 * ```typescript
 * buildQueryString({
 *   filters: [
 *     { field: 'status', op: 'eq', value: 'active' },
 *     { field: 'age', op: 'gte', value: 18 }
 *   ],
 *   sort: ['-updated_at'],
 *   page: 1,
 *   pageSize: 25
 * });
 * // Returns: "filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22age%22%3A%7B%22gte%22%3A18%7D%7D&sort=-updated_at&page=1&page_size=25"
 * ```
 */
export function buildQueryString(options: FilterQuery): string {
  const params = new URLSearchParams();

  if (options.filters && options.filters.length > 0) {
    const jsonFilter: Record<string, Record<string, unknown>> = {};
    for (const filter of options.filters) {
      if (!jsonFilter[filter.field]) {
        jsonFilter[filter.field] = {};
      }
      jsonFilter[filter.field][filter.op] = filter.value === null ? null : filter.value;
    }
    const jsonString = JSON.stringify(jsonFilter);
    // URLSearchParams.append() automatically URL-encodes, so don't double-encode
    params.append("filter", jsonString);
  }

  options.sort?.forEach((s) => params.append("sort", s));
  if (options.page) {
    params.append("page", options.page.toString());
  }
  if (options.pageSize) {
    params.append("page_size", options.pageSize.toString());
  }
  if (options.fields && options.fields.length > 0) {
    params.append("fields", options.fields.join(","));
  }

  return params.toString();
}

/**
 * Apply filters locally to an array (used for mocks/tests).
 * Supports all operators including isNull and isNotNull.
 * 
 * @param data - Array of items to filter
 * @param filters - Array of filter options to apply
 * @returns Filtered array
 * 
 * @example
 * ```typescript
 * const items = [
 *   { id: 1, status: 'active', deletedAt: null },
 *   { id: 2, status: 'inactive', deletedAt: '2024-01-01' }
 * ];
 * 
 * applyFilters(items, [
 *   { field: 'status', op: 'eq', value: 'active' },
 *   { field: 'deletedAt', op: 'isNull', value: null }
 * ]);
 * ```
 */
export function applyFilters<T extends Record<string, unknown>>(
  data: T[],
  filters: FilterOption[],
): T[] {
  return data.filter((item) =>
    filters.every((f) => {
      const v = item[f.field];
      const value = f.value;

      if (f.op === "isNull") {
        return v === null || v === undefined;
      }

      if (f.op === "isNotNull") {
        return v !== null && v !== undefined;
      }

      if (Array.isArray(value)) {
        return f.op === "in"
          ? value.includes(v as string | number)
          : !value.includes(v as string | number);
      }

      switch (f.op) {
        case "eq":
          return v === value;
        case "neq":
          return v !== value;
        case "gt":
          return (v as number) > (value as number);
        case "lt":
          return (v as number) < (value as number);
        case "gte":
          return (v as number) >= (value as number);
        case "lte":
          return (v as number) <= (value as number);
        case "contains":
          return String(v).includes(String(value));
        case "like":
          return new RegExp(String(value), "i").test(String(v));
        default:
          return true;
      }
    }),
  );
}

/**
 * Validate JSON filter structure.
 * 
 * @param filter - Filter object to validate
 * @throws Error if filter structure is invalid
 * 
 * @example
 * ```typescript
 * // Valid filter
 * validateJsonFilter({ status: { eq: 'active' } });
 * 
 * // Invalid - throws error
 * validateJsonFilter({ status: 'active' }); // Error: must have operator dictionary
 * ```
 */
export function validateJsonFilter(filter: unknown): void {
  if (typeof filter !== "object" || filter === null || Array.isArray(filter)) {
    throw new Error(
      `Invalid filter format. Expected object, got ${typeof filter}. Example: {"field": {"op": value}}`,
    );
  }

  const jsonFilter = filter as Record<string, unknown>;
  for (const [field, fieldValue] of Object.entries(jsonFilter)) {
    if (!field || typeof field !== "string") {
      throw new Error(
        `Invalid filter format. Field names must be non-empty strings. Got: ${typeof field}`,
      );
    }

    if (typeof fieldValue !== "object" || fieldValue === null || Array.isArray(fieldValue)) {
      throw new Error(
        `Field '${field}' must have operator dictionary, got ${typeof fieldValue}. Expected format: {"${field}": {"op": value}}`,
      );
    }

    const operators = fieldValue as Record<string, unknown>;
    for (const [opStr, value] of Object.entries(operators)) {
      const op = _normalizeOperator(opStr);
      _validateFilterValue(op, value);
    }
  }
}

/**
 * Convert FilterQuery to JSON filter format.
 * Useful for serialization and debugging.
 * 
 * @param filterQuery - FilterQuery object to convert
 * @returns JSON filter object (e.g., {"status": {"eq": "active"}})
 * 
 * @example
 * ```typescript
 * filterQueryToJson({
 *   filters: [
 *     { field: 'status', op: 'eq', value: 'active' },
 *     { field: 'age', op: 'gte', value: 18 }
 *   ]
 * });
 * // Returns: { status: { eq: 'active' }, age: { gte: 18 } }
 * ```
 */
export function filterQueryToJson(filterQuery: FilterQuery): Record<string, Record<string, unknown>> {
  const jsonFilter: Record<string, Record<string, unknown>> = {};

  if (filterQuery.filters) {
    for (const filter of filterQuery.filters) {
      if (!jsonFilter[filter.field]) {
        jsonFilter[filter.field] = {};
      }
      jsonFilter[filter.field][filter.op] = filter.value;
    }
  }

  return jsonFilter;
}

/**
 * Convert JSON filter format to FilterQuery.
 * Convenience wrapper around parseFilterParams().
 * 
 * @param jsonFilter - JSON filter object (e.g., {"status": {"eq": "active"}})
 * @returns FilterQuery object
 * 
 * @example
 * ```typescript
 * jsonToFilterQuery({
 *   status: { eq: 'active' },
 *   age: { gte: 18 },
 *   region: { in: ['eu', 'us'] }
 * });
 * // Returns: {
 * //   filters: [
 * //     { field: 'status', op: 'eq', value: 'active' },
 * //     { field: 'age', op: 'gte', value: 18 },
 * //     { field: 'region', op: 'in', value: ['eu', 'us'] }
 * //   ]
 * // }
 * ```
 */
export function jsonToFilterQuery(
  jsonFilter: Record<string, Record<string, unknown>>,
): FilterQuery {
  const filters = _parseJsonFilter(jsonFilter);
  return { filters };
}

// Re-export FilterBuilder for convenience
export { FilterBuilder };
