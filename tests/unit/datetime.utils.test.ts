/**
 * Unit tests for datetime formatting utilities.
 */

import {
  createDateTimeFormatter,
  formatDate,
  formatDateTime,
  formatTime,
} from "../../src/utils/datetime.utils";

describe("datetime.utils", () => {
  const isoValue = "2026-07-21T13:20:36.123Z";

  describe("formatDateTime", () => {
    it("returns fallback for null/undefined/empty values", () => {
      expect(formatDateTime(null)).toBe("-");
      expect(formatDateTime(undefined)).toBe("-");
      expect(formatDateTime("")).toBe("-");
      expect(formatDateTime("   ")).toBe("-");
      expect(formatDateTime("-")).toBe("-");
    });

    it("returns original trimmed string for invalid datetime string input", () => {
      expect(formatDateTime("  invalid-value  ")).toBe("invalid-value");
    });

    it("returns fallback for invalid numeric/date input", () => {
      expect(formatDateTime(Number.NaN)).toBe("-");
      expect(formatDateTime(new Date(Number.NaN))).toBe("-");
    });

    it("formats ISO value using explicit locale/timezone options", () => {
      const result = formatDateTime(isoValue, {
        locale: "en-GB",
        timeZone: "UTC",
        includeSeconds: true,
        use24Hour: true,
      });

      const expected = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }).format(new Date(isoValue));

      expect(result).toBe(expected);
    });

    it("produces locale-specific output differences when locale changes", () => {
      const ptValue = formatDateTime(isoValue, {
        locale: "pt-PT",
        timeZone: "UTC",
        includeSeconds: true,
        use24Hour: true,
      });
      const fiValue = formatDateTime(isoValue, {
        locale: "fi-FI",
        timeZone: "UTC",
        includeSeconds: true,
        use24Hour: true,
      });

      expect(ptValue).not.toBe(fiValue);
    });

    it("applies timezone override when provided", () => {
      const utcValue = formatDateTime(isoValue, {
        locale: "en-GB",
        timeZone: "UTC",
        includeSeconds: true,
        use24Hour: true,
      });
      const helsinkiValue = formatDateTime(isoValue, {
        locale: "en-GB",
        timeZone: "Europe/Helsinki",
        includeSeconds: true,
        use24Hour: true,
      });

      expect(utcValue).not.toBe(helsinkiValue);
    });
  });

  describe("formatDate", () => {
    it("formats date-only representation", () => {
      const result = formatDate(isoValue, {
        locale: "en-GB",
        timeZone: "UTC",
        dateFormat: "short",
      });

      const expected = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
      }).format(new Date(isoValue));

      expect(result).toBe(expected);
    });
  });

  describe("formatTime", () => {
    it("formats time-only representation with seconds when requested", () => {
      const result = formatTime(isoValue, {
        locale: "en-GB",
        timeZone: "UTC",
        includeSeconds: true,
        use24Hour: true,
      });

      const expected = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }).format(new Date(isoValue));

      expect(result).toBe(expected);
    });
  });

  describe("createDateTimeFormatter", () => {
    it("matches one-off formatDateTime behavior for same options", () => {
      const options = {
        locale: "en-GB",
        timeZone: "UTC",
        includeSeconds: true,
        use24Hour: true,
      } as const;

      const formatter = createDateTimeFormatter(options);
      const factoryValue = formatter(isoValue);
      const oneOffValue = formatDateTime(isoValue, options);

      expect(factoryValue).toBe(oneOffValue);
    });
  });
});
