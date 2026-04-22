/**
 * Unit tests for DataMasker utility
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { DataMasker } from "../../src/utils/data-masker";

describe("DataMasker", () => {
  describe("isSensitiveField", () => {
    it("should detect sensitive fields by exact match", () => {
      expect(DataMasker.isSensitiveField("password")).toBe(true);
      expect(DataMasker.isSensitiveField("token")).toBe(true);
      expect(DataMasker.isSensitiveField("secret")).toBe(true);
      expect(DataMasker.isSensitiveField("apiKey")).toBe(true);
    });

    it("should detect sensitive fields with variations", () => {
      expect(DataMasker.isSensitiveField("user_password")).toBe(true);
      expect(DataMasker.isSensitiveField("api_token")).toBe(true);
      expect(DataMasker.isSensitiveField("secret_key")).toBe(true);
    });

    it("should detect fields containing sensitive keywords", () => {
      expect(DataMasker.isSensitiveField("mysecret")).toBe(true);
      expect(DataMasker.isSensitiveField("hashtoken")).toBe(true);
    });

    it("should handle underscore and hyphen variations", () => {
      expect(DataMasker.isSensitiveField("user-password")).toBe(true);
      expect(DataMasker.isSensitiveField("api_token")).toBe(true);
      expect(DataMasker.isSensitiveField("se-cret")).toBe(true);
    });

    it("should return false for non-sensitive fields", () => {
      expect(DataMasker.isSensitiveField("username")).toBe(false);
      expect(DataMasker.isSensitiveField("email")).toBe(false);
      expect(DataMasker.isSensitiveField("name")).toBe(false);
      expect(DataMasker.isSensitiveField("description")).toBe(false);
    });

    it("should not treat bare key or success as sensitive (neverMaskFields)", () => {
      expect(DataMasker.isSensitiveField("key")).toBe(false);
      expect(DataMasker.isSensitiveField("success")).toBe(false);
    });
  });

  describe("maskSensitiveData", () => {
    it("should mask sensitive fields in objects", () => {
      const data = {
        username: "john",
        password: "secret123",
        email: "john@example.com",
      };

      const masked = DataMasker.maskSensitiveData(data);

      expect(masked).toEqual({
        username: "john",
        password: "***MASKED***",
        email: "john@example.com",
      });
    });

    it("should handle nested objects", () => {
      const data = {
        user: {
          name: "John",
          password: "secret123",
        },
        api_token: "abc123",
      };

      const masked = DataMasker.maskSensitiveData(data);

      expect(masked).toEqual({
        user: {
          name: "John",
          password: "***MASKED***",
        },
        api_token: "***MASKED***",
      });
    });

    it("should handle arrays", () => {
      const data = [
        { name: "User1", password: "pass1" },
        { name: "User2", token: "token2" },
      ];

      const masked = DataMasker.maskSensitiveData(data);

      expect(masked).toEqual([
        { name: "User1", password: "***MASKED***" },
        { name: "User2", token: "***MASKED***" },
      ]);
    });

    it("should handle null and undefined", () => {
      expect(DataMasker.maskSensitiveData(null)).toBe(null);
      expect(DataMasker.maskSensitiveData(undefined)).toBe(undefined);
    });

    it("should handle primitives", () => {
      expect(DataMasker.maskSensitiveData("string")).toBe("string");
      expect(DataMasker.maskSensitiveData(123)).toBe(123);
      expect(DataMasker.maskSensitiveData(true)).toBe(true);
    });

    it("should handle complex nested structures", () => {
      const data = {
        users: [
          { name: "User1", password: "pass1" },
          { name: "User2", api_token: "token2" },
        ],
        metadata: {
          api_key: "secret-key",
          public: "visible",
        },
      };

      const masked = DataMasker.maskSensitiveData(data);

      expect(masked).toEqual({
        users: [
          { name: "User1", password: "***MASKED***" },
          { name: "User2", api_token: "***MASKED***" },
        ],
        metadata: {
          api_key: "***MASKED***",
          public: "visible",
        },
      });
    });

    it("should not modify the original data", () => {
      const data = { password: "secret" };
      const original = JSON.stringify(data);

      DataMasker.maskSensitiveData(data);

      expect(JSON.stringify(data)).toBe(original);
    });

    it("should use per-call configPath without changing global cache", () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "miso-mask-"));
      const cfgPath = path.join(dir, "mask.json");
      fs.writeFileSync(
        cfgPath,
        JSON.stringify({
          mergeWithHardcodedDefaults: false,
          substringMinLength: 4,
          neverMaskFields: [],
          fields: { custom: ["onlycustomfield"] },
          fieldPatterns: [],
        }),
        "utf8",
      );

      expect(DataMasker.isSensitiveField("onlycustomfield")).toBe(false);

      const masked = DataMasker.maskSensitiveData(
        { onlycustomfield: "x", password: "y" },
        { configPath: cfgPath },
      ) as Record<string, unknown>;

      expect(masked.onlycustomfield).toBe("***MASKED***");
      expect(masked.password).toBe("y");

      expect(DataMasker.isSensitiveField("onlycustomfield")).toBe(false);

      fs.unlinkSync(cfgPath);
      fs.rmdirSync(dir);
    });

    it("should fall back to global masking when per-call configPath is missing", () => {
      const masked = DataMasker.maskSensitiveData(
        { password: "secret" },
        { configPath: "/nonexistent/miso-sensitive.json" },
      ) as Record<string, unknown>;
      expect(masked.password).toBe("***MASKED***");
    });
  });

  describe("maskValue", () => {
    it("should mask entire value when no parts shown (min 8 asterisks)", () => {
      expect(DataMasker.maskValue("secret123")).toBe("*********");
      expect(DataMasker.maskValue("verylongsecretkey")).toBe(
        "*****************",
      );
    });

    it("should show first few characters", () => {
      const masked = DataMasker.maskValue("secret123", 2, 0);
      expect(masked.length).toBeGreaterThan(0);
      expect(masked).toContain("se");
    });

    it("should show last few characters", () => {
      const masked = DataMasker.maskValue("secret123", 0, 2);
      expect(masked.length).toBeGreaterThan(0);
      expect(masked).toContain("23");
    });

    it("should show first and last characters", () => {
      const masked = DataMasker.maskValue("secret123", 2, 2);
      expect(masked).toMatch(/^se.*23$/);
    });

    it("should return MASKED for short values", () => {
      expect(DataMasker.maskValue("ab", 1, 1)).toBe("***MASKED***");
      expect(DataMasker.maskValue("a", 1, 1)).toBe("***MASKED***");
    });

    it("should handle empty strings", () => {
      expect(DataMasker.maskValue("")).toBe("***MASKED***");
    });

    it("should use at least 8 asterisks for the masked middle segment", () => {
      const masked = DataMasker.maskValue("verylongstring", 0, 0);
      expect(masked).toBe("*".repeat("verylongstring".length));
    });
  });

  describe("containsSensitiveData", () => {
    it("should detect sensitive fields", () => {
      expect(DataMasker.containsSensitiveData({ password: "secret" })).toBe(
        true,
      );
      expect(DataMasker.containsSensitiveData({ api_token: "token" })).toBe(
        true,
      );
      expect(DataMasker.containsSensitiveData({ secret_key: "key" })).toBe(
        true,
      );
    });

    it("should return false for non-sensitive data", () => {
      expect(DataMasker.containsSensitiveData({ username: "john" })).toBe(
        false,
      );
      expect(
        DataMasker.containsSensitiveData({ email: "test@example.com" }),
      ).toBe(false);
    });

    it("should detect nested sensitive fields", () => {
      const data = {
        user: {
          name: "John",
          password: "secret",
        },
      };

      expect(DataMasker.containsSensitiveData(data)).toBe(true);
    });

    it("should handle arrays", () => {
      expect(
        DataMasker.containsSensitiveData([
          { name: "User1", password: "pass1" },
          { name: "User2" },
        ]),
      ).toBe(true);
      expect(DataMasker.containsSensitiveData([{ name: "User1" }])).toBe(false);
    });

    it("should return false for null and undefined", () => {
      expect(DataMasker.containsSensitiveData(null)).toBe(false);
      expect(DataMasker.containsSensitiveData(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(DataMasker.containsSensitiveData("string")).toBe(false);
      expect(DataMasker.containsSensitiveData(123)).toBe(false);
      expect(DataMasker.containsSensitiveData(true)).toBe(false);
    });

    it("should detect multiple sensitive fields", () => {
      const data = {
        api_key: "key",
        user_password: "pass",
        api_token: "token",
      };

      expect(DataMasker.containsSensitiveData(data)).toBe(true);
    });
  });

  describe("setConfigPath", () => {
    beforeEach(() => {
      DataMasker.setConfigPath(undefined);
    });

    afterEach(() => {
      DataMasker.setConfigPath(undefined);
    });

    it("should set custom config path", () => {
      DataMasker.setConfigPath("/custom/path/config.json");
      expect(DataMasker.isSensitiveField("password")).toBe(true);
    });

    it("should clear cache when config path changes", () => {
      expect(DataMasker.isSensitiveField("password")).toBe(true);
      DataMasker.setConfigPath("/custom/path/config.json");
      expect(DataMasker.isSensitiveField("password")).toBe(true);
    });

    it("should handle undefined config path", () => {
      DataMasker.setConfigPath(undefined);
      expect(DataMasker.isSensitiveField("password")).toBe(true);
    });
  });

  describe("cache invalidation", () => {
    it("should reload fields when config path changes", () => {
      expect(DataMasker.isSensitiveField("password")).toBe(true);
      expect(DataMasker.isSensitiveField("email")).toBe(false);
      DataMasker.setConfigPath("/new/path/config.json");
      expect(DataMasker.isSensitiveField("password")).toBe(true);
    });

    it("should cache field set after first use", () => {
      const result1 = DataMasker.isSensitiveField("password");
      expect(result1).toBe(true);
      const result2 = DataMasker.isSensitiveField("password");
      expect(result2).toBe(true);
    });
  });
});
