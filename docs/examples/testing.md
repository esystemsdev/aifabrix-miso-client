# Testing Examples

Practical examples for testing applications with mocked MisoClient.

**You need to:** Test your application with mocked MisoClient.

**Here's how:** Mock the SDK methods in your tests.

## Unit Tests with Mocks

```typescript
// miso-client.test.ts
import { MisoClient } from '@aifabrix/miso-client';

jest.mock('@aifabrix/miso-client', () => ({
  MisoClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    validateToken: jest.fn().mockResolvedValue(true),
    getUser: jest.fn().mockResolvedValue({
      id: 'user-123',
      username: 'testuser',
      email: 'test@example.com',
      roles: ['user', 'admin']
    }),
    hasRole: jest.fn().mockResolvedValue(true),
    hasPermission: jest.fn().mockResolvedValue(true),
    log: {
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
      audit: jest.fn().mockResolvedValue(undefined)
    }
  }))
}));

describe('MisoClient', () => {
  let client: MisoClient;

  beforeEach(() => {
    client = new MisoClient({
      controllerUrl: 'https://test.controller.com',
      clientId: 'ctrl-test-app',
      clientSecret: 'test-secret'
    });
  });

  it('should validate token', async () => {
    const isValid = await client.validateToken('valid-token');
    expect(isValid).toBe(true);
  });
});
```

**See Also:**

- [Authentication Reference](../reference-authentication.md) - Complete authentication API reference
- [Authorization Reference](../reference-authorization.md) - Role and permission management
