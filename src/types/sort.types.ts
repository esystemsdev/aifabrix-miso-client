/**
 * Sort types for Miso/Dataplane API query parameters
 * All keys follow camelCase convention
 */

/**
 * Sort option specifying field and order.
 */
export interface SortOption {
  /** Field name to sort by. */
  field: string;

  /** Sort order: ascending or descending. */
  order: 'asc' | 'desc';
}
