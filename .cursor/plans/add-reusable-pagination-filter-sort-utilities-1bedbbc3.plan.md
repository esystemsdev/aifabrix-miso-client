<!-- 1bedbbc3-f1eb-4aae-bd7f-52b431412735 0be36a49-630a-48ca-89d7-5ed35ea9de42 -->
# Add Reusable Pagination, Filter, Sort Utilities to Miso Client SDK

## Overview

Add reusable utilities for pagination, filtering, sorting, and error handling to the existing `@aifabrix/miso-client` SDK. These utilities will be business-logic-free and reusable across other applications. All utilities use **snake_case** to match Miso/Dataplane API conventions.

## Implementation Details

### 1. Type Definitions (snake_case)

**File: `src/types/pagination.types.ts`**

- `Meta` interface: `total_items`, `current_page`, `page_size`, `type`
  - Note: `current_page` maps to `page` query parameter (1-based index)
  - `page_size` maps to `page_size` query parameter
- `PaginatedListResponse<T>` interface: `meta`, `data`

**File: `src/types/filter.types.ts`**

- `FilterOperator` type: `eq`, `neq`, `in`, `nin`, `gt`, `lt`, `gte`, `lte`, `contains`, `like`
- `FilterOption` interface: `field`, `op`, `value` (supports arrays)
- `FilterQuery` interface: `filters?`, `sort?`, `page?`, `page_size?`, `fields?`
- `FilterBuilder` class: Builder pattern for dynamic filter construction

**File: `src/types/sort.types.ts`**

- `SortOption` interface: `field`, `order` (`asc` | `desc`)

**File: `src/types/errors.types.ts`**

- `ErrorResponse` interface: `errors`, `type?`, `title?`, `status_code`, `instance?`, `request_key?` (snake_case only)
- `ErrorEnvelope` interface: `error`
- Update existing `ErrorResponse` in `config.types.ts` or create new one

### 2. Utility Functions

**File: `src/utils/pagination.utils.ts`**

- `parse_pagination_params()`: Parse query params (`page`, `page_size`) to `current_page`, `page_size` (1-based)
- `create_meta_object()`: Construct `Meta` object from `total_items`, `current_page`, `page_size`, `type`
- `apply_pagination_to_array()`: Apply pagination to array (for testing/mocks)
- `create_paginated_list_response()`: Wrap array + meta into standard response

**File: `src/utils/filter.utils.ts`**

- `parse_filter_params()`: Parse `?filter=field:op:value` into `FilterOption[]`
- `build_query_string()`: Convert `FilterQuery` object to query string
- `apply_filters()`: Apply filters to array locally (for testing/mocks)
- `FilterBuilder` class: Builder pattern for dynamic filter construction
  - Methods: `add(field, op, value)`, `addMany(filters[])`, `build()`, `toQueryString()`
  - Support for path parameters and query string parameters
  - Dynamic filtering with any field/operator/value combination

**File: `src/utils/sort.utils.ts`**

- `parse_sort_params()`: Parse `?sort=-field` into `SortOption[]`
- `build_sort_string()`: Convert `SortOption[]` to query string format

**File: `src/utils/errors.ts`** (enhance existing)

- Keep existing `MisoClientError` class
- Add `transform_error_to_snake_case()`: Transform errors to snake_case format
- Add `handle_api_error_snake_case()`: Handle errors with snake_case response

### 3. HTTP Client Enhancement

**File: `src/utils/http-client.ts`** (enhance existing)

- Keep existing `HttpClient` with audit logging
- Add helper methods for filter builder integration:
  - `getWithFilters<T>(url, filterBuilder, config?)`: GET request with filter builder
  - `getPaginated<T>(url, pagination, config?)`: GET request with pagination support
- Expose reusable request builder that accepts filter/sort/pagination options

### 4. Integration Points

**File: `src/index.ts`**

- Export all new types from `types/pagination.types.ts`, `types/filter.types.ts`, `types/sort.types.ts`, `types/errors.types.ts`
- Export all utility functions from `utils/pagination.utils.ts`, `utils/filter.utils.ts`, `utils/sort.utils.ts`
- Export enhanced error utilities

**File: `src/types/config.types.ts`**

- Optionally add `ErrorResponseSnakeCase` type or update existing to support both formats
- Keep backward compatibility with existing `ErrorResponse` (camelCase)

