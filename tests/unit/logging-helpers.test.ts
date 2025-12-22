/**
 * Unit tests for logging-helpers utility
 */

import {
  extractLoggingContext,
  IndexedLoggingContext,
  HasKey,
  HasExternalSystem,
} from "../../src/utils/logging-helpers";

describe("logging-helpers", () => {
  describe("extractLoggingContext", () => {
    it("should extract source fields", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
        displayName: "PostgreSQL DB",
      };

      const result = extractLoggingContext({ source });

      expect(result).toEqual({
        sourceKey: "datasource-1",
        sourceDisplayName: "PostgreSQL DB",
      });
    });

    it("should extract source fields without displayName", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
      };

      const result = extractLoggingContext({ source });

      expect(result).toEqual({
        sourceKey: "datasource-1",
      });
    });

    it("should extract external system from source", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
        displayName: "PostgreSQL DB",
        externalSystem: {
          key: "system-1",
          displayName: "External System",
        },
      };

      const result = extractLoggingContext({ source });

      expect(result).toEqual({
        sourceKey: "datasource-1",
        sourceDisplayName: "PostgreSQL DB",
        externalSystemKey: "system-1",
        externalSystemDisplayName: "External System",
      });
    });

    it("should extract external system without displayName from source", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
        externalSystem: {
          key: "system-1",
        },
      };

      const result = extractLoggingContext({ source });

      expect(result).toEqual({
        sourceKey: "datasource-1",
        externalSystemKey: "system-1",
      });
    });

    it("should extract record fields", () => {
      const record: HasKey = {
        key: "record-123",
        displayName: "User Profile",
      };

      const result = extractLoggingContext({ record });

      expect(result).toEqual({
        recordKey: "record-123",
        recordDisplayName: "User Profile",
      });
    });

    it("should extract record fields without displayName", () => {
      const record: HasKey = {
        key: "record-123",
      };

      const result = extractLoggingContext({ record });

      expect(result).toEqual({
        recordKey: "record-123",
      });
    });

    it("should extract external system directly when provided", () => {
      const externalSystem: HasKey = {
        key: "system-2",
        displayName: "Direct External System",
      };

      const result = extractLoggingContext({ externalSystem });

      expect(result).toEqual({
        externalSystemKey: "system-2",
        externalSystemDisplayName: "Direct External System",
      });
    });

    it("should override source external system with direct external system", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
        externalSystem: {
          key: "system-1",
          displayName: "Source External System",
        },
      };
      const externalSystem: HasKey = {
        key: "system-2",
        displayName: "Direct External System",
      };

      const result = extractLoggingContext({ source, externalSystem });

      expect(result).toEqual({
        sourceKey: "datasource-1",
        externalSystemKey: "system-2",
        externalSystemDisplayName: "Direct External System",
      });
    });

    it("should combine all fields", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
        displayName: "PostgreSQL DB",
        externalSystem: {
          key: "system-1",
          displayName: "External System",
        },
      };
      const record: HasKey = {
        key: "record-123",
        displayName: "User Profile",
      };

      const result = extractLoggingContext({ source, record });

      expect(result).toEqual({
        sourceKey: "datasource-1",
        sourceDisplayName: "PostgreSQL DB",
        externalSystemKey: "system-1",
        externalSystemDisplayName: "External System",
        recordKey: "record-123",
        recordDisplayName: "User Profile",
      });
    });

    it("should return empty object when no options provided", () => {
      const result = extractLoggingContext({});

      expect(result).toEqual({});
    });

    it("should handle null/undefined values gracefully", () => {
      const result = extractLoggingContext({
        source: undefined,
        record: undefined,
        externalSystem: undefined,
      });

      expect(result).toEqual({});
    });

    it("should handle empty strings in keys", () => {
      const source: HasExternalSystem = {
        key: "",
        displayName: "Empty Key Source",
      };

      const result = extractLoggingContext({ source });

      expect(result).toEqual({
        sourceKey: "",
        sourceDisplayName: "Empty Key Source",
      });
    });

    it("should handle empty strings in displayNames", () => {
      const source: HasExternalSystem = {
        key: "datasource-1",
        displayName: "",
      };

      const result = extractLoggingContext({ source });

      expect(result).toEqual({
        sourceKey: "datasource-1",
        sourceDisplayName: "",
      });
    });
  });
});

