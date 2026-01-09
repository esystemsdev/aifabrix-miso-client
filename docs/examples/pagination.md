# Pagination Examples

> **📖 For detailed pagination API reference, see [Utilities Reference - Pagination](../reference-utilities.md#pagination-utilities)**

Practical examples for parsing pagination parameters and creating paginated responses.

**You need to:** Parse pagination parameters and create paginated responses.

**Here's how:** Use pagination utilities from the SDK.

## Parse and Use Pagination

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

**See Also:**

- [Utilities Reference](../reference-utilities.md) - Complete pagination, filtering, and sorting utilities
- [Filtering Examples](./filtering.md) - Filtering examples
- [Sorting Examples](./sorting.md) - Sorting examples
