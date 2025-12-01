/**
 * Filter types for Miso/Dataplane API query parameters
 * All keys follow camelCase convention
 */

/**
 * Filter operators supported by the API.
 */
export type FilterOperator =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "like";

/**
 * Single filter option with field, operator, and value.
 */
export interface FilterOption {
  /** Field name to filter on. */
  field: string;

  /** Filter operator. */
  op: FilterOperator;

  /** Filter value (supports arrays for `in` and `nin` operators). */
  value: string | number | boolean | Array<string | number>;
}

/**
 * Complete filter query including filters, sorting, pagination, and field selection.
 */
export interface FilterQuery {
  /** Array of filter options. */
  filters?: FilterOption[];

  /** Array of sort fields (e.g., `['-updated_at', 'name']` where `-` prefix means descending). */
  sort?: string[];

  /** Page number (1-based). */
  page?: number;

  /** Number of items per page. */
  pageSize?: number;

  /** Array of field names to include in response (field projection). */
  fields?: string[];
}

/**
 * Builder class for dynamic filter construction.
 * Supports fluent API for building complex filter queries.
 */
export class FilterBuilder {
  private filters: FilterOption[] = [];

  /**
   * Add a single filter to the builder.
   * @param field - Field name to filter on
   * @param op - Filter operator
   * @param value - Filter value (supports arrays for `in` and `nin`)
   * @returns FilterBuilder instance for method chaining
   */
  add(
    field: string,
    op: FilterOperator,
    value: string | number | boolean | Array<string | number>,
  ): FilterBuilder {
    this.filters.push({ field, op, value });
    return this;
  }

  /**
   * Add multiple filters at once.
   * @param filters - Array of filter options to add
   * @returns FilterBuilder instance for method chaining
   */
  addMany(filters: FilterOption[]): FilterBuilder {
    this.filters.push(...filters);
    return this;
  }

  /**
   * Build and return the filter array.
   * @returns Array of filter options
   */
  build(): FilterOption[] {
    return [...this.filters];
  }

  /**
   * Convert filters to query string format.
   * @returns Query string with filter parameters (e.g., `?filter=field:op:value&filter=...`)
   */
  toQueryString(): string {
    const params = new URLSearchParams();
    this.filters.forEach((f) => {
      const val = Array.isArray(f.value) ? f.value.join(",") : String(f.value);
      params.append("filter", `${f.field}:${f.op}:${val}`);
    });
    return params.toString();
  }
}
