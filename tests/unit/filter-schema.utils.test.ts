/**
 * Unit tests for filter schema utilities
 */

import {
  createFilterError,
  coerceValue,
  validateFilter,
  validateFilters,
  compileFilter,
  createFilterSchema,
  loadFilterSchema,
} from "../../src/utils/filter-schema.utils";
import {
  FilterSchema,
  FilterFieldDefinition,
  FilterErrorCode,
} from "../../src/types/filter-schema.types";
import type { FilterOption } from "../../src/types/filter.types";

describe("filter-schema.utils", () => {
  // Test schema for all tests
  const testSchema: FilterSchema = {
    resource: "applications",
    version: "1.0",
    fields: {
      name: {
        column: "name",
        type: "string",
        operators: ["eq", "neq", "ilike", "in"],
        description: "Application name",
      },
      status: {
        column: "status",
        type: "enum",
        operators: ["eq", "in"],
        enumValues: ["active", "disabled", "deleted"],
      },
      createdAt: {
        column: "created_at",
        type: "timestamp",
        operators: ["gt", "gte", "lt", "lte"],
      },
      priority: {
        column: "priority",
        type: "number",
        operators: ["eq", "gt", "gte", "lt", "lte", "in"],
      },
      isPublic: {
        column: "is_public",
        type: "boolean",
        operators: ["eq"],
      },
      environmentId: {
        column: "environment_id",
        type: "uuid",
        operators: ["eq", "in"],
      },
      deletedAt: {
        column: "deleted_at",
        type: "timestamp",
        operators: ["isNull", "isNotNull"],
        nullable: true,
      },
    },
  };

  describe("createFilterError", () => {
    it("should create error with code and message", () => {
      const error = createFilterError(FilterErrorCode.UNKNOWN_FIELD, "Field not found");
      expect(error.code).toBe("UNKNOWN_FIELD");
      expect(error.message).toBe("Field not found");
    });

    it("should create error with extras", () => {
      const error = createFilterError(
        FilterErrorCode.INVALID_OPERATOR,
        "Operator not allowed",
        { field: "status", operator: "like", allowedOperators: ["eq", "in"] },
      );
      expect(error.code).toBe("INVALID_OPERATOR");
      expect(error.field).toBe("status");
      expect(error.operator).toBe("like");
      expect(error.allowedOperators).toEqual(["eq", "in"]);
    });
  });

  describe("coerceValue", () => {
    it("should coerce string to number", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "priority",
        type: "number",
        operators: ["eq"],
      };
      expect(coerceValue("42", fieldDef)).toBe(42);
    });

    it("should coerce array of strings to numbers", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "priority",
        type: "number",
        operators: ["in"],
      };
      expect(coerceValue(["1", "2", "3"], fieldDef)).toEqual([1, 2, 3]);
    });

    it("should coerce string 'true' to boolean true", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "is_public",
        type: "boolean",
        operators: ["eq"],
      };
      expect(coerceValue("true", fieldDef)).toBe(true);
    });

    it("should coerce string 'false' to boolean false", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "is_public",
        type: "boolean",
        operators: ["eq"],
      };
      expect(coerceValue("false", fieldDef)).toBe(false);
    });

    it("should coerce timestamp string to ISO format", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "created_at",
        type: "timestamp",
        operators: ["gte"],
      };
      const result = coerceValue("2024-01-01", fieldDef);
      expect(typeof result).toBe("string");
      expect((result as string).includes("2024-01-01")).toBe(true);
    });

    it("should return null as-is", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "name",
        type: "string",
        operators: ["eq"],
      };
      expect(coerceValue(null, fieldDef)).toBeNull();
    });

    it("should throw error for invalid number", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "priority",
        type: "number",
        operators: ["eq"],
      };
      expect(() => coerceValue("not-a-number", fieldDef)).toThrow();
    });

    it("should throw error for invalid boolean", () => {
      const fieldDef: FilterFieldDefinition = {
        column: "is_public",
        type: "boolean",
        operators: ["eq"],
      };
      expect(() => coerceValue("maybe", fieldDef)).toThrow();
    });
  });

  describe("validateFilter", () => {
    it("should return null for valid filter", () => {
      const filter: FilterOption = { field: "name", op: "eq", value: "test" };
      const error = validateFilter(filter, testSchema);
      expect(error).toBeNull();
    });

    it("should return error for unknown field", () => {
      const filter: FilterOption = { field: "unknown", op: "eq", value: "test" };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.UNKNOWN_FIELD);
      expect(error?.field).toBe("unknown");
    });

    it("should return error for invalid operator", () => {
      const filter: FilterOption = { field: "status", op: "ilike", value: "test" };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.INVALID_OPERATOR);
      expect(error?.operator).toBe("ilike");
      expect(error?.allowedOperators).toEqual(["eq", "in"]);
    });

    it("should return error for invalid enum value", () => {
      const filter: FilterOption = { field: "status", op: "eq", value: "invalid" };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.INVALID_ENUM);
      expect(error?.allowedValues).toEqual(["active", "disabled", "deleted"]);
    });

    it("should return error for invalid UUID", () => {
      const filter: FilterOption = { field: "environmentId", op: "eq", value: "not-a-uuid" };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.INVALID_UUID);
    });

    it("should return null for valid UUID", () => {
      const filter: FilterOption = {
        field: "environmentId",
        op: "eq",
        value: "550e8400-e29b-41d4-a716-446655440000",
      };
      const error = validateFilter(filter, testSchema);
      expect(error).toBeNull();
    });

    it("should return error for invalid timestamp", () => {
      const filter: FilterOption = { field: "createdAt", op: "gte", value: "not-a-date" };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.INVALID_DATE);
    });

    it("should return null for valid timestamp", () => {
      const filter: FilterOption = { field: "createdAt", op: "gte", value: "2024-01-01T00:00:00Z" };
      const error = validateFilter(filter, testSchema);
      expect(error).toBeNull();
    });

    it("should return error for non-array value with in operator", () => {
      const filter: FilterOption = { field: "name", op: "in", value: "single-value" as unknown as string[] };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.INVALID_IN);
    });

    it("should return error for empty array with in operator", () => {
      const filter: FilterOption = { field: "name", op: "in", value: [] };
      const error = validateFilter(filter, testSchema);
      expect(error).not.toBeNull();
      expect(error?.code).toBe(FilterErrorCode.INVALID_IN);
    });

    it("should return null for isNull operator", () => {
      const filter: FilterOption = { field: "deletedAt", op: "isNull", value: null };
      const error = validateFilter(filter, testSchema);
      expect(error).toBeNull();
    });

    it("should return null for isNotNull operator", () => {
      const filter: FilterOption = { field: "deletedAt", op: "isNotNull", value: null };
      const error = validateFilter(filter, testSchema);
      expect(error).toBeNull();
    });
  });

  describe("validateFilters", () => {
    it("should return valid result for all valid filters", () => {
      const filters: FilterOption[] = [
        { field: "name", op: "eq", value: "test" },
        { field: "status", op: "eq", value: "active" },
      ];
      const result = validateFilters(filters, testSchema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid result with errors", () => {
      const filters: FilterOption[] = [
        { field: "name", op: "eq", value: "test" },
        { field: "unknown", op: "eq", value: "value" },
        { field: "status", op: "ilike", value: "test" },
      ];
      const result = validateFilters(filters, testSchema);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should return valid for empty filters array", () => {
      const result = validateFilters([], testSchema);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("compileFilter", () => {
    it("should compile single eq filter", () => {
      const filters: FilterOption[] = [{ field: "name", op: "eq", value: "test" }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("name = $1");
      expect(result.params).toEqual(["test"]);
    });

    it("should compile multiple filters with AND", () => {
      const filters: FilterOption[] = [
        { field: "name", op: "eq", value: "test" },
        { field: "status", op: "eq", value: "active" },
      ];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("name = $1 AND status = $2");
      expect(result.params).toEqual(["test", "active"]);
    });

    it("should compile multiple filters with OR", () => {
      const filters: FilterOption[] = [
        { field: "name", op: "eq", value: "test" },
        { field: "status", op: "eq", value: "active" },
      ];
      const result = compileFilter(filters, testSchema, "or");
      expect(result.sql).toBe("name = $1 OR status = $2");
      expect(result.params).toEqual(["test", "active"]);
    });

    it("should compile neq filter", () => {
      const filters: FilterOption[] = [{ field: "name", op: "neq", value: "test" }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("name != $1");
    });

    it("should compile gt filter", () => {
      const filters: FilterOption[] = [{ field: "priority", op: "gt", value: 5 }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("priority > $1");
      expect(result.params).toEqual([5]);
    });

    it("should compile gte filter", () => {
      const filters: FilterOption[] = [{ field: "priority", op: "gte", value: 5 }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("priority >= $1");
    });

    it("should compile lt filter", () => {
      const filters: FilterOption[] = [{ field: "priority", op: "lt", value: 10 }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("priority < $1");
    });

    it("should compile lte filter", () => {
      const filters: FilterOption[] = [{ field: "priority", op: "lte", value: 10 }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("priority <= $1");
    });

    it("should compile in filter with ANY", () => {
      const filters: FilterOption[] = [{ field: "name", op: "in", value: ["a", "b", "c"] }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("name = ANY($1)");
      expect(result.params).toEqual([["a", "b", "c"]]);
    });

    it("should compile nin filter with ALL", () => {
      const filters: FilterOption[] = [{ field: "name", op: "in", value: ["a", "b"] }];
      const filtersNin: FilterOption[] = [{ field: "name", op: "nin", value: ["a", "b"] }];
      const resultNin = compileFilter(filtersNin, testSchema);
      expect(resultNin.sql).toBe("name != ALL($1)");
    });

    it("should compile like filter", () => {
      const filters: FilterOption[] = [{ field: "name", op: "ilike", value: "%test%" }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("name ILIKE $1");
      expect(result.params).toEqual(["%test%"]);
    });

    it("should compile contains filter with ILIKE and wrap value", () => {
      const schema: FilterSchema = {
        resource: "test",
        fields: {
          name: { column: "name", type: "string", operators: ["contains"] },
        },
      };
      const filters: FilterOption[] = [{ field: "name", op: "contains", value: "test" }];
      const result = compileFilter(filters, schema);
      expect(result.sql).toBe("name ILIKE $1");
      expect(result.params).toEqual(["%test%"]);
    });

    it("should compile isNull filter without param", () => {
      const filters: FilterOption[] = [{ field: "deletedAt", op: "isNull", value: null }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("deleted_at IS NULL");
      expect(result.params).toHaveLength(0);
    });

    it("should compile isNotNull filter without param", () => {
      const filters: FilterOption[] = [{ field: "deletedAt", op: "isNotNull", value: null }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("deleted_at IS NOT NULL");
      expect(result.params).toHaveLength(0);
    });

    it("should use column name from schema", () => {
      const filters: FilterOption[] = [{ field: "createdAt", op: "gte", value: "2024-01-01" }];
      const result = compileFilter(filters, testSchema);
      expect(result.sql).toBe("created_at >= $1");
    });

    it("should return empty result for empty filters", () => {
      const result = compileFilter([], testSchema);
      expect(result.sql).toBe("");
      expect(result.params).toHaveLength(0);
    });

    it("should throw error for unknown field", () => {
      const filters: FilterOption[] = [{ field: "unknown", op: "eq", value: "test" }];
      expect(() => compileFilter(filters, testSchema)).toThrow("Unknown field");
    });
  });

  describe("createFilterSchema", () => {
    it("should create schema with default operators", () => {
      const schema = createFilterSchema("users", {
        name: { column: "name", type: "string" },
        age: { column: "age", type: "number" },
      });

      expect(schema.resource).toBe("users");
      expect(schema.fields.name.operators).toContain("eq");
      expect(schema.fields.name.operators).toContain("ilike");
      expect(schema.fields.age.operators).toContain("gt");
      expect(schema.fields.age.operators).toContain("lte");
    });

    it("should use provided operators over defaults", () => {
      const schema = createFilterSchema("users", {
        name: { column: "name", type: "string", operators: ["eq"] },
      });

      expect(schema.fields.name.operators).toEqual(["eq"]);
    });

    it("should include version if provided", () => {
      const schema = createFilterSchema(
        "users",
        { name: { column: "name", type: "string" } },
        "2.0",
      );

      expect(schema.version).toBe("2.0");
    });
  });

  describe("loadFilterSchema", () => {
    it("should load valid schema from JSON", () => {
      const json = {
        resource: "applications",
        version: "1.0",
        fields: {
          name: {
            column: "name",
            type: "string",
            operators: ["eq", "ilike"],
            description: "Application name",
          },
        },
      };

      const schema = loadFilterSchema(json);
      expect(schema.resource).toBe("applications");
      expect(schema.version).toBe("1.0");
      expect(schema.fields.name.column).toBe("name");
      expect(schema.fields.name.type).toBe("string");
      expect(schema.fields.name.operators).toEqual(["eq", "ilike"]);
    });

    it("should throw error for non-object input", () => {
      expect(() => loadFilterSchema("not an object")).toThrow("expected object");
    });

    it("should throw error for missing resource", () => {
      expect(() => loadFilterSchema({ fields: {} })).toThrow("missing 'resource'");
    });

    it("should throw error for missing fields", () => {
      expect(() => loadFilterSchema({ resource: "test" })).toThrow("missing 'fields'");
    });

    it("should throw error for invalid field definition", () => {
      expect(() =>
        loadFilterSchema({
          resource: "test",
          fields: { name: "invalid" },
        }),
      ).toThrow("must be an object");
    });

    it("should throw error for field missing column", () => {
      expect(() =>
        loadFilterSchema({
          resource: "test",
          fields: { name: { type: "string", operators: ["eq"] } },
        }),
      ).toThrow("missing 'column'");
    });

    it("should throw error for field missing type", () => {
      expect(() =>
        loadFilterSchema({
          resource: "test",
          fields: { name: { column: "name", operators: ["eq"] } },
        }),
      ).toThrow("missing 'type'");
    });

    it("should throw error for field missing operators", () => {
      expect(() =>
        loadFilterSchema({
          resource: "test",
          fields: { name: { column: "name", type: "string" } },
        }),
      ).toThrow("missing 'operators'");
    });

    it("should load schema with enum values", () => {
      const json = {
        resource: "test",
        fields: {
          status: {
            column: "status",
            type: "enum",
            operators: ["eq"],
            enumValues: ["active", "disabled"],
          },
        },
      };

      const schema = loadFilterSchema(json);
      expect(schema.fields.status.enumValues).toEqual(["active", "disabled"]);
    });

    it("should load schema with nullable field", () => {
      const json = {
        resource: "test",
        fields: {
          deletedAt: {
            column: "deleted_at",
            type: "timestamp",
            operators: ["isNull"],
            nullable: true,
          },
        },
      };

      const schema = loadFilterSchema(json);
      expect(schema.fields.deletedAt.nullable).toBe(true);
    });
  });
});
