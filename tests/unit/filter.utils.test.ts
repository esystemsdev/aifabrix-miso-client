/**
 * Unit tests for filter utilities
 */

import {
  parseFilterParams,
  buildQueryString,
  applyFilters,
  FilterBuilder,
  validateJsonFilter,
  filterQueryToJson,
  jsonToFilterQuery,
} from "../../src/utils/filter.utils";
import {
  FilterOption,
  FilterQuery,
  FilterOperator,
} from "../../src/types/filter.types";

describe("filter.utils", () => {
  describe("parseFilterParams", () => {
    it("should parse JSON object format", () => {
      const result = parseFilterParams({
        filter: { status: { eq: "active" } },
      });
      expect(result).toEqual([
        { field: "status", op: "eq", value: "active" },
      ]);
    });

    it("should parse JSON string format", () => {
      const result = parseFilterParams({
        filter: '{"status": {"eq": "active"}}',
      });
      expect(result).toEqual([
        { field: "status", op: "eq", value: "active" },
      ]);
    });

    it("should parse URL-encoded JSON format", () => {
      const encoded = encodeURIComponent('{"status": {"eq": "active"}}');
      const result = parseFilterParams({
        filter: encoded,
      });
      expect(result).toEqual([
        { field: "status", op: "eq", value: "active" },
      ]);
    });

    it("should parse multiple filters in JSON format", () => {
      const result = parseFilterParams({
        filter: {
          status: { eq: "active" },
          region: { in: ["eu", "us"] },
        },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        field: "status",
        op: "eq",
        value: "active",
      });
      expect(result[1]).toEqual({
        field: "region",
        op: "in",
        value: ["eu", "us"],
      });
    });

    it("should parse array of JSON filters", () => {
      const result = parseFilterParams({
        filter: [
          '{"status": {"eq": "active"}}',
          '{"region": {"in": ["eu", "us"]}}',
        ],
      });
      expect(result).toHaveLength(2);
      expect(result[0].field).toBe("status");
      expect(result[1].field).toBe("region");
    });

    it("should parse all filter operators", () => {
      const operators: FilterOperator[] = [
        "eq",
        "neq",
        "in",
        "nin",
        "gt",
        "lt",
        "gte",
        "lte",
        "contains",
        "like",
        "isNull",
        "isNotNull",
      ];

      operators.forEach((op) => {
        const filter: Record<string, Record<string, unknown>> = {
          field: {},
        };
        if (op === "isNull" || op === "isNotNull") {
          filter.field[op] = null;
        } else if (op === "in" || op === "nin") {
          filter.field[op] = ["value1", "value2"];
        } else {
          filter.field[op] = "value";
        }

        const result = parseFilterParams({ filter });
        expect(result[0].op).toBe(op);
      });
    });

    it("should parse isNull operator", () => {
      const result = parseFilterParams({
        filter: { deletedAt: { isNull: null } },
      });
      expect(result).toEqual([
        { field: "deletedAt", op: "isNull", value: null },
      ]);
    });

    it("should parse isNotNull operator", () => {
      const result = parseFilterParams({
        filter: { email: { isNotNull: null } },
      });
      expect(result).toEqual([
        { field: "email", op: "isNotNull", value: null },
      ]);
    });

    it("should parse number values", () => {
      const result = parseFilterParams({
        filter: { age: { gte: 18 } },
      });
      expect(result[0].value).toBe(18);
    });

    it("should parse boolean values", () => {
      const result = parseFilterParams({
        filter: { active: { eq: true } },
      });
      expect(result[0].value).toBe(true);
    });

    it("should parse array values for in operator", () => {
      const result = parseFilterParams({
        filter: { region: { in: ["eu", "us", "uk"] } },
      });
      expect(result[0].value).toEqual(["eu", "us", "uk"]);
    });

    it("should return empty array when no filter param", () => {
      const result = parseFilterParams({});
      expect(result).toEqual([]);
    });

    it("should handle undefined filter param", () => {
      const result = parseFilterParams({ filter: undefined });
      expect(result).toEqual([]);
    });

    it("should normalize operator aliases", () => {
      const result = parseFilterParams({
        filter: { status: { equals: "active" } },
      });
      expect(result[0].op).toBe("eq");
    });

    it("should throw error for invalid filter format (string instead of object)", () => {
      expect(() => {
        parseFilterParams({ filter: "invalid" });
      }).toThrow("Invalid filter format");
    });

    it("should throw error for invalid filter structure", () => {
      expect(() => {
        parseFilterParams({ filter: { status: "active" } });
      }).toThrow("must have operator dictionary");
    });

    it("should throw error for invalid value type for in operator", () => {
      expect(() => {
        parseFilterParams({ filter: { region: { in: "eu" } } });
      }).toThrow("requires array value");
    });

    it("should throw error for invalid value for isNull operator", () => {
      expect(() => {
        parseFilterParams({ filter: { deletedAt: { isNull: "invalid" } } });
      }).toThrow("requires null value");
    });

    it("should handle field with dot notation", () => {
      const result = parseFilterParams({
        filter: { "user.name": { eq: "John" } },
      });
      expect(result[0].field).toBe("user.name");
    });

    it("should handle special characters in values", () => {
      const result = parseFilterParams({
        filter: { name: { eq: "John O'Brien" } },
      });
      expect(result[0].value).toBe("John O'Brien");
    });

    it("should handle empty filter object", () => {
      const result = parseFilterParams({ filter: {} });
      expect(result).toEqual([]);
    });
  });

  describe("buildQueryString", () => {
    it("should build query string with JSON filter format", () => {
      const options: FilterQuery = {
        filters: [
          { field: "status", op: "eq", value: "active" },
          { field: "region", op: "in", value: ["eu", "us"] },
        ],
      };
      const result = buildQueryString(options);
      const params = new URLSearchParams(result);
      const filterParam = params.get("filter");
      expect(filterParam).toBeTruthy();
      const parsed = JSON.parse(decodeURIComponent(filterParam || "{}"));
      expect(parsed.status).toEqual({ eq: "active" });
      expect(parsed.region).toEqual({ in: ["eu", "us"] });
    });

    it("should include sort parameters", () => {
      const options: FilterQuery = {
        filters: [{ field: "status", op: "eq", value: "active" }],
        sort: ["-updated_at", "name"],
      };
      const result = buildQueryString(options);
      expect(result).toContain("sort=-updated_at");
      expect(result).toContain("sort=name");
    });

    it("should include pagination parameters", () => {
      const options: FilterQuery = {
        filters: [{ field: "status", op: "eq", value: "active" }],
        page: 2,
        pageSize: 25,
      };
      const result = buildQueryString(options);
      expect(result).toContain("page=2");
      expect(result).toContain("page_size=25");
    });

    it("should include fields parameter", () => {
      const options: FilterQuery = {
        fields: ["id", "name", "status"],
      };
      const result = buildQueryString(options);
      expect(result).toContain("fields=id%2Cname%2Cstatus");
    });

    it("should build query with all parameters", () => {
      const options: FilterQuery = {
        filters: [{ field: "status", op: "eq", value: "active" }],
        sort: ["-updated_at"],
        page: 1,
        pageSize: 25,
        fields: ["id", "name"],
      };
      const result = buildQueryString(options);
      expect(result).toContain("filter=");
      expect(result).toContain("sort=");
      expect(result).toContain("page=");
      expect(result).toContain("page_size=");
      expect(result).toContain("fields=");
    });

    it("should handle empty options", () => {
      const result = buildQueryString({});
      expect(result).toBe("");
    });

    it("should handle number values in filters", () => {
      const options: FilterQuery = {
        filters: [
          { field: "age", op: "gte", value: 18 },
          { field: "price", op: "lt", value: 100 },
        ],
      };
      const result = buildQueryString(options);
      const params = new URLSearchParams(result);
      const filterParam = params.get("filter");
      expect(filterParam).toBeTruthy();
      const parsed = JSON.parse(decodeURIComponent(filterParam || "{}"));
      expect(parsed.age).toEqual({ gte: 18 });
      expect(parsed.price).toEqual({ lt: 100 });
    });

    it("should handle boolean values in filters", () => {
      const options: FilterQuery = {
        filters: [{ field: "active", op: "eq", value: true }],
      };
      const result = buildQueryString(options);
      const params = new URLSearchParams(result);
      const filterParam = params.get("filter");
      expect(filterParam).toBeTruthy();
      const parsed = JSON.parse(decodeURIComponent(filterParam || "{}"));
      expect(parsed.active).toEqual({ eq: true });
    });

    it("should handle null values for isNull/isNotNull operators", () => {
      const options: FilterQuery = {
        filters: [
          { field: "deletedAt", op: "isNull", value: null },
          { field: "email", op: "isNotNull", value: null },
        ],
      };
      const result = buildQueryString(options);
      const params = new URLSearchParams(result);
      const filterParam = params.get("filter");
      expect(filterParam).toBeTruthy();
      const parsed = JSON.parse(decodeURIComponent(filterParam || "{}"));
      expect(parsed.deletedAt).toEqual({ isNull: null });
      expect(parsed.email).toEqual({ isNotNull: null });
    });
  });

  describe("applyFilters", () => {
    const data = [
      { id: 1, name: "Test", status: "active", age: 25, region: "eu", deletedAt: null },
      { id: 2, name: "Sample", status: "inactive", age: 30, region: "us", deletedAt: "2024-01-01" },
      { id: 3, name: "Example", status: "active", age: 20, region: "uk", deletedAt: null },
    ];

    it("should filter with eq operator", () => {
      const filters: FilterOption[] = [
        { field: "status", op: "eq", value: "active" },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe("active");
      expect(result[1].status).toBe("active");
    });

    it("should filter with neq operator", () => {
      const filters: FilterOption[] = [
        { field: "status", op: "neq", value: "active" },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("inactive");
    });

    it("should filter with in operator", () => {
      const filters: FilterOption[] = [
        { field: "region", op: "in", value: ["eu", "us"] },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it("should filter with nin operator", () => {
      const filters: FilterOption[] = [
        { field: "region", op: "nin", value: ["eu", "us"] },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].region).toBe("uk");
    });

    it("should filter with gt operator", () => {
      const filters: FilterOption[] = [{ field: "age", op: "gt", value: 20 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it("should filter with lt operator", () => {
      const filters: FilterOption[] = [{ field: "age", op: "lt", value: 25 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
    });

    it("should filter with gte operator", () => {
      const filters: FilterOption[] = [{ field: "age", op: "gte", value: 25 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it("should filter with lte operator", () => {
      const filters: FilterOption[] = [{ field: "age", op: "lte", value: 25 }];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
    });

    it("should filter with contains operator", () => {
      const filters: FilterOption[] = [
        { field: "name", op: "contains", value: "Test" },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test");
    });

    it("should filter with like operator (case-insensitive)", () => {
      const filters: FilterOption[] = [
        { field: "name", op: "like", value: "test" },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
    });

    it("should filter with isNull operator", () => {
      const filters: FilterOption[] = [
        { field: "deletedAt", op: "isNull", value: null },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(2);
      expect(result[0].deletedAt).toBeNull();
      expect(result[1].deletedAt).toBeNull();
    });

    it("should filter with isNotNull operator", () => {
      const filters: FilterOption[] = [
        { field: "deletedAt", op: "isNotNull", value: null },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].deletedAt).not.toBeNull();
    });

    it("should apply multiple filters (AND logic)", () => {
      const filters: FilterOption[] = [
        { field: "status", op: "eq", value: "active" },
        { field: "age", op: "gte", value: 25 },
      ];
      const result = applyFilters(data, filters);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("should return empty array when no items match", () => {
      const filters: FilterOption[] = [
        { field: "status", op: "eq", value: "nonexistent" },
      ];
      const result = applyFilters(data, filters);
      expect(result).toEqual([]);
    });

    it("should return all items when no filters provided", () => {
      const result = applyFilters(data, []);
      expect(result).toEqual(data);
    });
  });

  describe("FilterBuilder", () => {
    it("should create FilterBuilder instance", () => {
      const builder = new FilterBuilder();
      expect(builder).toBeInstanceOf(FilterBuilder);
    });

    it("should add single filter and build", () => {
      const builder = new FilterBuilder();
      const filters = builder.add("status", "eq", "active").build();
      expect(filters).toEqual([
        { field: "status", op: "eq", value: "active" },
      ]);
    });

    it("should chain multiple add calls", () => {
      const builder = new FilterBuilder();
      const filters = builder
        .add("status", "eq", "active")
        .add("region", "in", ["eu", "us"])
        .add("age", "gte", 18)
        .build();

      expect(filters).toHaveLength(3);
      expect(filters[0]).toEqual({
        field: "status",
        op: "eq",
        value: "active",
      });
      expect(filters[1]).toEqual({
        field: "region",
        op: "in",
        value: ["eu", "us"],
      });
      expect(filters[2]).toEqual({ field: "age", op: "gte", value: 18 });
    });

    it("should add many filters at once", () => {
      const builder = new FilterBuilder();
      const filtersToAdd: FilterOption[] = [
        { field: "status", op: "eq", value: "active" },
        { field: "region", op: "in", value: ["eu"] },
      ];
      const filters = builder.addMany(filtersToAdd).build();
      expect(filters).toEqual(filtersToAdd);
    });

    it("should build query string from filters using JSON format", () => {
      const builder = new FilterBuilder();
      const queryString = builder
        .add("status", "eq", "active")
        .add("region", "in", ["eu", "us"])
        .toQueryString();

      const params = new URLSearchParams(queryString);
      const filterParam = params.get("filter");
      expect(filterParam).toBeTruthy();
      const parsed = JSON.parse(decodeURIComponent(filterParam || "{}"));
      expect(parsed.status).toEqual({ eq: "active" });
      expect(parsed.region).toEqual({ in: ["eu", "us"] });
    });

    it("should return empty query string when no filters", () => {
      const builder = new FilterBuilder();
      const queryString = builder.toQueryString();
      expect(queryString).toBe("");
    });

    it("should handle boolean values", () => {
      const builder = new FilterBuilder();
      const filters = builder.add("active", "eq", true).build();
      expect(filters[0].value).toBe(true);
    });

    it("should handle number values", () => {
      const builder = new FilterBuilder();
      const filters = builder.add("age", "gte", 18).build();
      expect(filters[0].value).toBe(18);
    });

    it("should handle array values for in/nin operators", () => {
      const builder = new FilterBuilder();
      const filters = builder.add("region", "in", ["eu", "us", "uk"]).build();
      expect(filters[0].value).toEqual(["eu", "us", "uk"]);
    });

    it("should handle null values for isNull/isNotNull operators", () => {
      const builder = new FilterBuilder();
      const filters = builder.add("deletedAt", "isNull", null).build();
      expect(filters[0].value).toBeNull();
    });
  });

  describe("validateJsonFilter", () => {
    it("should validate correct filter structure", () => {
      expect(() => {
        validateJsonFilter({ status: { eq: "active" } });
      }).not.toThrow();
    });

    it("should throw error for non-object filter", () => {
      expect(() => {
        validateJsonFilter("invalid");
      }).toThrow("Expected object");
    });

    it("should throw error for null filter", () => {
      expect(() => {
        validateJsonFilter(null);
      }).toThrow("Expected object");
    });

    it("should throw error for array filter", () => {
      expect(() => {
        validateJsonFilter([]);
      }).toThrow("Expected object");
    });

    it("should throw error for field with non-object value", () => {
      expect(() => {
        validateJsonFilter({ status: "active" });
      }).toThrow("must have operator dictionary");
    });

    it("should throw error for invalid value type for in operator", () => {
      expect(() => {
        validateJsonFilter({ region: { in: "eu" } });
      }).toThrow("requires array value");
    });

    it("should throw error for invalid value for isNull operator", () => {
      expect(() => {
        validateJsonFilter({ deletedAt: { isNull: "invalid" } });
      }).toThrow("requires null value");
    });
  });

  describe("filterQueryToJson", () => {
    it("should convert FilterQuery to JSON format", () => {
      const filterQuery: FilterQuery = {
        filters: [
          { field: "status", op: "eq", value: "active" },
          { field: "age", op: "gte", value: 18 },
        ],
      };
      const result = filterQueryToJson(filterQuery);
      expect(result).toEqual({
        status: { eq: "active" },
        age: { gte: 18 },
      });
    });

    it("should handle empty filters", () => {
      const filterQuery: FilterQuery = {};
      const result = filterQueryToJson(filterQuery);
      expect(result).toEqual({});
    });

    it("should handle multiple operators on same field", () => {
      const filterQuery: FilterQuery = {
        filters: [
          { field: "age", op: "gte", value: 18 },
          { field: "age", op: "lte", value: 65 },
        ],
      };
      const result = filterQueryToJson(filterQuery);
      expect(result.age).toEqual({ gte: 18, lte: 65 });
    });
  });

  describe("jsonToFilterQuery", () => {
    it("should convert JSON format to FilterQuery", () => {
      const jsonFilter = {
        status: { eq: "active" },
        age: { gte: 18 },
      };
      const result = jsonToFilterQuery(jsonFilter);
      expect(result.filters).toHaveLength(2);
      expect(result.filters?.[0]).toEqual({
        field: "status",
        op: "eq",
        value: "active",
      });
      expect(result.filters?.[1]).toEqual({
        field: "age",
        op: "gte",
        value: 18,
      });
    });

    it("should handle empty JSON filter", () => {
      const result = jsonToFilterQuery({});
      expect(result.filters).toEqual([]);
    });

    it("should handle round-trip conversion", () => {
      const original: FilterQuery = {
        filters: [
          { field: "status", op: "eq", value: "active" },
          { field: "region", op: "in", value: ["eu", "us"] },
        ],
      };
      const json = filterQueryToJson(original);
      const converted = jsonToFilterQuery(json);
      expect(converted.filters).toEqual(original.filters);
    });
  });
});
