/**
 * Pagination types for Miso/Dataplane API responses
 * All keys follow camelCase convention
 */

/**
 * Meta information returned in paginated API responses.
 */
export interface Meta {
  /** Total number of items available in full dataset. */
  totalItems: number;

  /** Current page index (1-based). Maps from `page` query parameter. */
  currentPage: number;

  /** Number of items per page. Maps from `pageSize` query parameter. */
  pageSize: number;

  /** Logical resource type (e.g. "application", "environment"). */
  type: string;
}

/**
 * Standard paginated list response envelope.
 */
export interface PaginatedListResponse<T> {
  /** Pagination metadata. */
  meta: Meta;

  /** Array of items for the current page. */
  data: T[];
}
