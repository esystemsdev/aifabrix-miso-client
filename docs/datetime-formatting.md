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
} from "@aifabrix/miso-client";
```

- `formatDateTime(value, options?)` - date + time output.
- `formatDate(value, options?)` - date-only output.
- `formatTime(value, options?)` - time-only output.
- `createDateTimeFormatter(options?)` - reusable formatter for list/table rendering.

## Default Behavior

- Locale: runtime/browser locale.
- Timezone: runtime/browser local timezone.
- Empty values (`null`, `undefined`, empty string, `-`) return fallback (`-` by default).
- Invalid non-empty datetime strings return the original trimmed value.
- Invalid numeric/date values return fallback.

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

## Migration Guidance (Consumer UIs)

1. Replace local datetime helpers with SDK imports.
2. Keep product-specific UI labels, but centralize formatting logic through SDK functions.
3. Use explicit `locale`/`timeZone` only when business requirements need overrides.
4. Add regression tests for fallback behavior (`-`, invalid strings) on critical pages.
