/**
 * Colon format filter parsing utilities (internal).
 * Format: field:operator:value (e.g., "status:eq:active", "region:in:eu,us")
 */

import type { FilterOption, FilterOperator } from "../types/filter.types";

/**
 * Normalize operator aliases to standard operator names.
 * @param op - Operator name (may be alias)
 * @returns Standard operator name
 */
export function normalizeOperator(op: string): FilterOperator {
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
 * Check if a string is in colon format (field:op:value).
 * @param str - String to check
 * @returns True if string is in colon format
 */
export function isColonFormat(str: string): boolean {
  if (!str || !str.includes(":")) {
    return false;
  }
  const trimmed = str.trim();
  // JSON format starts with { or [, colon format doesn't
  return !trimmed.startsWith("{") && !trimmed.startsWith("[");
}

function parseColonFilterParts(filterStr: string): { field: string; opStr: string; valueStr: string } {
  const firstColonIndex = filterStr.indexOf(":");
  if (firstColonIndex === -1) {
    throw new Error(
      `Invalid colon filter format: missing operator. Got: "${filterStr}". Expected: "field:op:value"`,
    );
  }

  const field = filterStr.substring(0, firstColonIndex);
  if (!field) {
    throw new Error(
      `Invalid colon filter format: missing field name. Got: "${filterStr}". Expected: "field:op:value"`,
    );
  }

  const rest = filterStr.substring(firstColonIndex + 1);
  const secondColonIndex = rest.indexOf(":");
  const opStr = secondColonIndex === -1 ? rest : rest.substring(0, secondColonIndex);
  const valueStr = secondColonIndex === -1 ? "" : rest.substring(secondColonIndex + 1);

  if (!opStr) {
    throw new Error(
      `Invalid colon filter format: missing operator. Got: "${filterStr}". Expected: "field:op:value"`,
    );
  }
  return { field, opStr, valueStr };
}

function parseColonFilterValue(
  op: FilterOperator,
  valueStr: string,
  filterStr: string,
): string | number | boolean | Array<string | number> | null {
  if (op === "isNull" || op === "isNotNull") return null;
  if (op === "in" || op === "nin") {
    return valueStr
      ? valueStr.split(",").map((v) => {
          const trimmed = v.trim();
          const num = Number(trimmed);
          return !isNaN(num) && trimmed !== "" ? num : trimmed;
        })
      : [];
  }
  if (valueStr === "") {
    throw new Error(
      `Invalid colon filter format: missing value for operator '${op}'. Got: "${filterStr}". Expected: "field:${op}:value"`,
    );
  }
  if (valueStr === "true") return true;
  if (valueStr === "false") return false;
  if (valueStr === "null") return null;
  const num = Number(valueStr);
  return !isNaN(num) && valueStr !== "" ? num : valueStr;
}

/**
 * Parse colon format filter string into FilterOption.
 * Format: field:operator:value or field:operator:value1,value2 (for in/nin)
 * @param filterStr - Colon format filter string (e.g., "status:eq:active")
 * @returns Parsed FilterOption
 * @throws Error if format is invalid
 */
export function parseColonFilter(filterStr: string): FilterOption {
  const { field, opStr, valueStr } = parseColonFilterParts(filterStr);
  const op = normalizeOperator(opStr);
  const value = parseColonFilterValue(op, valueStr, filterStr);
  return { field, op, value };
}
