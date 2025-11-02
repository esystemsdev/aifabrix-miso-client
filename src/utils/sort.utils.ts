/**
 * Sort utility functions for parsing and building sort query parameters
 */

import type { SortOption } from '../types/sort.types';

/**
 * Parse sort query parameters into structured SortOption array.
 * Supports format: `?sort=-field` (descending) or `?sort=field` (ascending)
 * or `?sort[]=-updated_at&sort[]=name` for multiple sorts.
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Array of parsed sort options
 */
export function parse_sort_params(query: Record<string, unknown>): SortOption[] {
  const sortParam = query.sort;
  const sorts = Array.isArray(sortParam) ? sortParam : sortParam ? [sortParam] : [];

  return sorts.map((s: unknown) => {
    const sortString = String(s);
    return {
      field: sortString.startsWith('-') ? sortString.substring(1) : sortString,
      order: sortString.startsWith('-') ? 'desc' : 'asc'
    };
  });
}

/**
 * Convert SortOption array to query string format.
 * @param sortOptions - Array of sort options
 * @returns Array of sort strings (e.g., `['-updated_at', 'name']`)
 */
export function build_sort_string(sortOptions: SortOption[]): string[] {
  return sortOptions.map((so) => (so.order === 'desc' ? `-${so.field}` : so.field));
}
