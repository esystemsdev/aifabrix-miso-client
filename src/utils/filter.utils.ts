/**
 * Filter utility functions for parsing and building filter queries
 */

import type { FilterOption, FilterQuery } from '../types/filter.types';
import { FilterBuilder } from '../types/filter.types';

const FILTER_PATTERN = /^([\w.]+):(eq|neq|in|nin|gt|lt|gte|lte|contains|like):(.+)$/i;

/**
 * Parse filter query parameters into structured FilterOption array.
 * Supports format: `?filter=field:op:value` or `?filter[]=field:op:value&filter[]=...`
 * @param query - Query parameters object (e.g., from URLSearchParams or request query)
 * @returns Array of parsed filter options
 */
export function parseFilterParams(query: Record<string, unknown>): FilterOption[] {
  const filterParam = query.filter;
  const filters = Array.isArray(filterParam) ? filterParam : filterParam ? [filterParam] : [];

  const result: FilterOption[] = [];
  
  filters.forEach((f: unknown) => {
    const filterString = String(f);
    const match = filterString.match(FILTER_PATTERN);
    if (!match) {
      return;
    }

    const [, field, op, raw] = match;
    // Parse value: if comma-separated, split into array, otherwise keep as string
    // Note: API expects strings for filter values, numbers are parsed server-side
    const value: string | string[] = raw.includes(',') ? raw.split(',') : raw;
    result.push({ field, op: op as FilterOption['op'], value });
  });

  return result;
}

/**
 * Build query string from FilterQuery object.
 * @param options - FilterQuery object with filters, sort, pagination, and field selection
 * @returns Query string (e.g., `?filter=status:eq:active&sort=-updated_at&page=1&page_size=25`)
 */
export function buildQueryString(options: FilterQuery): string {
  const params = new URLSearchParams();

  options.filters?.forEach((f) => {
    const val = Array.isArray(f.value) ? f.value.join(',') : String(f.value);
    params.append('filter', `${f.field}:${f.op}:${val}`);
  });

  options.sort?.forEach((s) => params.append('sort', s));
  if (options.page) {
    params.append('page', options.page.toString());
  }
  if (options.pageSize) {
    params.append('page_size', options.pageSize.toString());
  }
  if (options.fields && options.fields.length > 0) {
    params.append('fields', options.fields.join(','));
  }

  return params.toString();
}

/**
 * Apply filters locally to an array (used for mocks/tests).
 * @param data - Array of items to filter
 * @param filters - Array of filter options to apply
 * @returns Filtered array
 */
export function applyFilters<T extends Record<string, unknown>>(data: T[], filters: FilterOption[]): T[] {
  return data.filter((item) =>
    filters.every((f) => {
      const v = item[f.field];
      const value = f.value;

      if (Array.isArray(value)) {
        return f.op === 'in' ? value.includes(v as string | number) : !value.includes(v as string | number);
      }

      switch (f.op) {
        case 'eq':
          return v === value;
        case 'neq':
          return v !== value;
        case 'gt':
          return (v as number) > (value as number);
        case 'lt':
          return (v as number) < (value as number);
        case 'gte':
          return (v as number) >= (value as number);
        case 'lte':
          return (v as number) <= (value as number);
        case 'contains':
          return String(v).includes(String(value));
        case 'like':
          return new RegExp(String(value), 'i').test(String(v));
        default:
          return true;
      }
    })
  );
}

// Re-export FilterBuilder for convenience
export { FilterBuilder };
