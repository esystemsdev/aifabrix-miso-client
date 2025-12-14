# Add Logout Functionality to DataClient

## Overview

Add a `logout()` method to DataClient that mirrors the `redirectToLogin()` functionality. The method will call the controller logout API, clear authentication tokens from localStorage, clear HTTP cache, and redirect to a configured logout URL (defaults to login page).

## Implementation Plan

### 1. Update DataClientConfig Type

**File:** `src/types/data-client.types.ts`

Add optional `logoutUrl` configuration property:

- Add `logoutUrl?: string` to `DataClientConfig` interface
- Default behavior: redirects to `loginUrl` if `logoutUrl` not provided
- Similar to `loginUrl` - can be relative path or absolute URL

### 2. Update DataClient Constructor

**File:** `src/utils/data-client.ts`

Update constructor default config:

- Add `logoutUrl: undefined` to default config (line ~145)
- This allows fallback to `loginUrl` when `logoutUrl` is not set

### 3. Implement logout() Method

**File:** `src/utils/data-client.ts`

Add new `logout()` method after `redirectToLogin()` method (around line 257):

```typescript
/**
 * Logout user and redirect
 * Calls logout API, clears tokens from localStorage, clears cache, and redirects
 * @param redirectUrl - Optional redirect URL after logout (defaults to logoutUrl or loginUrl)
 */
async logout(redirectUrl?: string): Promise<void> {
  if (!isBrowser()) return;
  
  const token = this.getToken();
  
  // Call logout API if misoClient available and token exists
  if (this.misoClient && token) {
    try {
      await this.misoClient.logout({ token });
    } catch (error) {
      // Log error but continue with cleanup (logout should always clear local state)
      console.error("Logout API call failed:", error);
    }
  }
  
  // Clear tokens from localStorage (always, even if API call failed)
  const keys = this.config.tokenKeys || ["token", "accessToken", "authToken"];
  keys.forEach(key => {
    try {
      const storage = (globalThis as unknown as { localStorage: { removeItem: (key: string) => void } }).localStorage;
      if (storage) {
        storage.removeItem(key);
      }
    } catch (e) {
      // Ignore localStorage errors (SSR, private browsing, etc.)
    }
  });
  
  // Clear HTTP cache
  this.clearCache();
  
  // Determine redirect URL: redirectUrl param > logoutUrl config > loginUrl config > '/login'
  const finalRedirectUrl = redirectUrl || 
    this.config.logoutUrl || 
    this.config.loginUrl || 
    "/login";
  
  // Construct full URL
  const fullUrl = /^https?:\/\//i.test(finalRedirectUrl)
    ? finalRedirectUrl
    : `${(globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin}${finalRedirectUrl.startsWith("/") ? finalRedirectUrl : `/${finalRedirectUrl}`}`;
  
  // Redirect
  (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fullUrl;
}
```

**Key behaviors:**

- Always clears localStorage tokens (even if API call fails)
- Always clears cache
- Calls logout API if misoClient and token available
- Gracefully handles API failures (continues with cleanup)
- Supports optional redirectUrl parameter
- Falls back: redirectUrl > logoutUrl > loginUrl > '/login'

### 4. Update Tests

**File:** `tests/unit/data-client.test.ts`

Add test suite for `logout()` method in the "Authentication" describe block:

**Test cases:**

1. `should logout and redirect to loginUrl` - Basic logout flow
2. `should logout with custom redirectUrl` - Custom redirect parameter
3. `should logout with logoutUrl config` - Using logoutUrl config
4. `should logout and clear tokens from localStorage` - Verify token cleanup
5. `should logout and clear cache` - Verify cache cleanup
6. `should logout even if API call fails` - Error handling
7. `should logout when misoClient not available` - Fallback behavior
8. `should logout when no token exists` - No token scenario
9. `should handle multiple token keys` - Clear all configured token keys
10. `should construct full URL from relative logoutUrl` - URL construction

**Mock setup:**

- Mock `misoClient.logout()` to return success response
- Mock localStorage.removeItem
- Mock window.location.href assignment
- Test both success and error scenarios

### 5. Update API Reference Documentation

**File:** `docs/api-reference.md`

Add new section after `redirectToLogin()` documentation (around line 402):

````markdown
#### `logout(redirectUrl?: string): Promise<void>`

Logout user, clear authentication state, and redirect. Calls the controller logout API (if available), clears tokens from localStorage, clears HTTP cache, and redirects to logout URL or login page.

**Parameters:**

- `redirectUrl` - Optional redirect URL after logout (defaults to `logoutUrl` config, then `loginUrl` config, then `/login`)

**How it works:**

1. Gets current token from localStorage
2. Calls `misoClient.logout({ token })` if misoClient and token available
3. Clears all configured token keys from localStorage
4. Clears HTTP response cache
5. Redirects to logout URL (redirectUrl param > logoutUrl config > loginUrl config > '/login')

**Note:** Logout always clears local state (tokens, cache) even if the API call fails. This ensures users are logged out locally regardless of network issues.

**Example:**

```typescript
// Basic logout - redirects to loginUrl or '/login'
await dataClient.logout();

// Logout and redirect to home page
await dataClient.logout('/home');

// Logout and redirect to custom URL
await dataClient.logout('https://myapp.com/goodbye');

// Configure logoutUrl in config
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  logoutUrl: '/goodbye', // Custom logout page
});

await dataClient.logout(); // Redirects to /goodbye
````
````

### 6. Update DataClient Documentation
**File:** `docs/data-client.md`

Add new section after "Redirect to Login with Custom URL" (around line 461):

```markdown
### Logout User

```typescript
// Basic logout - redirects to login page
await dataClient.logout();

// Logout and redirect to home page
await dataClient.logout('/home');

// Configure custom logout URL
const dataClient = new DataClient({
  baseUrl: 'https://api.example.com',
  misoConfig: { /* ... */ },
  logoutUrl: '/goodbye', // Custom logout page
});

await dataClient.logout(); // Redirects to /goodbye
````

**What logout does:**

- Calls controller logout API to invalidate server-side session
- Clears authentication tokens from localStorage
- Clears HTTP response cache
- Redirects to logout URL or login page

```

Update API Reference section (around line 1025):

- Add `logout(redirectUrl?: string): Promise<void>` to Utility Methods list

### 7. Update Type Definitions Documentation

**File:** `src/types/data-client.types.ts`

Update JSDoc comment for `DataClientConfig` interface:

- Document `logoutUrl?: string` property
- Explain fallback behavior to `loginUrl`

## Files to Modify

1. `src/types/data-client.types.ts` - Add logoutUrl config property
2. `src/utils/data-client.ts` - Add logout() method implementation
3. `tests/unit/data-client.test.ts` - Add comprehensive test suite
4. `docs/api-reference.md` - Add logout() API documentation
5. `docs/data-client.md` - Add logout usage examples

## Testing Checklist

- [ ] Logout with misoClient available and token exists
- [ ] Logout with misoClient unavailable (fallback)
- [ ] Logout with no token (should still clear cache and redirect)
- [ ] Logout API call failure (should still clear local state)
- [ ] Custom redirectUrl parameter
- [ ] logoutUrl config usage
- [ ] Multiple token keys cleared
- [ ] Cache cleared after logout
- [ ] URL construction (relative/absolute)
- [ ] SSR compatibility (no-op in non-browser)

## Implementation Notes

- Logout should always clear local state even if API call fails (defensive programming)
- Follow same URL construction pattern as `redirectToLogin()`
- Use same browser detection pattern (`isBrowser()`)
- Maintain consistency with existing code style and error handling
- Ensure graceful degradation when misoClient unavailable