/**
 * Pagination types for Miso/Dataplane API responses
 * All keys follow snake_case to match Miso/Dataplane schema
 */

/**
 * Meta information returned in paginated API responses.
 * All keys follow snake_case to match Miso/Dataplane schema.
 */
export interface Meta {
  /** Total number of items available in full dataset. */
  total_items: number;

  /** Current page index (1-based). Maps from `page` query parameter. */
  current_page: number;

  /** Number of items per page. Maps from `page_size` query parameter. */
  page_size: number;

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