### 5. Testing Requirements

**Test Files to Create:**

- `tests/unit/pagination.utils.test.ts` - Full coverage of pagination utilities
- `tests/unit/filter.utils.test.ts` - Full coverage of filter utilities (including FilterBuilder)
- `tests/unit/sort.utils.test.ts` - Full coverage of sort utilities
- `tests/unit/errors-snake-case.test.ts` - Test snake_case error transformation
- `tests/unit/http-client-filters.test.ts` - Test HTTP client filter integration

**Test Coverage Requirements:**

- All utility functions must have 100% branch coverage
- All edge cases: null/undefined inputs, empty arrays, invalid operators, malformed query strings
- FilterBuilder: all methods, dynamic filtering, query string building
- Pagination: boundary conditions (page 0, negative page, large page_size)
- Error transformation: both camelCase and snake_case inputs
- Type safety: all tests must pass TypeScript strict mode

### 6. Linting and Type Checking

**Requirements:**

- All code must pass ESLint with zero warnings or errors
- All code must pass TypeScript strict mode with zero errors
- All types must be explicitly typed (no `any` unless absolutely necessary)
- Follow `.cursorrules` conventions:
  - Snake_case for new utility functions and types (matching API)
  - CamelCase for existing SDK patterns (maintain consistency)
  - JSDoc comments for all public functions
  - Private methods for internal logic

**Lint Commands:**

- `npm run lint` - Must pass with zero warnings
- `npm run lint:fix` - Auto-fix where possible
- `tsc --noEmit` - Must pass with zero errors

### 7. Documentation Updates

**Files to Update:**

- `README.md`: Add section on pagination, filtering, sorting utilities
- `docs/api-reference.md`: Add complete API reference for:
  - `Meta` and `PaginatedListResponse` types
  - `FilterOption`, `FilterQuery`, `FilterBuilder` classes
  - `SortOption` type
  - `ErrorResponseSnakeCase` type
  - All utility functions with examples
- `docs/examples.md`: Add examples for:
  - Pagination usage
  - Filter builder usage (dynamic filtering)
  - Sort usage
  - Combined pagination + filter + sort
  - Error handling with snake_case responses
- `docs/getting-started.md`: Add quick start for pagination/filtering
- `docs/configuration.md`: Update if needed for new utilities

**Documentation Requirements:**

- All public APIs must have JSDoc comments
- All examples must be executable (copy-paste ready)
- All examples must include TypeScript types
- Include both simple and advanced use cases

## Key Design Decisions

1. **Naming**: All new utilities use **snake_case** to match Miso/Dataplane API
2. **Filter Builder**: Supports dynamic filter construction with `field`, `op`, `value` pattern
3. **Query String Building**: Filter builder generates query parameters for path and query string
4. **Module System**: Keep CommonJS (matching existing codebase)
5. **Backward Compatibility**: Enhance existing error handling while maintaining compatibility
6. **Metadata Returns**: Meta interface includes `current_page` (maps from `page` query param) and `page_size`

## Files to Create/Modify

**New Files:**

- `src/types/pagination.types.ts`
- `src/types/filter.types.ts`
- `src/types/sort.types.ts`
- `src/types/errors.types.ts` (or enhance existing)
- `src/utils/pagination.utils.ts`
- `src/utils/filter.utils.ts` (with FilterBuilder class)
- `src/utils/sort.utils.ts`
- `tests/unit/pagination.utils.test.ts`
- `tests/unit/filter.utils.test.ts`
- `tests/unit/sort.utils.test.ts`
- `tests/unit/errors-snake-case.test.ts`
- `tests/unit/http-client-filters.test.ts`

**Modified Files:**

- `src/utils/http-client.ts` (add filter builder support)
- `src/utils/errors.ts` (enhance with snake_case support)
- `src/index.ts` (export new utilities)
- `src/types/config.types.ts` (optional: add snake_case error type)
- `README.md` (documentation)
- `docs/api-reference.md` (documentation)
- `docs/examples.md` (documentation)
- `docs/getting-started.md` (documentation)

## Validation Against Reference Implementation

**All Functions from Reference Implementation Included:**

✅ **Types:**

- `Meta` interface (total_items, current_page, page_size, type)
- `PaginatedListResponse<T>`
- `FilterOperator`, `FilterOption`, `FilterQuery`
- `SortOption`
- `ErrorResponse` (snake_case), `ErrorEnvelope`

