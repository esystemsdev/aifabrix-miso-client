/**
 * Pagination utility functions for parsing and constructing paginated responses
 */

import type { Meta, PaginatedListResponse } from '../types/pagination.types';

/**
 * Parse query parameters into pagination values.
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Object with `current_page` (1-based) and `page_size`
 */
export function parse_pagination_params(query: Record<string, unknown>): { current_page: number; page_size: number } {
  const current_page = parseInt(String(query.page ?? '1'), 10);
  const page_size = parseInt(String(query.page_size ?? '20'), 10);
  return { current_page, page_size };
}

/**
 * Construct meta object for API response.
 * @param total_items - Total number of items available in full dataset
 * @param current_page - Current page index (1-based)
 * @param page_size - Number of items per page
 * @param type - Logical resource type (e.g., "application", "environment")
 * @returns Meta object
 */
export function create_meta_object(total_items: number, current_page: number, page_size: number, type: string): Meta {
  return { total_items, current_page, page_size, type };
}

/**
 * Apply pagination to an array (for mock/testing).
 * @param items - Array of items to paginate
 * @param current_page - Current page index (1-based)
 * @param page_size - Number of items per page
 * @returns Paginated slice of the array
 */
export function apply_pagination_to_array<T>(items: T[], current_page: number, page_size: number): T[] {
  const start = (current_page - 1) * page_size;
  return items.slice(start, start + page_size);
}

/**
 * Wrap array + meta into a standard paginated response.
 * @param items - Array of items for the current page
 * @param total_items - Total number of items available in full dataset
 * @param current_page - Current page index (1-based)
 * @param page_size - Number of items per page
 * @param type - Logical resource type (e.g., "application", "environment")
 * @returns PaginatedListResponse object
 */
export function create_paginated_list_response<T>(
  items: T[],
  total_items: number,
  current_page: number,
  page_size: number,
  type: string
): PaginatedListResponse<T> {
  return {
    meta: create_meta_object(total_items, current_page, page_size, type),
    data: items
  };
}
