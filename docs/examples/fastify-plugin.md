# Fastify Plugin Examples

Practical examples for adding authentication to Fastify applications using the AI Fabrix Miso Client SDK.

**You need to:** Add authentication to Fastify applications.

**Here's how:** Create a Fastify plugin that decorates the instance with MisoClient.

```typescript
// miso-plugin.ts
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { MisoClient, loadConfig } from '@aifabrix/miso-client';

const misoPlugin: FastifyPluginAsync = async (fastify) => {
  // ✅ Use standard .env parameters (AI Fabrix builder automatically manages these)
  const client = new MisoClient(loadConfig());
  await client.initialize();

  fastify.decorate('miso', client);

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (token) {
      try {
        const isValid = await client.validateToken(token);
        if (isValid) {
          const user = await client.getUser(token);
          request.user = user;
        }
      } catch (error) {
        // Token might be invalid, continue without user
      }
    }
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply) => {
    await client.log.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      userId: request.user?.id
    });
  });
};

// Usage
import Fastify from 'fastify';
const fastify = Fastify();
await fastify.register(misoPlugin);

fastify.get('/posts', async (request, reply) => {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return reply.status(401).send({ error: 'No token provided' });
  }

  const canRead = await fastify.miso.hasPermission(token, 'read:posts');
  if (!canRead) {
    return reply.status(403).send({ error: 'Insufficient permissions' });
  }

  return { posts: [] };
});
```

**See Also:**

- [Authentication Reference](../reference-authentication.md) - Complete authentication API reference
- [Authorization Reference](../reference-authorization.md) - Role and permission management
