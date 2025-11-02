/**
 * Unit tests for sort utilities
 */

import { parse_sort_params, build_sort_string } from '../../src/utils/sort.utils';
import { SortOption } from '../../src/types/sort.types';

describe('sort.utils', () => {
  describe('parse_sort_params', () => {
    it('should parse ascending sort param', () => {
      const result = parse_sort_params({ sort: 'name' });
      expect(result).toEqual([{ field: 'name', order: 'asc' }]);
    });

    it('should parse descending sort param (with - prefix)', () => {
      const result = parse_sort_params({ sort: '-updated_at' });
      expect(result).toEqual([{ field: 'updated_at', order: 'desc' }]);
    });

    it('should parse multiple sort params as array', () => {
      const result = parse_sort_params({ sort: ['-updated_at', 'name'] });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ field: 'updated_at', order: 'desc' });
      expect(result[1]).toEqual({ field: 'name', order: 'asc' });
    });

    it('should parse single sort param as array element', () => {
      const result = parse_sort_params({ sort: 'name' });
      expect(result).toHaveLength(1);
      expect(result[0].field).toBe('name');
      expect(result[0].order).toBe('asc');
    });

    it('should handle field with dot notation', () => {
      const result = parse_sort_params({ sort: '-user.created_at' });
      expect(result[0].field).toBe('user.created_at');
      expect(result[0].order).toBe('desc');
    });

    it('should return empty array when no sort param', () => {
      const result = parse_sort_params({});
      expect(result).toEqual([]);
    });

    it('should handle undefined sort param', () => {
      const result = parse_sort_params({ sort: undefined });
      expect(result).toEqual([]);
    });

    it('should handle empty array sort param', () => {
      const result = parse_sort_params({ sort: [] });
      expect(result).toEqual([]);
    });

    it('should handle multiple descending sorts', () => {
      const result = parse_sort_params({ sort: ['-updated_at', '-created_at'] });
      expect(result).toHaveLength(2);
      expect(result[0].order).toBe('desc');
      expect(result[1].order).toBe('desc');
    });

    it('should handle mixed ascending and descending sorts', () => {
      const result = parse_sort_params({ sort: ['-updated_at', 'name', '-status'] });
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ field: 'updated_at', order: 'desc' });
      expect(result[1]).toEqual({ field: 'name', order: 'asc' });
      expect(result[2]).toEqual({ field: 'status', order: 'desc' });
    });
  });

  describe('build_sort_string', () => {
    it('should build sort string from ascending sort option', () => {
      const sortOptions: SortOption[] = [{ field: 'name', order: 'asc' }];
      const result = build_sort_string(sortOptions);
      expect(result).toEqual(['name']);
    });

    it('should build sort string from descending sort option', () => {
      const sortOptions: SortOption[] = [{ field: 'updated_at', order: 'desc' }];
      const result = build_sort_string(sortOptions);
      expect(result).toEqual(['-updated_at']);
    });

    it('should build sort string from multiple sort options', () => {
      const sortOptions: SortOption[] = [
        { field: 'updated_at', order: 'desc' },
        { field: 'name', order: 'asc' },
        { field: 'status', order: 'desc' }
      ];
      const result = build_sort_string(sortOptions);
      expect(result).toEqual(['-updated_at', 'name', '-status']);
    });

    it('should handle empty array', () => {
      const result = build_sort_string([]);
      expect(result).toEqual([]);
    });

    it('should handle all ascending sorts', () => {
      const sortOptions: SortOption[] = [
        { field: 'name', order: 'asc' },
        { field: 'created_at', order: 'asc' }
      ];
      const result = build_sort_string(sortOptions);
      expect(result).toEqual(['name', 'created_at']);
    });

    it('should handle all descending sorts', () => {
      const sortOptions: SortOption[] = [
        { field: 'updated_at', order: 'desc' },
        { field: 'status', order: 'desc' }
      ];
      const result = build_sort_string(sortOptions);
      expect(result).toEqual(['-updated_at', '-status']);
    });

    it('should handle field with dot notation', () => {
      const sortOptions: SortOption[] = [{ field: 'user.created_at', order: 'desc' }];
      const result = build_sort_string(sortOptions);
      expect(result).toEqual(['-user.created_at']);
    });
  });
});
