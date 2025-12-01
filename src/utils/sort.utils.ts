/**
 * Sort utility functions for parsing and building sort query parameters
 */

import type { SortOption } from "../types/sort.types";

// Re-export SortOption for convenience
export type { SortOption } from "../types/sort.types";

/**
 * Parse sort query parameters into structured SortOption array.
 * Supports formats:
 * - `?sort=-field` (descending) or `?sort=field` (ascending)
 * - `?sort=field:asc` or `?sort=field:desc` (colon-separated)
 * - `?sort[]=-updated_at&sort[]=name` for multiple sorts
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Array of parsed sort options
 */
export function parseSortParams(query: Record<string, unknown>): SortOption[] {
  const sortParam = query.sort;
  const sorts = Array.isArray(sortParam)
    ? sortParam
    : sortParam
      ? [sortParam]
      : [];

  return sorts
    .map((s: unknown) => {
      const sortString = String(s).trim();

      // Filter out empty strings and invalid values
      if (!sortString || sortString === "-" || sortString === ":") {
        return null;
      }

      // Check for colon-separated format (field:asc or field:desc)
      if (sortString.includes(":")) {
        const [field, order] = sortString.split(":");
        const trimmedField = field.trim();
        if (!trimmedField) return null;
        return {
          field: trimmedField,
          order: (order?.trim().toLowerCase() === "desc" ? "desc" : "asc") as
            | "asc"
            | "desc",
        };
      }

      // Handle minus prefix format (-field)
      if (sortString.startsWith("-")) {
        const field = sortString.substring(1).trim();
        if (!field) return null;
        return {
          field,
          order: "desc" as const,
        };
      }

      // Default ascending
      return {
        field: sortString,
        order: "asc" as const,
      };
    })
    .filter((option): option is SortOption => option !== null);
}

/**
 * Convert SortOption array to query string format.
 * @param sortOptions - Array of sort options
 * @returns Array of sort strings (e.g., `['-updated_at', 'name']`)
 */
export function buildSortString(sortOptions: SortOption[]): string[] {
  return sortOptions.map((so) =>
    so.order === "desc" ? `-${so.field}` : so.field,
  );
}

/**
 * Apply sorting to data array based on sort options.
 * Useful for client-side sorting of in-memory data.
 * @param data - Array of data to sort
 * @param sortOptions - Array of sort options (field and order)
 * @returns Sorted array (new array, does not mutate original)
 */
export function applySorting<T extends Record<string, unknown>>(
  data: T[],
  sortOptions: SortOption[],
): T[] {
  if (!sortOptions || sortOptions.length === 0) {
    return data;
  }

  return [...data].sort((a, b) => {
    for (const sort of sortOptions) {
      const aVal = a[sort.field];
      const bVal = b[sort.field];

      // Handle null/undefined
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Compare values
      if (aVal < bVal) return sort.order === "asc" ? -1 : 1;
      if (aVal > bVal) return sort.order === "asc" ? 1 : -1;
    }
    return 0;
  });
}
