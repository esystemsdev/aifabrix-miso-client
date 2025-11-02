/**
 * Unit tests for pagination utilities
 */

import {
  parse_pagination_params,
  create_meta_object,
  apply_pagination_to_array,
  create_paginated_list_response
} from '../../src/utils/pagination.utils';
import { Meta, PaginatedListResponse } from '../../src/types/pagination.types';

describe('pagination.utils', () => {
  describe('parse_pagination_params', () => {
    it('should parse page and page_size from query params', () => {
      const result = parse_pagination_params({ page: '2', page_size: '25' });
      expect(result.current_page).toBe(2);
      expect(result.page_size).toBe(25);
    });

    it('should default to page 1 and page_size 20 when params missing', () => {
      const result = parse_pagination_params({});
      expect(result.current_page).toBe(1);
      expect(result.page_size).toBe(20);
    });

    it('should default to page 1 when page is missing', () => {
      const result = parse_pagination_params({ page_size: '50' });
      expect(result.current_page).toBe(1);
      expect(result.page_size).toBe(50);
    });

    it('should default to page_size 20 when page_size is missing', () => {
      const result = parse_pagination_params({ page: '3' });
      expect(result.current_page).toBe(3);
      expect(result.page_size).toBe(20);
    });

    it('should handle string numbers', () => {
      const result = parse_pagination_params({ page: '5', page_size: '100' });
      expect(result.current_page).toBe(5);
      expect(result.page_size).toBe(100);
    });

    it('should handle undefined values', () => {
      const result = parse_pagination_params({ page: undefined, page_size: undefined });
      expect(result.current_page).toBe(1);
      expect(result.page_size).toBe(20);
    });

    it('should parse invalid numbers as NaN but parseInt handles gracefully', () => {
      const result = parse_pagination_params({ page: 'invalid', page_size: 'also-invalid' });
      expect(result.current_page).toBe(NaN);
      expect(result.page_size).toBe(NaN);
    });
  });

  describe('create_meta_object', () => {
    it('should create meta object with all fields', () => {
      const meta: Meta = create_meta_object(120, 1, 25, 'application');
      expect(meta.total_items).toBe(120);
      expect(meta.current_page).toBe(1);
      expect(meta.page_size).toBe(25);
      expect(meta.type).toBe('application');
    });

    it('should handle zero total_items', () => {
      const meta: Meta = create_meta_object(0, 1, 25, 'item');
      expect(meta.total_items).toBe(0);
    });

    it('should handle large numbers', () => {
      const meta: Meta = create_meta_object(999999, 100, 100, 'resource');
      expect(meta.total_items).toBe(999999);
      expect(meta.current_page).toBe(100);
      expect(meta.page_size).toBe(100);
    });
  });

  describe('apply_pagination_to_array', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should return first page items', () => {
      const result = apply_pagination_to_array(items, 1, 5);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return second page items', () => {
      const result = apply_pagination_to_array(items, 2, 5);
      expect(result).toEqual([6, 7, 8, 9, 10]);
    });

    it('should return empty array for page beyond range', () => {
      const result = apply_pagination_to_array(items, 3, 5);
      expect(result).toEqual([]);
    });

    it('should return partial page if items less than page_size', () => {
      const result = apply_pagination_to_array(items, 1, 20);
      expect(result).toEqual(items);
    });

    it('should return empty array for empty input', () => {
      const result = apply_pagination_to_array([], 1, 10);
      expect(result).toEqual([]);
    });

    it('should handle page 0 (edge case)', () => {
      const result = apply_pagination_to_array(items, 0, 5);
      expect(result).toEqual([]); // (0-1)*5 = -5, slice(-5, 0) returns empty array
    });

    it('should handle large page_size', () => {
      const result = apply_pagination_to_array(items, 1, 100);
      expect(result).toEqual(items);
    });
  });

  describe('create_paginated_list_response', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it('should create paginated response with meta and data', () => {
      const response: PaginatedListResponse<{ id: number }> = create_paginated_list_response(
        items,
        100,
        1,
        3,
        'item'
      );

      expect(response.meta.total_items).toBe(100);
      expect(response.meta.current_page).toBe(1);
      expect(response.meta.page_size).toBe(3);
      expect(response.meta.type).toBe('item');
      expect(response.data).toEqual(items);
    });

    it('should handle empty data array', () => {
      const response: PaginatedListResponse<{ id: number }> = create_paginated_list_response(
        [],
        0,
        1,
        10,
        'item'
      );

      expect(response.meta.total_items).toBe(0);
      expect(response.data).toEqual([]);
    });

    it('should create response with correct meta for different pages', () => {
      const response: PaginatedListResponse<{ id: number }> = create_paginated_list_response(
        items,
        50,
        5,
        10,
        'resource'
      );

      expect(response.meta.current_page).toBe(5);
      expect(response.meta.total_items).toBe(50);
      expect(response.meta.page_size).toBe(10);
    });
  });
});
