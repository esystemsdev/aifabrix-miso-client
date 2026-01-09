# Examples

Practical examples demonstrating how to use the AI Fabrix Miso Client SDK in various scenarios.

> **📖 For DataClient (browser) examples, see [DataClient Documentation](../data-client.md#examples)**

This directory contains comprehensive framework-based examples for **MisoClient** (server-side SDK). For browser/frontend examples using DataClient, see the [DataClient Documentation](../data-client.md#examples).

> **📖 For detailed API reference with focused examples, see individual reference documents:**
> - [Authentication Reference](../reference-authentication.md) - Authentication API details and examples
> - [Authorization Reference](../reference-authorization.md) - Authorization API details and examples
> - [Services Reference](../reference-services.md) - Logging, encryption, caching examples
> - [Utilities Reference](../reference-utilities.md) - Pagination, filtering, sorting examples
> - [Error Handling Reference](../reference-errors.md) - Error handling examples

## Table of Contents

### Framework Integration

- [Express.js Middleware](./express-middleware.md) - Authentication middleware, role-based authorization, and factory function patterns for Express.js
- [React Authentication](./react-authentication.md) - Authentication context and protected routes for React applications
- [Next.js API Routes](./nextjs-api-routes.md) - Token validation and permission checks in Next.js API routes
- [NestJS Guards](./nestjs-guards.md) - Authentication and authorization guards for NestJS
- [Fastify Plugin](./fastify-plugin.md) - Fastify plugin integration with MisoClient

### Common Patterns

- [Background Jobs](./background-jobs.md) - Logging with request context, indexed context, credential context, and background job processing
- [Error Handling](./error-handling.md) - Handling SDK errors with structured error responses
- [Testing](./testing.md) - Unit testing with mocked MisoClient

### Utilities

- [Pagination](./pagination.md) - Parsing pagination parameters and creating paginated responses
- [Filtering](./filtering.md) - Building and parsing filter queries for dynamic filtering
- [Sorting](./sorting.md) - Parsing and building sort parameters

### Advanced Topics

- [Snake_case Error Handling](./snake-case-errors.md) - Handling errors in snake_case format for API compatibility
- [Event Emission Mode](./event-emission-mode.md) - Embedding the SDK and receiving logs as events instead of HTTP calls

## Quick Start

Choose the example that matches your framework or use case:

1. **Express.js** → [Express.js Middleware](./express-middleware.md)
2. **React** → [React Authentication](./react-authentication.md)
3. **Next.js** → [Next.js API Routes](./nextjs-api-routes.md)
4. **NestJS** → [NestJS Guards](./nestjs-guards.md)
5. **Fastify** → [Fastify Plugin](./fastify-plugin.md)

## Related Documentation

- [Getting Started](../getting-started.md) - Installation and basic setup
- [Configuration](../configuration.md) - Configuration options and environment variables
- [API Reference](../api-reference.md) - Complete API documentation
