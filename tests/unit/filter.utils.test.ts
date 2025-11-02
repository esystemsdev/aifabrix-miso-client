/**
 * Unit tests for filter utilities
 */

import {
  parseFilterParams,
  buildQueryString,
  applyFilters,
  FilterBuilder
} from '../../src/utils/filter.utils';
import { FilterOption, FilterQuery, FilterOperator } from '../../src/types/filter.types';

describe('filter.utils', () => {
  describe('parseFilterParams', () => {
    it('should parse single filter param', () => {
      const result = parseFilterParams({ filter: 'status:eq:active' });
      expect(result).toEqual([{ field: 'status', op: 'eq', value: 'active' }]);
    });

    it('should parse multiple filter params as array', () => {
      const result = parseFilterParams({
        filter: ['status:eq:active', 'region:in:eu,us']
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ field: 'status', op: 'eq', value: 'active' });
      expect(result[1]).toEqual({ field: 'region', op: 'in', value: ['eu', 'us'] });
    });

    it('should parse filter with array value (comma-separated)', () => {
      const result = parseFilterParams({ filter: 'region:in:eu,us,uk' });
      expect(result[0].value).toEqual(['eu', 'us', 'uk']);
    });

    it('should parse all filter operators', () => {
      const operators: FilterOperator[] = ['eq', 'neq', 'in', 'nin', 'gt', 'lt', 'gte', 'lte', 'contains', 'like'];
      
      operators.forEach((op) => {
        const result = parseFilterParams({ filter: `field:${op}:value` });
        expect(result[0].op).toBe(op);
      });
    });

    it('should return empty array when no filter param', () => {
      const result = parseFilterParams({});
      expect(result).toEqual([]);
    });

    it('should skip invalid filter format', () => {
      const result = parseFilterParams({ filter: ['status:eq:active', 'invalid', 'name:eq:test'] });
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe('status');
      expect(result[1].field).toBe('name');
    });

    it('should handle field with dot notation', () => {
      const result = parseFilterParams({ filter: 'user.name:eq:John' });
      expect(result[0].field).toBe('user.name');
    });

    it('should handle undefined filter param', () => {
      const result = parseFilterParams({ filter: undefined });
      expect(result).toEqual([]);
    });
  });

  describe('buildQueryString', () => {
    it('should build query string with filters', () => {
      const options: FilterQuery = {
        filters: [
          { field: 'status', op: 'eq', value: 'active' },
          { field: 'region', op: 'in', value: ['eu', 'us'] }
        ]
      };
      const result = buildQueryString(options);
      // URLSearchParams URL-encodes values, so we check for encoded version
      expect(result).toContain('filter=status%3Aeq%3Aactive');
      expect(result).toContain('filter=region%3Ain%3Aeu%2Cus');
    });

    it('should include sort parameters', () => {
      const options: FilterQuery = {
        filters: [{ field: 'status', op: 'eq', value: 'active' }],
        sort: ['-updated_at', 'name']
      };
      const result = buildQueryString(options);
      expect(result).toContain('sort=-updated_at');
      expect(result).toContain('sort=name');
    });

    it('should include pagination parameters', () => {
      const options: FilterQuery = {
        filters: [{ field: 'status', op: 'eq', value: 'active' }],
        page: 2,
        pageSize: 25
      };
      const result = buildQueryString(options);
      expect(result).toContain('page=2');
      expect(result).toContain('page_size=25');
    });

    it('should include fields parameter', () => {
      const options: FilterQuery = {
        fields: ['id', 'name', 'status']
      };
      const result = buildQueryString(options);
      // URLSearchParams URL-encodes values
      expect(result).toContain('fields=id%2Cname%2Cstatus');
    });

    it('should build query with all parameters', () => {
      const options: FilterQuery = {
        filters: [{ field: 'status', op: 'eq', value: 'active' }],
        sort: ['-updated_at'],
        page: 1,
        pageSize: 25,
        fields: ['id', 'name']
      };
      const result = buildQueryString(options);
      expect(result).toContain('filter=');
      expect(result).toContain('sort=');
      expect(result).toContain('page=');
      expect(result).toContain('page_size=');
      expect(result).toContain('fields=');
    });

    it('should handle empty options', () => {
      const result = buildQueryString({});
      expect(result).toBe('');
    });

    it('should handle number values in filters', () => {
      const options: FilterQuery = {
        filters: [
          { field: 'age', op: 'gte', value: 18 },
          { field: 'price', op: 'lt', value: 100 }
        ]
      };
      const result = buildQueryString(options);
      // URLSearchParams URL-encodes values
      expect(result).toContain('filter=age%3Agte%3A18');
      expect(result).toContain('filter=price%3Alt%3A100');
    });

    it('should handle boolean values in filters', () => {
      const options: FilterQuery = {
        filters: [{ field: 'active', op: 'eq', value: true }]
      };
      const result = buildQueryString(options);
      // URLSearchParams URL-encodes values
      expect(result).toContain('filter=active%3Aeq%3Atrue');
    });
  });

  describe('applyFilters', () => {
    const data = [
      { id: 1, name: 'Test', status: 'active', age: 25, region: 'eu' },
      { id: 2, name: 'Sample', status: 'inactive', age: 30, region: 'us' },
      { id: 3, name: 'Example', status: 'active', age: 20, region: 'uk' }
    ];

    it('should filter with eq operator', () => {
      const filters: FilterOption[] = [{ field: 'status', op: 'eq', value: 'active' }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('active');
      expect(result[1].status).toBe('active');
    });

    it('should filter with neq operator', () => {
      const filters: FilterOption[] = [{ field: 'status', op: 'neq', value: 'active' }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('inactive');
    });

    it('should filter with in operator', () => {
      const filters: FilterOption[] = [{ field: 'region', op: 'in', value: ['eu', 'us'] }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it('should filter with nin operator', () => {
      const filters: FilterOption[] = [{ field: 'region', op: 'nin', value: ['eu', 'us'] }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe('uk');
    });

    it('should filter with gt operator', () => {
      const filters: FilterOption[] = [{ field: 'age', op: 'gt', value: 20 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it('should filter with lt operator', () => {
      const filters: FilterOption[] = [{ field: 'age', op: 'lt', value: 25 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
    });

    it('should filter with gte operator', () => {
      const filters: FilterOption[] = [{ field: 'age', op: 'gte', value: 25 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it('should filter with lte operator', () => {
      const filters: FilterOption[] = [{ field: 'age', op: 'lte', value: 25 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it('should filter with contains operator', () => {
      const filters: FilterOption[] = [{ field: 'name', op: 'contains', value: 'Test' }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test');
    });

    it('should filter with like operator (case-insensitive)', () => {
      const filters: FilterOption[] = [{ field: 'name', op: 'like', value: 'test' }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
    });

    it('should apply multiple filters (AND logic)', () => {
      const filters: FilterOption[] = [
        { field: 'status', op: 'eq', value: 'active' },
        { field: 'age', op: 'gte', value: 25 }
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should return empty array when no items match', () => {
      const filters: FilterOption[] = [{ field: 'status', op: 'eq', value: 'nonexistent' }];
      const result = applyFilters(data, filters);
      expect(result).toEqual([]);
    });

    it('should return all items when no filters provided', () => {
      const result = applyFilters(data, []);
      expect(result).toEqual(data);
    });
  });

  describe('FilterBuilder', () => {
    it('should create FilterBuilder instance', () => {
      const builder = new FilterBuilder();
      expect(builder).toBeInstanceOf(FilterBuilder);
    });

    it('should add single filter and build', () => {
      const builder = new FilterBuilder();
      const filters = builder.add('status', 'eq', 'active').build();
      expect(filters).toEqual([{ field: 'status', op: 'eq', value: 'active' }]);
    });

    it('should chain multiple add calls', () => {
      const builder = new FilterBuilder();
      const filters = builder
        .add('status', 'eq', 'active')
        .add('region', 'in', ['eu', 'us'])
        .add('age', 'gte', 18)
        .build();
      
      expect(filters).toHaveLength(3);
      expect(filters[0]).toEqual({ field: 'status', op: 'eq', value: 'active' });
      expect(filters[1]).toEqual({ field: 'region', op: 'in', value: ['eu', 'us'] });
      expect(filters[2]).toEqual({ field: 'age', op: 'gte', value: 18 });
    });

    it('should add many filters at once', () => {
      const builder = new FilterBuilder();
      const filtersToAdd: FilterOption[] = [
        { field: 'status', op: 'eq', value: 'active' },
        { field: 'region', op: 'in', value: ['eu'] }
      ];
      const filters = builder.addMany(filtersToAdd).build();
      expect(filters).toEqual(filtersToAdd);
    });

    it('should build query string from filters', () => {
      const builder = new FilterBuilder();
      const queryString = builder
        .add('status', 'eq', 'active')
        .add('region', 'in', ['eu', 'us'])
        .toQueryString();
      
      // URLSearchParams URL-encodes values
      expect(queryString).toContain('filter=status%3Aeq%3Aactive');
      expect(queryString).toContain('filter=region%3Ain%3Aeu%2Cus');
    });

    it('should return empty query string when no filters', () => {
      const builder = new FilterBuilder();
      const queryString = builder.toQueryString();
      expect(queryString).toBe('');
    });

    it('should handle boolean values', () => {
      const builder = new FilterBuilder();
      const filters = builder.add('active', 'eq', true).build();
      expect(filters[0].value).toBe(true);
    });

    it('should handle number values', () => {
      const builder = new FilterBuilder();
      const filters = builder.add('age', 'gte', 18).build();
      expect(filters[0].value).toBe(18);
    });

    it('should handle array values for in/nin operators', () => {
      const builder = new FilterBuilder();
      const filters = builder.add('region', 'in', ['eu', 'us', 'uk']).build();
      expect(filters[0].value).toEqual(['eu', 'us', 'uk']);
    });
  });
});
