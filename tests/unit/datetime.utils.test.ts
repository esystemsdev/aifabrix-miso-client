/**
 * Unit tests for datetime formatting utilities.
 */

import {
  createDateTimeFormatter,
  formatDate,
  formatDateTime,
  formatLogDateTimeUtcFixed,
  formatTime,
  parseIsoTimestampMs,
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

  describe("formatLogDateTimeUtcFixed", () => {
    it("formats valid datetime to fixed UTC pattern", () => {
      expect(formatLogDateTimeUtcFixed("2026-06-12T17:14:01.690Z")).toBe(
        "12/06/2026, 17:14:01",
      );
      expect(formatLogDateTimeUtcFixed("2026-01-01T00:00:00Z")).toBe(
        "01/01/2026, 00:00:00",
      );
    });

    it("normalizes sub-millisecond fractions for parsing", () => {
      expect(formatLogDateTimeUtcFixed("2026-05-29T09:18:33.080980Z")).toBe(
        "29/05/2026, 09:18:33",
      );
    });

    it("preserves invalid non-empty string as trimmed original", () => {
      expect(formatLogDateTimeUtcFixed("  not-a-date  ")).toBe("not-a-date");
    });

    it("returns fallback for empty values and invalid numeric/date inputs", () => {
      expect(formatLogDateTimeUtcFixed(null)).toBe("-");
      expect(formatLogDateTimeUtcFixed(undefined)).toBe("-");
      expect(formatLogDateTimeUtcFixed("")).toBe("-");
      expect(formatLogDateTimeUtcFixed("   ")).toBe("-");
      expect(formatLogDateTimeUtcFixed("-")).toBe("-");
      expect(formatLogDateTimeUtcFixed(Number.NaN)).toBe("-");
      expect(formatLogDateTimeUtcFixed(new Date(Number.NaN))).toBe("-");
    });

    it("supports custom fallback value", () => {
      expect(formatLogDateTimeUtcFixed(null, { fallback: "n/a" })).toBe("n/a");
      expect(formatLogDateTimeUtcFixed(Number.NaN, { fallback: "n/a" })).toBe(
        "n/a",
      );
    });
  });

  describe("parseIsoTimestampMs", () => {
    it("returns 0 for null, undefined, placeholders, and invalid values", () => {
      expect(parseIsoTimestampMs(null)).toBe(0);
      expect(parseIsoTimestampMs(undefined)).toBe(0);
      expect(parseIsoTimestampMs("")).toBe(0);
      expect(parseIsoTimestampMs("   ")).toBe(0);
      expect(parseIsoTimestampMs("-")).toBe(0);
      expect(parseIsoTimestampMs("not-a-date")).toBe(0);
      expect(parseIsoTimestampMs(Number.NaN)).toBe(0);
      expect(parseIsoTimestampMs(new Date(Number.NaN))).toBe(0);
    });

    it("parses ISO strings including sub-millisecond fractions", () => {
      expect(parseIsoTimestampMs("2026-05-29T09:18:33.080980Z")).toBe(
        Date.parse("2026-05-29T09:18:33.080Z"),
      );
    });

    it("parses valid number and Date inputs", () => {
      const value = Date.parse("2026-07-21T13:20:36.123Z");
      expect(parseIsoTimestampMs(value)).toBe(value);
      expect(parseIsoTimestampMs(new Date(value))).toBe(value);
    });
  });
});
