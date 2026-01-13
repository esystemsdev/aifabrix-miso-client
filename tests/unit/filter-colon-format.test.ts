/**
 * Unit tests for colon format filter parsing
 */

import { parseFilterParams } from "../../src/utils/filter.utils";

describe("filter.utils - Colon Format", () => {
  describe("parseFilterParams with colon format", () => {
    it("should parse simple colon format filter", () => {
      const result = parseFilterParams({ filter: "status:eq:active" });
      expect(result).toEqual([{ field: "status", op: "eq", value: "active" }]);
    });

    it("should parse colon format with number value", () => {
      const result = parseFilterParams({ filter: "age:gte:18" });
      expect(result).toEqual([{ field: "age", op: "gte", value: 18 }]);
    });

    it("should parse colon format with boolean true value", () => {
      const result = parseFilterParams({ filter: "active:eq:true" });
      expect(result).toEqual([{ field: "active", op: "eq", value: true }]);
    });

    it("should parse colon format with boolean false value", () => {
      const result = parseFilterParams({ filter: "active:eq:false" });
      expect(result).toEqual([{ field: "active", op: "eq", value: false }]);
    });

    it("should parse colon format with in operator (array)", () => {
      const result = parseFilterParams({ filter: "region:in:eu,us,uk" });
      expect(result).toEqual([{ field: "region", op: "in", value: ["eu", "us", "uk"] }]);
    });

    it("should parse colon format with nin operator (array)", () => {
      const result = parseFilterParams({ filter: "status:nin:deleted,archived" });
      expect(result).toEqual([{ field: "status", op: "nin", value: ["deleted", "archived"] }]);
    });

    it("should parse colon format with in operator and numeric values", () => {
      const result = parseFilterParams({ filter: "priority:in:1,2,3" });
      expect(result).toEqual([{ field: "priority", op: "in", value: [1, 2, 3] }]);
    });

    it("should parse colon format with isNull operator (empty value)", () => {
      const result = parseFilterParams({ filter: "deletedAt:isNull:" });
      expect(result).toEqual([{ field: "deletedAt", op: "isNull", value: null }]);
    });

    it("should parse colon format with isNotNull operator", () => {
      const result = parseFilterParams({ filter: "email:isNotNull:" });
      expect(result).toEqual([{ field: "email", op: "isNotNull", value: null }]);
    });

    it("should parse colon format with isNull without trailing colon", () => {
      const result = parseFilterParams({ filter: "deletedAt:isNull" });
      expect(result).toEqual([{ field: "deletedAt", op: "isNull", value: null }]);
    });

    it("should preserve colons in timestamp values", () => {
      const result = parseFilterParams({ filter: "createdAt:gte:2024-01-01T12:00:00" });
      expect(result).toEqual([{ field: "createdAt", op: "gte", value: "2024-01-01T12:00:00" }]);
    });

    it("should preserve colons in ISO timestamp values", () => {
      const result = parseFilterParams({ filter: "updatedAt:lte:2024-12-31T23:59:59.999Z" });
      expect(result).toEqual([{ field: "updatedAt", op: "lte", value: "2024-12-31T23:59:59.999Z" }]);
    });

    it("should parse colon format with ilike operator", () => {
      const result = parseFilterParams({ filter: "name:ilike:%test%" });
      expect(result).toEqual([{ field: "name", op: "ilike", value: "%test%" }]);
    });

    it("should parse colon format with like operator", () => {
      const result = parseFilterParams({ filter: "name:like:test%" });
      expect(result).toEqual([{ field: "name", op: "like", value: "test%" }]);
    });

    it("should parse colon format with contains operator", () => {
      const result = parseFilterParams({ filter: "description:contains:important" });
      expect(result).toEqual([{ field: "description", op: "contains", value: "important" }]);
    });

    it("should parse array of colon format filters", () => {
      const result = parseFilterParams({
        filter: ["status:eq:active", "region:in:eu,us"],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ field: "status", op: "eq", value: "active" });
      expect(result[1]).toEqual({ field: "region", op: "in", value: ["eu", "us"] });
    });

    it("should parse mixed array of colon and JSON formats", () => {
      const result = parseFilterParams({
        filter: ["status:eq:active", '{"age": {"gte": 18}}'],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ field: "status", op: "eq", value: "active" });
      expect(result[1]).toEqual({ field: "age", op: "gte", value: 18 });
    });

    it("should handle null string value as null", () => {
      const result = parseFilterParams({ filter: "status:eq:null" });
      expect(result).toEqual([{ field: "status", op: "eq", value: null }]);
    });

    it("should handle empty in operator as empty array", () => {
      const result = parseFilterParams({ filter: "tags:in:" });
      expect(result).toEqual([{ field: "tags", op: "in", value: [] }]);
    });

    it("should trim whitespace from array values", () => {
      const result = parseFilterParams({ filter: "region:in: eu , us , uk " });
      expect(result).toEqual([{ field: "region", op: "in", value: ["eu", "us", "uk"] }]);
    });

    it("should throw error for missing field name", () => {
      expect(() => parseFilterParams({ filter: ":eq:value" })).toThrow("missing field name");
    });

    it("should throw error for missing operator", () => {
      expect(() => parseFilterParams({ filter: "field:" })).toThrow("missing operator");
    });

    it("should throw error for missing value on non-null operators", () => {
      expect(() => parseFilterParams({ filter: "status:eq:" })).toThrow("missing value");
    });

    it("should normalize operator aliases in colon format", () => {
      const result = parseFilterParams({ filter: "status:equals:active" });
      expect(result).toEqual([{ field: "status", op: "eq", value: "active" }]);
    });

    it("should handle field names with dots", () => {
      const result = parseFilterParams({ filter: "user.name:eq:John" });
      expect(result).toEqual([{ field: "user.name", op: "eq", value: "John" }]);
    });

    it("should handle special characters in values", () => {
      const result = parseFilterParams({ filter: "name:eq:John O'Brien" });
      expect(result).toEqual([{ field: "name", op: "eq", value: "John O'Brien" }]);
    });

    it("should handle UUID values", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const result = parseFilterParams({ filter: `id:eq:${uuid}` });
      expect(result).toEqual([{ field: "id", op: "eq", value: uuid }]);
    });

    it("should prefer JSON format when string starts with {", () => {
      const result = parseFilterParams({ filter: '{"status": {"eq": "active"}}' });
      expect(result).toEqual([{ field: "status", op: "eq", value: "active" }]);
    });

    it("should prefer JSON format when string starts with [", () => {
      const result = parseFilterParams({ filter: '[{"status": {"eq": "active"}}]' });
      expect(result).toEqual([{ field: "status", op: "eq", value: "active" }]);
    });
  });

  describe("colon format vs JSON format detection", () => {
    it("should detect colon format for simple filter", () => {
      const colonResult = parseFilterParams({ filter: "status:eq:active" });
      const jsonResult = parseFilterParams({ filter: '{"status": {"eq": "active"}}' });
      expect(colonResult).toEqual(jsonResult);
    });

    it("should produce equivalent results for both formats", () => {
      const colonResult = parseFilterParams({
        filter: ["status:eq:active", "region:in:eu,us"],
      });
      const jsonResult = parseFilterParams({
        filter: { status: { eq: "active" }, region: { in: ["eu", "us"] } },
      });
      expect(colonResult).toEqual(jsonResult);
    });
  });
});
