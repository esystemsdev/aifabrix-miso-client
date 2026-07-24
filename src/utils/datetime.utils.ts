/**
 * Locale-aware datetime formatting helpers for UI applications.
 */

import type {
  DateFormatStyle,
  DateTimeFormatOptions,
  DateTimeInput,
  DateTimeLocale,
} from "../types/datetime.types";

const DEFAULT_FALLBACK = "-";

interface NormalizedDateTimeOptions {
  locale?: DateTimeLocale;
  timeZone?: string;
  fallback: string;
  includeSeconds: boolean;
  use24Hour?: boolean;
  dateFormat: DateFormatStyle;
}

/**
 * Format date and time using locale-aware output.
 */
export function formatDateTime(
  value: DateTimeInput,
  options?: DateTimeFormatOptions,
): string {
  return formatWithPreset(value, "dateTime", options);
}

/**
 * Format only date part using locale-aware output.
 */
export function formatDate(
  value: DateTimeInput,
  options?: DateTimeFormatOptions,
): string {
  return formatWithPreset(value, "date", options);
}

/**
 * Format only time part using locale-aware output.
 */
export function formatTime(
  value: DateTimeInput,
  options?: DateTimeFormatOptions,
): string {
  return formatWithPreset(value, "time", options);
}

/**
 * Create a reusable date-time formatter (useful for list/table rendering).
 */
export function createDateTimeFormatter(
  options?: DateTimeFormatOptions,
): (value: DateTimeInput) => string {
  const normalizedOptions = normalizeOptions(options);
  const formatter = createFormatter("dateTime", normalizedOptions);

  return (value: DateTimeInput): string => {
    const parsed = parseDateTimeInput(value, normalizedOptions.fallback);
    if (parsed.isFallback) return normalizedOptions.fallback;
    if (parsed.rawStringFallback) return parsed.rawStringFallback;
    return formatter.format(parsed.date);
  };
}

type Preset = "dateTime" | "date" | "time";

function formatWithPreset(
  value: DateTimeInput,
  preset: Preset,
  options?: DateTimeFormatOptions,
): string {
  const normalizedOptions = normalizeOptions(options);
  const parsed = parseDateTimeInput(value, normalizedOptions.fallback);
  if (parsed.isFallback) return normalizedOptions.fallback;
  if (parsed.rawStringFallback) return parsed.rawStringFallback;

  return createFormatter(preset, normalizedOptions).format(parsed.date);
}

function normalizeOptions(
  options?: DateTimeFormatOptions,
): NormalizedDateTimeOptions {
  return {
    locale: options?.locale,
    timeZone: options?.timeZone,
    fallback: options?.fallback ?? DEFAULT_FALLBACK,
    includeSeconds: options?.includeSeconds ?? false,
    use24Hour: options?.use24Hour,
    dateFormat: options?.dateFormat ?? "short",
  };
}

function createFormatter(
  preset: Preset,
  options: NormalizedDateTimeOptions,
): Intl.DateTimeFormat {
  const intlOptions = buildIntlOptions(preset, options);
  return createSafeIntlFormatter(options.locale, intlOptions);
}

function createSafeIntlFormatter(
  locale: DateTimeLocale | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    const optionsWithoutTimeZone = { ...options };
    delete optionsWithoutTimeZone.timeZone;
    return new Intl.DateTimeFormat(undefined, optionsWithoutTimeZone);
  }
}

function buildIntlOptions(
  preset: Preset,
  options: NormalizedDateTimeOptions,
): Intl.DateTimeFormatOptions {
  const base: Intl.DateTimeFormatOptions = {
    timeZone: options.timeZone,
    hour12: resolveHour12(options.use24Hour),
  };

  if (preset === "date" || preset === "dateTime") {
    Object.assign(base, buildDateFields(options.dateFormat));
  }

  if (preset === "time" || preset === "dateTime") {
    base.hour = "2-digit";
    base.minute = "2-digit";
    if (options.includeSeconds) {
      base.second = "2-digit";
    }
  }

  if (base.hour12 === undefined) {
    delete base.hour12;
  }

  if (!base.timeZone) {
    delete base.timeZone;
  }

  return base;
}

function resolveHour12(use24Hour: boolean | undefined): boolean | undefined {
  if (use24Hour === undefined) return undefined;
  return !use24Hour;
}

function buildDateFields(style: DateFormatStyle): Intl.DateTimeFormatOptions {
  if (style === "long") {
    return {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
  }

  if (style === "medium") {
    return {
      year: "numeric",
      month: "short",
      day: "2-digit",
    };
  }

  return {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
}

function parseDateTimeInput(
  value: DateTimeInput,
  fallback: string,
):
  | { date: Date; isFallback: false; rawStringFallback?: undefined }
  | { isFallback: true }
  | {
      isFallback: false;
      date: Date;
      rawStringFallback: string;
    } {
  if (value === null || value === undefined) {
    return { isFallback: true };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === fallback || trimmed === "-") {
      return { isFallback: true };
    }

    const parsed = new Date(normalizeIsoTimestampForParse(trimmed));
    if (Number.isNaN(parsed.getTime())) {
      return {
        isFallback: false,
        rawStringFallback: trimmed,
        date: new Date(0),
      };
    }
    return { isFallback: false, date: parsed };
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { isFallback: true };
  }
  return { isFallback: false, date: parsed };
}

/**
 * Truncate sub-millisecond ISO fractions so Date parsing is consistent across runtimes.
 */
function normalizeIsoTimestampForParse(value: string): string {
  return value.replace(/(\.\d{3})\d+(?=[Zz]|[+-]\d{2}:?\d{2}$)/, "$1");
}
