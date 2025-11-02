/**
 * Unit tests for pagination utilities
 */

import {
  parsePaginationParams,
  createMetaObject,
  applyPaginationToArray,
  createPaginatedListResponse
} from '../../src/utils/pagination.utils';
import { Meta, PaginatedListResponse } from '../../src/types/pagination.types';

describe('pagination.utils', () => {
  describe('parsePaginationParams', () => {
    it('should parse page and page_size from query params', () => {
      const result = parsePaginationParams({ page: '2', page_size: '25' });
      expect(result.currentPage).toBe(2);
      expect(result.pageSize).toBe(25);
    });

    it('should default to page 1 and pageSize 20 when params missing', () => {
      const result = parsePaginationParams({});
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should default to page 1 when page is missing', () => {
      const result = parsePaginationParams({ page_size: '50' });
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should default to pageSize 20 when pageSize is missing', () => {
      const result = parsePaginationParams({ page: '3' });
      expect(result.currentPage).toBe(3);
      expect(result.pageSize).toBe(20);
    });

    it('should handle string numbers', () => {
      const result = parsePaginationParams({ page: '5', page_size: '100' });
      expect(result.currentPage).toBe(5);
      expect(result.pageSize).toBe(100);
    });

    it('should handle undefined values', () => {
      const result = parsePaginationParams({ page: undefined, page_size: undefined });
      expect(result.currentPage).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should parse invalid numbers as NaN but parseInt handles gracefully', () => {
      const result = parsePaginationParams({ page: 'invalid', page_size: 'also-invalid' });
      expect(result.currentPage).toBe(NaN);
      expect(result.pageSize).toBe(NaN);
    });
  });

  describe('createMetaObject', () => {
    it('should create meta object with all fields', () => {
      const meta: Meta = createMetaObject(120, 1, 25, 'application');
      expect(meta.totalItems).toBe(120);
      expect(meta.currentPage).toBe(1);
      expect(meta.pageSize).toBe(25);
      expect(meta.type).toBe('application');
    });

    it('should handle zero totalItems', () => {
      const meta: Meta = createMetaObject(0, 1, 25, 'item');
      expect(meta.totalItems).toBe(0);
    });

    it('should handle large numbers', () => {
      const meta: Meta = createMetaObject(999999, 100, 100, 'resource');
      expect(meta.totalItems).toBe(999999);
      expect(meta.currentPage).toBe(100);
      expect(meta.pageSize).toBe(100);
    });
  });

  describe('applyPaginationToArray', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should return first page items', () => {
      const result = applyPaginationToArray(items, 1, 5);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return second page items', () => {
      const result = applyPaginationToArray(items, 2, 5);
      expect(result).toEqual([6, 7, 8, 9, 10]);
    });

    it('should return empty array for page beyond range', () => {
      const result = applyPaginationToArray(items, 3, 5);
      expect(result).toEqual([]);
    });

    it('should return partial page if items less than pageSize', () => {
      const result = applyPaginationToArray(items, 1, 20);
      expect(result).toEqual(items);
    });

    it('should return empty array for empty input', () => {
      const result = applyPaginationToArray([], 1, 10);
      expect(result).toEqual([]);
    });

    it('should handle page 0 (edge case)', () => {
      const result = applyPaginationToArray(items, 0, 5);
      expect(result).toEqual([]); // (0-1)*5 = -5, slice(-5, 0) returns empty array
    });

    it('should handle large pageSize', () => {
      const result = applyPaginationToArray(items, 1, 100);
      expect(result).toEqual(items);
    });
  });

  describe('createPaginatedListResponse', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it('should create paginated response with meta and data', () => {
      const response: PaginatedListResponse<{ id: number }> = createPaginatedListResponse(
        items,
        100,
        1,
        3,
        'item'
      );

      expect(response.meta.totalItems).toBe(100);
      expect(response.meta.currentPage).toBe(1);
      expect(response.meta.pageSize).toBe(3);
      expect(response.meta.type).toBe('item');
      expect(response.data).toEqual(items);
    });

    it('should handle empty data array', () => {
      const response: PaginatedListResponse<{ id: number }> = createPaginatedListResponse(
        [],
        0,
        1,
        10,
        'item'
      );

      expect(response.meta.totalItems).toBe(0);
      expect(response.data).toEqual([]);
    });

    it('should create response with correct meta for different pages', () => {
      const response: PaginatedListResponse<{ id: number }> = createPaginatedListResponse(
        items,
        50,
        5,
        10,
        'resource'
      );

      expect(response.meta.currentPage).toBe(5);
      expect(response.meta.totalItems).toBe(50);
      expect(response.meta.pageSize).toBe(10);
    });
  });
});
