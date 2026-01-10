# API Reference Index

Complete reference documentation for the AI Fabrix Miso Client SDK.

This document provides an overview and navigation to all API reference documentation. For detailed API specifications, see the individual reference documents linked below.

## Overview

The MisoClient SDK provides a comprehensive set of APIs for authentication, authorization, logging, caching, and more. The SDK is organized into several key components:

- **MisoClient**: Main client class for server-side applications
- **DataClient**: Browser-compatible HTTP client wrapper for front-end applications
- **Services**: Logging, encryption, caching, and other service classes
- **Utilities**: Express utilities, pagination, filtering, sorting, and standalone utilities
- **Types**: Complete TypeScript type definitions
- **Error Handling**: Structured error responses and error handling utilities

## Reference Documents

### Core Client APIs

- **[MisoClient Reference](./reference-misoclient.md)** - Main client class, initialization, configuration, and origin validation
- **[DataClient Reference](./reference-dataclient.md)** - Browser-compatible HTTP client with authentication, authorization, caching, and retry logic

### Authentication & Authorization

- **[Authentication Reference](./reference-authentication.md)** - User authentication, token validation, login/logout, and authentication strategies
- **[Authorization Reference](./reference-authorization.md)** - Roles and permissions management

### Services & Utilities

- **[Services Reference](./reference-services.md)** - Logging, encryption, caching, and service classes
- **[Utilities Reference](./reference-utilities.md)** - Express utilities, standalone utilities, pagination, filtering, and sorting

### Types & Errors

- **[Type Reference](./reference-types.md)** - Complete TypeScript type definitions
- **[Error Handling Reference](./reference-errors.md)** - Error handling and structured error responses

## Quick Navigation

### By Use Case

**Server-Side Applications:**

- [MisoClient Reference](./reference-misoclient.md) - Main client class
- [Authentication Reference](./reference-authentication.md) - User authentication
- [Authorization Reference](./reference-authorization.md) - Roles and permissions
- [Services Reference](./reference-services.md) - Logging, caching, encryption

**Browser/Frontend Applications:**

- [DataClient Reference](./reference-dataclient.md) - Browser HTTP client
- [DataClient Guide](./data-client.md) - Complete guide with examples

**Express.js Applications:**

- [Utilities Reference](./reference-utilities.md#express-utilities) - Express utilities
- [Express Examples](./examples/express-middleware.md) - Express middleware examples

**Pagination, Filtering, Sorting:**

- [Utilities Reference](./reference-utilities.md#pagination-utilities) - Pagination utilities
- [Utilities Examples](./examples/utilities.md) - Pagination, filtering, and sorting examples

**Error Handling:**

- [Error Handling Reference](./reference-errors.md) - Complete error handling guide
- [Type Reference](./reference-types.md#error-types) - Error type definitions

## Guides

For practical examples and best practices, see:

- **[DataClient Guide](./data-client.md)** - DataClient quick start guide
- **[Getting Started Guide](./getting-started.md)** - Quick start tutorial
- **[Configuration Guide](./configuration.md)** - Configuration options and best practices
- **[Examples](./examples/README.md)** - Framework-specific examples (Express, React)
- **[Troubleshooting Guide](./troubleshooting.md)** - Common issues and solutions

## SDK Structure

```text
@aifabrix/miso-client
├── MisoClient          # Main client class (server-side)
├── DataClient          # Browser HTTP client wrapper
├── Services            # Logging, encryption, caching
├── Utilities           # Express, pagination, filtering, sorting
├── Types               # TypeScript type definitions
└── Errors              # Error handling utilities
```

## Getting Started

1. **Server-Side**: See [MisoClient Reference](./reference-misoclient.md) and [Getting Started Guide](./getting-started.md)
2. **Browser/Frontend**: See [DataClient Reference](./reference-dataclient.md) and [DataClient Guide](./data-client.md)
3. **Examples**: See [Examples](./examples/README.md) for framework-specific examples

## Type Exports

All types are exported from the main package. See [Type Reference](./reference-types.md#type-exports) for complete list.

## See Also

- [DataClient Guide](./data-client.md) - DataClient quick start guide
- [Getting Started Guide](./getting-started.md) - Quick start tutorial
- [Configuration Guide](./configuration.md) - Configuration options
- [Examples](./examples/README.md) - Framework-specific examples
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions
