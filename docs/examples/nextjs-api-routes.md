# Next.js API Routes Examples

Practical examples for adding authentication to Next.js API routes using the AI Fabrix Miso Client SDK.

**You need to:** Add authentication to Next.js API routes.

**Here's how:** Validate tokens and check permissions in API route handlers.

```typescript
// pages/api/posts.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

// ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
const client = new MisoClient(loadConfig());
await client.initialize();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = client.getToken(req);

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const isValid = await client.validateToken(token);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await client.getUser(token);

    switch (req.method) {
      case 'GET':
        // Use fluent API with request context
        await client.log
          .withRequest(req)
          .info('Posts fetched');
        return res.status(200).json({ posts: [] });

      case 'POST':
        const canCreate = await client.hasPermission(token, 'create:posts');
        if (!canCreate) {
          await client.log
            .withRequest(req)
            .audit('access.denied', 'posts', {
              action: 'create'
            });
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        await client.log
          .withRequest(req)
          .audit('post.created', 'posts', {
            postTitle: req.body.title
          });
        return res.status(201).json({ message: 'Post created' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    // Use fluent API with request context for errors
    await client.log
      .withRequest(req)
      .error('API error', error instanceof Error ? error.stack : undefined);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**See Also:**

- [Authentication Reference](../reference-authentication.md) - Complete authentication API reference
- [Authorization Reference](../reference-authorization.md) - Role and permission management
- [Express Middleware Examples](./express-middleware.md) - Similar patterns for Express.js
