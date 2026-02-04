/**
 * Filter utility functions for parsing and building filter queries
 */

import type { FilterOption, FilterQuery, FilterOperator } from "../types/filter.types";
import { FilterBuilder } from "../types/filter.types";
import { normalizeOperator, isColonFormat, parseColonFilter } from "./filter-colon.utils";

/**
 * Validate filter value for specific operators.
 * @param op - Filter operator
 * @param value - Filter value to validate
 * @throws Error if value is invalid for the operator
 */
function _validateFilterValue(op: FilterOperator, value: unknown): void {
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
      const op = normalizeOperator(opStr);
      _validateFilterValue(op, value);
      let normalizedValue: string | number | boolean | Array<string | number> | null;
      if (op === "isNull" || op === "isNotNull") {
        normalizedValue = null;
      } else if (Array.isArray(value)) {
        normalizedValue = value as Array<string | number>;
      } else {
        normalizedValue = value as string | number | boolean;
      }
      result.push({ field, op, value: normalizedValue });
    }
  }
  return result;
}

/**
 * Parse filter query parameters into structured FilterOption array.
 * Supports both JSON format and colon format.
 *
 * **JSON format**: object, JSON string, or URL-encoded JSON string
 * **Colon format**: "field:operator:value" (e.g., "status:eq:active", "region:in:eu,us")
 *
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Array of parsed filter options
 * @throws Error if filter format is invalid
 *
 * @example
 * ```typescript
 * // JSON object format
 * parseFilterParams({ filter: { status: { eq: 'active' } } });
 *
 * // Colon format (single filter)
 * parseFilterParams({ filter: 'status:eq:active' });
 *
 * // Colon format (multiple filters as array)
 * parseFilterParams({ filter: ['status:eq:active', 'region:in:eu,us'] });
 * ```
 */
export function parseFilterParams(query: Record<string, unknown>): FilterOption[] {
  const filterParam = query.filter;
  if (!filterParam) {
    return [];
  }

  try {
    if (typeof filterParam === "object" && !Array.isArray(filterParam) && filterParam !== null) {
      return _parseJsonFilter(filterParam as Record<string, unknown>);
    }

    if (typeof filterParam === "string") {
      return parseFilterString(filterParam);
    }

    if (Array.isArray(filterParam)) {
      return parseFilterArray(filterParam);
    }

    throw new Error(
      `Invalid filter format. Expected object, string, or array, got ${typeof filterParam}.`,
    );
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid filter format. ${error.message}`);
    }
    throw new Error(`Invalid filter format. Got: ${typeof filterParam}`);
  }
}

function parseFilterString(filterParam: string): FilterOption[] {
  if (isColonFormat(filterParam)) {
    return [parseColonFilter(filterParam)];
  }

  const parsed = tryParseJsonFilter(filterParam);
  if (parsed !== null) {
    return normalizeJsonFilter(parsed);
  }

  if (filterParam.includes(":")) {
    return [parseColonFilter(filterParam)];
  }

  throw new Error(`Could not parse filter string: "${filterParam}"`);
}

function parseFilterArray(filterParam: unknown[]): FilterOption[] {
  const result: FilterOption[] = [];
  for (const item of filterParam) {
    result.push(...parseFilterItem(item));
  }
  return result;
}

function parseFilterItem(item: unknown): FilterOption[] {
  if (typeof item === "string") {
    return parseFilterString(item);
  }

  if (typeof item === "object" && item !== null) {
    return _parseJsonFilter(item as Record<string, unknown>);
  }

  throw new Error(`Invalid filter item: ${typeof item}`);
}

function tryParseJsonFilter(value: string): unknown | null {
  try {
    return JSON.parse(decodeURIComponent(value));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

function normalizeJsonFilter(parsed: unknown): FilterOption[] {
  if (Array.isArray(parsed)) {
    const result: FilterOption[] = [];
    for (const item of parsed) {
      if (typeof item === "object" && item !== null) {
        result.push(..._parseJsonFilter(item as Record<string, unknown>));
      }
    }
    return result;
  }

  if (typeof parsed === "object" && parsed !== null) {
    return _parseJsonFilter(parsed as Record<string, unknown>);
  }

  throw new Error("Invalid JSON filter format");
}

/**
 * Build query string from FilterQuery object using JSON format for filters.
 * @param options - FilterQuery object with filters, sort, pagination, and field selection
 * @returns Query string with URL-encoded JSON filter format
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
 * @param data - Array of items to filter
 * @param filters - Array of filter options to apply
 * @returns Filtered array
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
        case "ilike":
          return new RegExp(String(value), "i").test(String(v));
        default:
          return true;
      }
    }),
  );
}

/**
 * Validate JSON filter structure.
 * @param filter - Filter object to validate
 * @throws Error if filter structure is invalid
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
      const op = normalizeOperator(opStr);
      _validateFilterValue(op, value);
    }
  }
}

/**
 * Convert FilterQuery to JSON filter format.
 * @param filterQuery - FilterQuery object to convert
 * @returns JSON filter object (e.g., {"status": {"eq": "active"}})
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
 * @param jsonFilter - JSON filter object (e.g., {"status": {"eq": "active"}})
 * @returns FilterQuery object
 */
export function jsonToFilterQuery(
  jsonFilter: Record<string, Record<string, unknown>>,
): FilterQuery {
  const filters = _parseJsonFilter(jsonFilter);
  return { filters };
}

// Re-export FilterBuilder for convenience
export { FilterBuilder };
