/**
 * Datetime utility types for locale-aware UI rendering.
 * All keys follow camelCase convention.
 */

/**
 * Datetime input accepted by formatter helpers.
 */
export type DateTimeInput = string | number | Date | null | undefined;

/**
 * Locale argument accepted by `Intl.DateTimeFormat`.
 */
export type DateTimeLocale = string | readonly string[];

/**
 * Date rendering style.
 */
export type DateFormatStyle = "short" | "medium" | "long";

/**
 * Datetime formatter options used by SDK helpers.
 */
export interface DateTimeFormatOptions {
  /**
   * Optional locale override (defaults to runtime/browser locale).
   */
  locale?: DateTimeLocale;

  /**
   * Optional IANA timezone override (defaults to runtime/browser timezone).
   */
  timeZone?: string;

  /**
   * Placeholder returned for empty values or invalid non-string values.
   * Default: `-`
   */
  fallback?: string;

  /**
   * Include seconds in time output. Default: `false`.
   */
  includeSeconds?: boolean;

  /**
   * Explicit 24h/12h preference. If omitted, locale default is used.
   */
  use24Hour?: boolean;

  /**
   * Date format style used by date and datetime helpers.
   * Default: `short`.
   */
  dateFormat?: DateFormatStyle;
}
