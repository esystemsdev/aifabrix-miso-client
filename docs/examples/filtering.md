# Filtering Examples

> **📖 For detailed filtering API reference, see [Utilities Reference - Filtering](../reference-utilities.md#filter-utilities)**

Practical examples for building and parsing filter queries using the unified JSON filter format.

**You need to:** Build and parse filter queries for dynamic filtering.

**Here's how:** Use FilterBuilder to construct filters and parse them from query strings using JSON format.

## Basic Filter Parsing

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

## Using FilterBuilder

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
  // Returns: "filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22region%22%3A%7B%22in%22%3A%5B%22eu%22%2C%22us%22%5D%7D%2C%22created_at%22%3A%7B%22gte%22%3A%222024-01-01%22%7D%7D&sort=-updated_at&page=1&page_size=25"
  
  // Use queryString in API call
  const url = `/api/applications?${queryString}`;
});
```

## Multiple Input Formats

The `parseFilterParams()` function supports multiple input formats:

### Direct Object Format

```typescript
const filters = parseFilterParams({
  filter: { 
    status: { eq: 'active' }, 
    age: { gte: 18 } 
  }
});
```

### JSON String Format

```typescript
const filters = parseFilterParams({
  filter: '{"status": {"eq": "active"}, "region": {"in": ["eu", "us"]}}'
});
```

### URL-Encoded JSON Format (from query strings)

```typescript
// From URL: ?filter=%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%7D
const filters = parseFilterParams({
  filter: '%7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%7D'
});
```

## Null Checks

```typescript
// Filter for records where deletedAt is null and email is not null
const filters = parseFilterParams({
  filter: {
    deletedAt: { isNull: null },
    email: { isNotNull: null }
  }
});
// Returns: [
//   { field: 'deletedAt', op: 'isNull', value: null },
//   { field: 'email', op: 'isNotNull', value: null }
// ]
```

## Complete Example with Express

```typescript
import { FilterBuilder, parseFilterParams, buildQueryString } from '@aifabrix/miso-client';
import express from 'express';

const app = express();

app.get('/api/applications', async (req, res) => {
  try {
    // Parse filters from query string (supports JSON format)
    const filters = parseFilterParams(req.query);
    
    // Optionally rebuild filters using FilterBuilder for validation
    const filterBuilder = new FilterBuilder();
    filters.forEach(filter => {
      filterBuilder.add(filter.field, filter.op, filter.value);
    });
    
    // Build complete query string with filters, sort, pagination
    const queryString = buildQueryString({
      filters: filterBuilder.build(),
      sort: ['-updated_at', 'name'],
      page: 1,
      pageSize: 25
    });
    
    // Use queryString in upstream API call
    const response = await fetch(`/api/applications?${queryString}`);
    const data = await response.json();
    
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: 'Invalid filter format' });
  }
});
```

**See Also:**

- [Utilities Reference](../reference-utilities.md) - Complete pagination, filtering, and sorting utilities
- [Pagination Examples](./pagination.md) - Pagination examples
- [Sorting Examples](./sorting.md) - Sorting examples
