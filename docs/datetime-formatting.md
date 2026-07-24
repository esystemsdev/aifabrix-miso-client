# Datetime Formatting

Use SDK datetime helpers to render date/time consistently across UI apps while still respecting each user's locale and timezone.

## Why Use It

- One shared formatting contract across consumer applications.
- Locale-aware output (Portugal and Finland users see different familiar formats).
- Safe fallback handling for missing/invalid values.
- No framework dependency (works with React, Vue, Angular, plain TypeScript).

## API

```typescript
import {
  formatDateTime,
  formatDate,
  formatTime,
  createDateTimeFormatter,
  formatLogDateTimeUtcFixed,
  parseIsoTimestampMs,
} from "@aifabrix/miso-client";
```

- `formatDateTime(value, options?)` - date + time output.
- `formatDate(value, options?)` - date-only output.
- `formatTime(value, options?)` - time-only output.
- `createDateTimeFormatter(options?)` - reusable formatter for list/table rendering.
- `formatLogDateTimeUtcFixed(value, options?)` - deterministic UTC `DD/MM/YYYY, HH:mm:ss`.
- `parseIsoTimestampMs(value)` - parse datetime to epoch milliseconds (`0` for empty/invalid).

## Default Behavior

- Locale: runtime/browser locale.
- Timezone: runtime/browser local timezone.
- Empty values (`null`, `undefined`, empty string, `-`) return fallback (`-` by default).
- Invalid non-empty datetime strings return the original trimmed value.
- Invalid numeric/date values return fallback.
- `parseIsoTimestampMs` returns `0` for empty/invalid values.

## Options

```typescript
interface DateTimeFormatOptions {
  locale?: string | readonly string[];
  timeZone?: string; // IANA timezone, e.g. "UTC", "Europe/Helsinki"
  fallback?: string; // default: "-"
  includeSeconds?: boolean; // default: false
  use24Hour?: boolean; // default: locale choice
  dateFormat?: "short" | "medium" | "long"; // default: "short"
}
```

```typescript
interface LogDateTimeUtcFixedOptions {
  fallback?: string; // default: "-"
}
```

## Examples

### Basic DateTime

```typescript
const value = "2026-07-21T13:20:36.123Z";

const display = formatDateTime(value);
// Example output depends on browser locale/timezone.
```

### Explicit Locale and Timezone

```typescript
const value = "2026-07-21T13:20:36.123Z";

const pt = formatDateTime(value, {
  locale: "pt-PT",
  timeZone: "Europe/Lisbon",
  includeSeconds: true,
});

const fi = formatDateTime(value, {
  locale: "fi-FI",
  timeZone: "Europe/Helsinki",
  includeSeconds: true,
});
```

### Date-Only / Time-Only

```typescript
const value = "2026-07-21T13:20:36.123Z";

const dateOnly = formatDate(value, { locale: "en-GB", dateFormat: "long" });
const timeOnly = formatTime(value, {
  locale: "en-GB",
  includeSeconds: true,
  use24Hour: true,
});
```

### Reusable Formatter (List/Table)

```typescript
const renderDateTime = createDateTimeFormatter({
  locale: "en-GB",
  timeZone: "UTC",
  includeSeconds: true,
  use24Hour: true,
});

const rows = [
  { createdAt: "2026-07-21T13:20:36.123Z" },
  { createdAt: "2026-07-21T14:05:10.123Z" },
];

const rendered = rows.map((row) => renderDateTime(row.createdAt));
```

### Deterministic UTC Log Rendering

```typescript
const value = "2026-05-29T09:18:33.080980Z";
const logDisplay = formatLogDateTimeUtcFixed(value);
// "29/05/2026, 09:18:33"
```

### Timestamp Parsing for Sorting/Duration

```typescript
const startedMs = parseIsoTimestampMs("2026-05-29T09:18:33.080980Z");
const completedMs = parseIsoTimestampMs("2026-05-29T09:19:02.100000Z");
const durationMs = completedMs - startedMs;
```

## Migration Guidance (Consumer UIs)

### Track A: miso-ui (locale display consolidation)

1. Replace local and inline formatters with `formatDateTime` / `formatDate` / `formatTime`.
2. Keep product-specific labels and layout, but centralize formatting logic in SDK.
3. Use explicit `locale` or `timeZone` only when business requirements need overrides.
4. Add regression tests for fallback behavior (`-`, invalid strings).

### Track B: dataplane app-ui (locale + UTC fixed parity)

1. Replace locale short display helpers with `formatDateTime` (or `formatDate`/`formatTime` where clearer).
2. Replace deterministic log formatter usage with `formatLogDateTimeUtcFixed`.
3. Replace local timestamp parse helper usage with `parseIsoTimestampMs`.
4. Verify parity on:
   - fixed UTC format output (`DD/MM/YYYY, HH:mm:ss`)
   - sub-millisecond ISO parsing normalization
   - fallback behavior for invalid/empty values.
