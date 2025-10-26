# AI Fabrix Miso Client SDK

[![npm version](https://badge.fury.io/js/%40aifabrix%2Fmiso-client.svg)](https://badge.fury.io/js/%40aifabrix%2Fmiso-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

The **AI Fabrix Miso Client SDK** is a TypeScript/JavaScript library that provides authentication, authorization, and logging capabilities for applications integrated with the AI Fabrix platform. It offers seamless integration with Keycloak authentication, Redis caching, and centralized logging.

## 🚀 Features

- **🔐 Authentication**: Token validation and user management
- **🛡️ Authorization**: Role and permission-based access control
- **📊 Logging**: Centralized logging with audit trails and API key authentication
- **⚡ Caching**: Redis-based caching for improved performance
- **🔄 Fallback**: Automatic fallback to controller when Redis is unavailable
- **🔑 API Key Security**: Secure API key authentication for application logging
- **📱 Multi-platform**: Works in Node.js and browser environments
- **🔧 TypeScript**: Full TypeScript support with type definitions

## 📚 Documentation

- **[Getting Started](docs/getting-started.md)** - Installation and basic setup
- **[API Reference](docs/api-reference.md)** - Complete API documentation
- **[Configuration](docs/configuration.md)** - Configuration options and examples
- **[Examples](docs/examples.md)** - Practical usage examples
- **[Troubleshooting](docs/troubleshooting.md)** - Common issues and solutions

## 🏃‍♂️ Quick Start

```bash
npm install @aifabrix/miso-client
```

```typescript
import { MisoClient } from '@aifabrix/miso-client';

const client = new MisoClient({
  controllerUrl: 'https://controller.aifabrix.ai',
  environment: 'dev',
  applicationKey: 'your-app-key',
  applicationId: 'your-app-id-123', // NEW: Application GUID
  apiKey: 'your-api-key', // NEW: API key for logging
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'your-redis-password'
  }
});

await client.initialize();

// Validate user token
const isValid = await client.validateToken(userToken);
if (isValid) {
  const user = await client.getUser(userToken);
  const roles = await client.getRoles(userToken);

  // Check permissions
  const canEdit = await client.hasPermission(userToken, 'edit:content');

  // Log events (now with API key authentication)
  client.log.audit('user.login', 'authentication', { userId: user.id });
}
```

## 🏗️ Architecture

The Miso Client SDK consists of several core services:

- **AuthService**: Handles token validation and user authentication
- **RoleService**: Manages user roles with Redis caching
- **PermissionService**: Handles fine-grained permissions
- **LoggerService**: Centralized logging and audit trails
- **RedisService**: Caching and queue management

## 🔧 Configuration

The SDK supports flexible configuration options:

```typescript
interface MisoClientConfig {
  controllerUrl: string; // AI Fabrix controller URL
  environment: 'dev' | 'tst' | 'pro'; // Environment
  applicationKey: string; // Your application identifier
  applicationId: string; // NEW: Application GUID
  apiKey?: string; // NEW: API key for logging authentication
  redis?: RedisConfig; // Optional Redis configuration
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  cache?: {
    roleTTL?: number; // Role cache TTL (default: 15 minutes)
    permissionTTL?: number; // Permission cache TTL (default: 15 minutes)
  };
}
```

## 🌐 Environments

The SDK supports three environments:

- **`dev`** - Development environment
- **`tst`** - Test environment
- **`pro`** - Production environment

## 📦 Installation

### NPM

```bash
npm install @aifabrix/miso-client
```

### Yarn

```bash
yarn add @aifabrix/miso-client
```

### PNPM

```bash
pnpm add @aifabrix/miso-client
```

## 🔗 Links

- **GitHub Repository**: [https://github.com/esystemsdev/aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client)
- **Documentation**: [https://github.com/esystemsdev/aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client)
- **Issues**: [https://github.com/esystemsdev/aifabrix-miso-client/issues](https://github.com/esystemsdev/aifabrix-miso-client/issues)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our GitHub repository.

## 📞 Support

For support and questions:

- **Email**: <support@esystemsnordic.com>
- **Documentation**: [https://github.com/esystemsdev/aifabrix-miso-client](https://github.com/esystemsdev/aifabrix-miso-client)
- **GitHub Issues**: [https://github.com/esystemsdev/aifabrix-miso-client/issues](https://github.com/esystemsdev/aifabrix-miso-client/issues)

---

**Made with ❤️ by eSystems Nordic Ltd.**
