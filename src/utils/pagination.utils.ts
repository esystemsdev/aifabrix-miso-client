/**
 * Pagination utility functions for parsing and constructing paginated responses
 */

import type { Meta, PaginatedListResponse } from "../types/pagination.types";

/**
 * Parse query parameters into pagination values.
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Object with `currentPage` (1-based) and `pageSize`
 */
export function parsePaginationParams(query: Record<string, unknown>): {
  currentPage: number;
  pageSize: number;
} {
  const currentPage = parseInt(String(query.page ?? "1"), 10);
  const pageSize = parseInt(String(query.page_size ?? "20"), 10);
  return { currentPage, pageSize };
}

/**
 * Construct meta object for API response.
 * @param totalItems - Total number of items available in full dataset
 * @param currentPage - Current page index (1-based)
 * @param pageSize - Number of items per page
 * @param type - Logical resource type (e.g., "application", "environment")
 * @returns Meta object
 */
export function createMetaObject(
  totalItems: number,
  currentPage: number,
  pageSize: number,
  type: string,
): Meta {
  return { totalItems, currentPage, pageSize, type };
}

/**
 * Apply pagination to an array (for mock/testing).
 * @param items - Array of items to paginate
 * @param currentPage - Current page index (1-based)
 * @param pageSize - Number of items per page
 * @returns Paginated slice of the array
 */
export function applyPaginationToArray<T>(
  items: T[],
  currentPage: number,
  pageSize: number,
): T[] {
  const start = (currentPage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * Wrap array + meta into a standard paginated response.
 * @param items - Array of items for the current page
 * @param totalItems - Total number of items available in full dataset
 * @param currentPage - Current page index (1-based)
 * @param pageSize - Number of items per page
 * @param type - Logical resource type (e.g., "application", "environment")
 * @returns PaginatedListResponse object
 */
export function createPaginatedListResponse<T>(
  items: T[],
  totalItems: number,
  currentPage: number,
  pageSize: number,
  type: string,
): PaginatedListResponse<T> {
  return {
    meta: createMetaObject(totalItems, currentPage, pageSize, type),
    data: items,
  };
}