✅ **Utility Functions:**

- `parse_pagination_params()` - Parse query params to pagination values
- `create_meta_object()` - Construct Meta object
- `apply_pagination_to_array()` - Apply pagination to array
- `create_paginated_list_response()` - Wrap array + meta into response
- `parse_filter_params()` - Parse filter query params
- `build_query_string()` - Convert FilterQuery to query string
- `apply_filters()` - Apply filters locally (for tests)
- `parse_sort_params()` - Parse sort query params
- `transform_error()` - Transform errors to snake_case ErrorResponse
- `handle_api_error()` - Throw ApiErrorException

✅ **Classes:**

- `ApiErrorException` - Exception class with snake_case fields
- `FilterBuilder` - Builder pattern for dynamic filtering (user requirement)
- `HttpClient` - Enhanced with filter/pagination helpers (note: integrates with existing HttpClient that has audit logging)

**Additional Functions (Not in Reference but Needed):**

- `build_sort_string()` - Helper to build sort query string from SortOption[]
- `getWithFilters()` - HTTP client helper for filter builder
- `getPaginated()` - HTTP client helper for pagination

**Note on HttpClient:**

- Reference shows simplified HttpClient, but plan integrates with existing HttpClient that has:
  - Client token management (automatic via interceptors)
  - Audit logging (ISO 27001 compliant)
  - InternalHttpClient wrapper pattern
- New helper methods (`getWithFilters`, `getPaginated`) will work with existing HttpClient pattern

## Example Usage

```typescript
import { 
  FilterBuilder, 
  parse_pagination_params, 
  build_query_string,
  parse_filter_params,
  apply_filters,
  parse_sort_params,
  build_sort_string,
  create_paginated_list_response,
  PaginatedListResponse,
  Meta
} from '@aifabrix/miso-client';

// Dynamic filter building (FilterBuilder - user requirement)
const filterBuilder = new FilterBuilder()
  .add('status', 'eq', 'active')
  .add('region', 'in', ['eu', 'us'])
  .add('created_at', 'gte', '2024-01-01');

const queryString = filterBuilder.toQueryString();
// ?filter=status:eq:active&filter=region:in:eu,us&filter=created_at:gte:2024-01-01

// Pagination (page query param maps to current_page in Meta)
const { current_page, page_size } = parse_pagination_params({ page: '1', page_size: '25' });

// Parse existing query params
const filters = parse_filter_params({ filter: ['status:eq:active', 'region:in:eu,us'] });
const sortOptions = parse_sort_params({ sort: '-updated_at' });
const sortString = build_sort_string(sortOptions); // '-updated_at'

// Combined query
const combinedQuery = build_query_string({
  filters: filterBuilder.build(),
  sort: ['-updated_at'],
  page: 1,
  page_size: 25
});

// Response with Meta
const response: PaginatedListResponse<Item> = {
  meta: {
    total_items: 120,
    current_page: 1,    // Maps from page query param
    page_size: 25,      // From page_size query param
    type: 'item'
  },
  data: [...]
};

// Create paginated response
const paginatedResponse = create_paginated_list_response(
  items,
  totalItems,
  current_page,
  page_size,
  'item'
);
```

### To-dos

- [ ] Create src/types/pagination.types.ts with Meta and PaginatedListResponse interfaces (snake_case)
- [ ] Create src/types/filter.types.ts with FilterOperator, FilterOption, FilterQuery types and FilterBuilder class
- [ ] Create src/types/sort.types.ts with SortOption interface
- [ ] Create src/types/errors.types.ts with snake_case ErrorResponse and ErrorEnvelope interfaces
- [ ] Create src/utils/pagination.utils.ts with parse, create, and apply functions
- [ ] Create src/utils/filter.utils.ts with parse, build, apply functions and FilterBuilder class for dynamic filtering
- [ ] Create src/utils/sort.utils.ts with parse and build functions
- [ ] Enhance src/utils/errors.ts with snake_case error transformation support
- [ ] Add filter builder support methods to src/utils/http-client.ts (getWithFilters, getPaginated helpers)
- [ ] Update src/index.ts to export all new types and utilities
- [ ] Optional: Update src/types/config.types.ts to support snake_case ErrorResponse alongside existing camelCase