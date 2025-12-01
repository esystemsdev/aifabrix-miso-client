/**
 * Unit tests for sort utilities
 */

import {
  parseSortParams,
  applySorting,
  SortOption,
} from "../../src/utils/sort.utils";

describe("sort.utils", () => {
  describe("parseSortParams()", () => {
    it("should parse single ascending sort", () => {
      const result = parseSortParams({ sort: "name" });

      expect(result).toEqual([{ field: "name", order: "asc" }]);
    });

    it("should parse single descending sort with minus prefix", () => {
      const result = parseSortParams({ sort: "-createdAt" });

      expect(result).toEqual([{ field: "createdAt", order: "desc" }]);
    });

    it("should parse multiple sort fields", () => {
      const result = parseSortParams({ sort: ["-createdAt", "name"] });

      expect(result).toEqual([
        { field: "createdAt", order: "desc" },
        { field: "name", order: "asc" },
      ]);
    });

    it("should parse colon-separated sort format (field:asc)", () => {
      const result = parseSortParams({ sort: "name:asc" });

      expect(result).toEqual([{ field: "name", order: "asc" }]);
    });

    it("should parse colon-separated descending sort (field:desc)", () => {
      const result = parseSortParams({ sort: "createdAt:desc" });

      expect(result).toEqual([{ field: "createdAt", order: "desc" }]);
    });

    it("should handle mixed formats", () => {
      const result = parseSortParams({
        sort: ["-updatedAt", "name:asc", "age"],
      });

      expect(result).toEqual([
        { field: "updatedAt", order: "desc" },
        { field: "name", order: "asc" },
        { field: "age", order: "asc" },
      ]);
    });

    it("should return empty array when sort is not provided", () => {
      const result = parseSortParams({});

      expect(result).toEqual([]);
    });

    it("should return empty array when sort is empty string", () => {
      const result = parseSortParams({ sort: "" });

      expect(result).toEqual([]);
    });

    it("should return empty array when sort is empty array", () => {
      const result = parseSortParams({ sort: [] });

      expect(result).toEqual([]);
    });

    it("should handle sort as string array", () => {
      const result = parseSortParams({ sort: ["name", "-age", "email:asc"] });

      expect(result).toEqual([
        { field: "name", order: "asc" },
        { field: "age", order: "desc" },
        { field: "email", order: "asc" },
      ]);
    });

    it("should ignore invalid sort values", () => {
      const result = parseSortParams({ sort: ["", "  ", "-", ":"] });

      expect(result).toEqual([]);
    });

    it("should handle camelCase field names", () => {
      const result = parseSortParams({ sort: ["-createdAt", "firstName"] });

      expect(result).toEqual([
        { field: "createdAt", order: "desc" },
        { field: "firstName", order: "asc" },
      ]);
    });

    it("should handle snake_case field names", () => {
      const result = parseSortParams({ sort: ["-created_at", "first_name"] });

      expect(result).toEqual([
        { field: "created_at", order: "desc" },
        { field: "first_name", order: "asc" },
      ]);
    });

    it("should handle dot notation for nested fields", () => {
      const result = parseSortParams({
        sort: ["user.name", "-post.createdAt"],
      });

      expect(result).toEqual([
        { field: "user.name", order: "asc" },
        { field: "post.createdAt", order: "desc" },
      ]);
    });

    it("should trim whitespace from field names", () => {
      const result = parseSortParams({ sort: ["  name  ", "  -age  "] });

      expect(result).toEqual([
        { field: "name", order: "asc" },
        { field: "age", order: "desc" },
      ]);
    });
  });

  describe("applySorting()", () => {
    it("should sort array by single ascending field", () => {
      const data = [
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
      ];
      const sortOptions: SortOption[] = [{ field: "name", order: "asc" }];

      const result = applySorting(data, sortOptions);

      expect(result).toEqual([
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
        { name: "Charlie", age: 30 },
      ]);
    });

    it("should sort array by single descending field", () => {
      const data = [
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
        { name: "Charlie", age: 30 },
      ];
      const sortOptions: SortOption[] = [{ field: "age", order: "desc" }];

      const result = applySorting(data, sortOptions);

      expect(result).toEqual([
        { name: "Bob", age: 35 },
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
      ]);
    });

    it("should sort by multiple fields", () => {
      const data = [
        { department: "Sales", name: "Charlie", age: 30 },
        { department: "Sales", name: "Alice", age: 25 },
        { department: "IT", name: "Bob", age: 35 },
        { department: "IT", name: "David", age: 28 },
      ];
      const sortOptions: SortOption[] = [
        { field: "department", order: "asc" },
        { field: "name", order: "asc" },
      ];

      const result = applySorting(data, sortOptions);

      expect(result).toEqual([
        { department: "IT", name: "Bob", age: 35 },
        { department: "IT", name: "David", age: 28 },
        { department: "Sales", name: "Alice", age: 25 },
        { department: "Sales", name: "Charlie", age: 30 },
      ]);
    });

    it("should handle null values (null at the end)", () => {
      const data = [
        { name: "Alice", score: 100 },
        { name: "Bob", score: null },
        { name: "Charlie", score: 50 },
      ];
      const sortOptions: SortOption[] = [{ field: "score", order: "asc" }];

      const result = applySorting(data, sortOptions);

      expect(result[0].name).toBe("Charlie");
      expect(result[1].name).toBe("Alice");
      expect(result[2].name).toBe("Bob"); // null should be at the end
    });

    it("should handle undefined values (undefined at the end)", () => {
      const data = [
        { name: "Alice", score: 100 },
        { name: "Bob", score: undefined },
        { name: "Charlie", score: 50 },
      ];
      const sortOptions: SortOption[] = [{ field: "score", order: "asc" }];

      const result = applySorting(data, sortOptions);

      expect(result[0].name).toBe("Charlie");
      expect(result[1].name).toBe("Alice");
      expect(result[2].name).toBe("Bob"); // undefined should be at the end
    });

    it("should not mutate original array", () => {
      const data = [
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
        { name: "Bob", age: 35 },
      ];
      const original = [...data];
      const sortOptions: SortOption[] = [{ field: "name", order: "asc" }];

      applySorting(data, sortOptions);

      expect(data).toEqual(original);
    });

    it("should return original array when sortOptions is empty", () => {
      const data = [
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 25 },
      ];

      const result = applySorting(data, []);

      expect(result).toEqual(data);
    });

    it("should handle empty data array", () => {
      const result = applySorting([], [{ field: "name", order: "asc" }]);

      expect(result).toEqual([]);
    });

    it("should sort numbers correctly", () => {
      const data = [{ id: 10 }, { id: 2 }, { id: 100 }, { id: 20 }];
      const sortOptions: SortOption[] = [{ field: "id", order: "asc" }];

      const result = applySorting(data, sortOptions);

      expect(result).toEqual([{ id: 2 }, { id: 10 }, { id: 20 }, { id: 100 }]);
    });

    it("should sort strings case-sensitively", () => {
      const data = [
        { name: "zebra" },
        { name: "Apple" },
        { name: "banana" },
        { name: "Zebra" },
      ];
      const sortOptions: SortOption[] = [{ field: "name", order: "asc" }];

      const result = applySorting(data, sortOptions);

      // Capital letters come before lowercase in ASCII
      expect(result[0].name).toBe("Apple");
      expect(result[1].name).toBe("Zebra");
      expect(result[2].name).toBe("banana");
      expect(result[3].name).toBe("zebra");
    });

    it("should sort dates correctly", () => {
      const data = [
        { date: new Date("2023-03-15") },
        { date: new Date("2023-01-10") },
        { date: new Date("2023-12-25") },
      ];
      const sortOptions: SortOption[] = [{ field: "date", order: "asc" }];

      const result = applySorting(data, sortOptions);

      expect(result[0].date.toISOString()).toContain("2023-01-10");
      expect(result[1].date.toISOString()).toContain("2023-03-15");
      expect(result[2].date.toISOString()).toContain("2023-12-25");
    });

    it("should handle mixed types gracefully", () => {
      const data = [
        { value: "10" },
        { value: 5 },
        { value: "2" },
        { value: 20 },
      ];
      const sortOptions: SortOption[] = [{ field: "value", order: "asc" }];

      const result = applySorting(data, sortOptions);

      // Should return sorted array (exact order depends on JS comparison)
      // The key is that it doesn't throw and returns a result
      expect(result).toHaveLength(4);
      expect(result).toContain(data[0]);
      expect(result).toContain(data[1]);
      expect(result).toContain(data[2]);
      expect(result).toContain(data[3]);
    });

    it("should maintain stable sort for equal values", () => {
      const data = [
        { name: "Alice", id: 1 },
        { name: "Bob", id: 2 },
        { name: "Alice", id: 3 },
        { name: "Alice", id: 4 },
      ];
      const sortOptions: SortOption[] = [{ field: "name", order: "asc" }];

      const result = applySorting(data, sortOptions);

      // All Alices should maintain their original order
      const alices = result.filter((item) => item.name === "Alice");
      expect(alices[0].id).toBe(1);
      expect(alices[1].id).toBe(3);
      expect(alices[2].id).toBe(4);
    });
  });

  describe("Integration: parseSortParams + applySorting", () => {
    it("should work together to sort data from query string", () => {
      const query = { sort: ["-age", "name"] };
      const data = [
        { name: "Charlie", age: 30 },
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
        { name: "David", age: 35 },
      ];

      const sortOptions = parseSortParams(query);
      const result = applySorting(data, sortOptions);

      expect(result).toEqual([
        { name: "David", age: 35 },
        { name: "Alice", age: 30 },
        { name: "Charlie", age: 30 },
        { name: "Bob", age: 25 },
      ]);
    });

    it("should handle no sort parameter", () => {
      const query = {};
      const data = [{ id: 3 }, { id: 1 }, { id: 2 }];

      const sortOptions = parseSortParams(query);
      const result = applySorting(data, sortOptions);

      // Should maintain original order
      expect(result).toEqual(data);
    });

    it("should work with real-world user data", () => {
      const query = { sort: ["-createdAt", "email"] };
      const users = [
        { email: "bob@example.com", createdAt: "2023-01-15" },
        { email: "alice@example.com", createdAt: "2023-01-15" },
        { email: "charlie@example.com", createdAt: "2023-03-20" },
        { email: "david@example.com", createdAt: "2023-02-10" },
      ];

      const sortOptions = parseSortParams(query);
      const result = applySorting(users, sortOptions);

      expect(result).toEqual([
        { email: "charlie@example.com", createdAt: "2023-03-20" },
        { email: "david@example.com", createdAt: "2023-02-10" },
        { email: "alice@example.com", createdAt: "2023-01-15" },
        { email: "bob@example.com", createdAt: "2023-01-15" },
      ]);
    });
  });
});
