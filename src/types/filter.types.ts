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
  | "like"
  | "isNull"
  | "isNotNull";

/**
 * Single filter option with field, operator, and value.
 */
export interface FilterOption {
  /** Field name to filter on. */
  field: string;

  /** Filter operator. */
  op: FilterOperator;

  /** Filter value (supports arrays for `in` and `nin` operators, null for `isNull` and `isNotNull`). */
  value: string | number | boolean | Array<string | number> | null;
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
    value: string | number | boolean | Array<string | number> | null,
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
   * Convert filters to query string format using JSON format.
   * @returns Query string with URL-encoded JSON filter format
   */
  toQueryString(): string {
    if (this.filters.length === 0) {
      return "";
    }

    const jsonFilter: Record<string, Record<string, unknown>> = {};
    this.filters.forEach((f) => {
      if (!jsonFilter[f.field]) {
        jsonFilter[f.field] = {};
      }
      jsonFilter[f.field][f.op] = f.value === null ? null : f.value;
    });

    const jsonString = JSON.stringify(jsonFilter);
    const params = new URLSearchParams();
    // URLSearchParams.append() automatically URL-encodes, so don't double-encode
    params.append("filter", jsonString);
    return params.toString();
  }
}
