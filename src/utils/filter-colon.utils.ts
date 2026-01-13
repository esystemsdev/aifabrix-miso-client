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

/**
 * Parse colon format filter string into FilterOption.
 * Format: field:operator:value or field:operator:value1,value2 (for in/nin)
 * @param filterStr - Colon format filter string (e.g., "status:eq:active")
 * @returns Parsed FilterOption
 * @throws Error if format is invalid
 */
export function parseColonFilter(filterStr: string): FilterOption {
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

  let opStr: string;
  let valueStr: string;

  if (secondColonIndex === -1) {
    opStr = rest;
    valueStr = "";
  } else {
    opStr = rest.substring(0, secondColonIndex);
    valueStr = rest.substring(secondColonIndex + 1);
  }

  if (!opStr) {
    throw new Error(
      `Invalid colon filter format: missing operator. Got: "${filterStr}". Expected: "field:op:value"`,
    );
  }

  const op = normalizeOperator(opStr);
  let value: string | number | boolean | Array<string | number> | null;

  if (op === "isNull" || op === "isNotNull") {
    value = null;
  } else if (op === "in" || op === "nin") {
    if (!valueStr) {
      value = [];
    } else {
      value = valueStr.split(",").map((v) => {
        const trimmed = v.trim();
        const num = Number(trimmed);
        return !isNaN(num) && trimmed !== "" ? num : trimmed;
      });
    }
  } else if (valueStr === "") {
    throw new Error(
      `Invalid colon filter format: missing value for operator '${op}'. Got: "${filterStr}". Expected: "field:${op}:value"`,
    );
  } else if (valueStr === "true") {
    value = true;
  } else if (valueStr === "false") {
    value = false;
  } else if (valueStr === "null") {
    value = null;
  } else {
    const num = Number(valueStr);
    value = !isNaN(num) && valueStr !== "" ? num : valueStr;
  }

  return { field, op, value };
}
