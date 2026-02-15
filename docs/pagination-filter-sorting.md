# Pagination, Filter, and Sorting

How to use the SDK utilities for pagination, filtering, and sorting. Simple usage only.

## Pagination

Parse query params and build a paginated response:

```typescript
import { parsePaginationParams, createPaginatedListResponse } from '@aifabrix/miso-client';

// From query: ?page=2&page_size=25
const { currentPage, pageSize } = parsePaginationParams(req.query);

const items = await fetchPage(currentPage, pageSize);
const totalItems = await fetchCount();

const response = createPaginatedListResponse(
  items,
  totalItems,
  currentPage,
  pageSize,
  'user'  // type for meta
);
res.json(response);
// { meta: { totalItems, currentPage, pageSize, type }, data: [...] }
```

## Filtering

Build filter criteria with `FilterBuilder` and optional query string:

```typescript
import { FilterBuilder, buildQueryString, parseFilterParams } from '@aifabrix/miso-client';

// Build filters
const filters = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'in', ['eu', 'us'])
  .add('created_at', 'gte', '2024-01-01')
  .build();

// Parse from request query (if your API accepts filter param)
const fromQuery = parseFilterParams(req.query);

// Build full query string (filters + sort + pagination)
const queryString = buildQueryString({
  filters,
  sort: ['-updated_at', 'name'],
  page: 1,
  pageSize: 25,
});
```

## Sorting

Parse sort from query and use in your query layer:

```typescript
import { parseSortParams, applySorting } from '@aifabrix/miso-client';

// From query: ?sort=-updated_at,name
const sortOptions = parseSortParams(req.query);
// [{ field: 'updated_at', order: 'desc' }, { field: 'name', order: 'asc' }]

// For DB: use sortOptions to build orderBy
// For in-memory array (small data only):
const sorted = applySorting(items, sortOptions);
```

Use database-level sorting for large datasets; use `applySorting` only for small lists.

## Summary

| Need | Use |
|------|-----|
| Parse page/page_size | `parsePaginationParams(req.query)` |
| Paginated response | `createPaginatedListResponse(items, totalItems, page, pageSize, type)` |
| Build filters | `FilterBuilder().add(field, op, value).build()` |
| Parse filters from query | `parseFilterParams(req.query)` |
| Build query string | `buildQueryString({ filters, sort, page, pageSize })` |
| Parse sort from query | `parseSortParams(req.query)` |
| Sort in-memory | `applySorting(items, sortOptions)` |

All utilities use camelCase in outputs (e.g. `currentPage`, `pageSize`). See [configuration.md](configuration.md) for options.
