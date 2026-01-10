# Utilities Examples

> **📖 For detailed utilities API reference, see [Utilities Reference](../reference-utilities.md)**

Practical examples for pagination, filtering, and sorting utilities.

## Pagination

**You need to:** Parse pagination parameters and create paginated responses.

**Here's how:** Use pagination utilities from the SDK.

```typescript
import { parsePaginationParams, createPaginatedListResponse } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', async (req, res) => {
  // Parse pagination from query string: ?page=2&page_size=25
  const { currentPage, pageSize } = parsePaginationParams(req.query);
  
  // Fetch data
  const allItems = await fetchAllApplications();
  const totalItems = allItems.length;
  const pageItems = allItems.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  // Create paginated response
  const response = createPaginatedListResponse(
    pageItems,
    totalItems,
    currentPage,
    pageSize,
    'application'
  );
  
  res.json(response);
  // Returns: { meta: { totalItems, currentPage, pageSize, type }, data: [...] }
});
```

## Filtering

**You need to:** Build and parse filter queries for dynamic filtering.

**Here's how:** Use FilterBuilder to construct filters and parse them from query strings using JSON format.

### Basic Filter Parsing

```typescript
import { parseFilterParams } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse filters from query string with URL-encoded JSON format
  // URL: ?filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22region%22%3A%7B%22in%22%3A%5B%22eu%22%2C%22us%22%5D%7D%7D
  // Decoded: {"status":{"eq":"active"},"region":{"in":["eu","us"]}}
  const filters = parseFilterParams(req.query);
  // Returns: [
  //   { field: 'status', op: 'eq', value: 'active' },
  //   { field: 'region', op: 'in', value: ['eu', 'us'] }
  // ]
  
  // Use filters in your application logic
  const filteredData = applyFiltersToData(filters);
  res.json(filteredData);
});
```

### Using FilterBuilder

```typescript
import { FilterBuilder, buildQueryString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Build filters dynamically using FilterBuilder
  const filterBuilder = new FilterBuilder()
    .add('status', 'eq', 'active')
    .add('region', 'in', ['eu', 'us'])
    .add('created_at', 'gte', '2024-01-01');
  
  // Build complete query with filters, sort, pagination
  const queryString = buildQueryString({
    filters: filterBuilder.build(),
    sort: ['-updated_at', 'name'],
    page: 1,
    pageSize: 25
  });
  
  // Use queryString in API call
  const url = `/api/applications?${queryString}`;
});
```

### Multiple Input Formats

The `parseFilterParams()` function supports multiple input formats:

**Direct Object Format:**
```typescript
const filters = parseFilterParams({
  filter: { 
    status: { eq: 'active' }, 
    age: { gte: 18 } 
  }
});
```

**JSON String Format:**
```typescript
const filters = parseFilterParams({
  filter: '{"status": {"eq": "active"}, "region": {"in": ["eu", "us"]}}'
});
```

**Null Checks:**
```typescript
// Filter for records where deletedAt is null and email is not null
const filters = parseFilterParams({
  filter: {
    deletedAt: { isNull: null },
    email: { isNotNull: null }
  }
});
```

## Sorting

**You need to:** Parse and build sort parameters.

**Here's how:** Use sort utilities to handle query string sorting.

```typescript
import { parseSortParams, buildSortString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', (req, res) => {
  // Parse sort from query string: ?sort=-updated_at&sort=name
  const sortOptions = parseSortParams(req.query);
  // Returns: [{ field: 'updated_at', order: 'desc' }, { field: 'name', order: 'asc' }]
  
  // Convert to query string format
  const sortStrings = buildSortString(sortOptions);
  // Returns: ['-updated_at', 'name']
  
  // Use in API call
  const url = `/api/applications?sort=${sortStrings.join('&sort=')}`;
});
```

## Complete Example

Combining pagination, filtering, and sorting:

```typescript
import { 
  parsePaginationParams, 
  parseFilterParams, 
  parseSortParams,
  createPaginatedListResponse,
  FilterBuilder,
  buildQueryString 
} from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', async (req, res) => {
  try {
    // Parse pagination
    const { currentPage, pageSize } = parsePaginationParams(req.query);
    
    // Parse filters
    const filters = parseFilterParams(req.query);
    
    // Parse sorting
    const sortOptions = parseSortParams(req.query);
    
    // Build complete query string
    const filterBuilder = new FilterBuilder();
    filters.forEach(filter => {
      filterBuilder.add(filter.field, filter.op, filter.value);
    });
    
    const queryString = buildQueryString({
      filters: filterBuilder.build(),
      sort: buildSortString(sortOptions),
      page: currentPage,
      pageSize: pageSize
    });
    
    // Fetch filtered and sorted data
    const allItems = await fetchAllApplications();
    const totalItems = allItems.length;
    const pageItems = allItems.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize
    );
    
    // Create paginated response
    const response = createPaginatedListResponse(
      pageItems,
      totalItems,
      currentPage,
      pageSize,
      'application'
    );
    
    res.json(response);
  } catch (error) {
    res.status(400).json({ error: 'Invalid query parameters' });
  }
});
```

**See Also:**

- [Utilities Reference](../reference-utilities.md) - Complete pagination, filtering, and sorting utilities API
