# Sorting Examples

> **📖 For detailed sorting API reference, see [Utilities Reference - Sorting](../reference-utilities.md#sort-utilities)**

Practical examples for parsing and building sort parameters.

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

**See Also:**

- [Utilities Reference](../reference-utilities.md) - Complete pagination, filtering, and sorting utilities
- [Pagination Examples](./pagination.md) - Pagination examples
- [Filtering Examples](./filtering.md) - Filtering examples
