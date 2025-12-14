---
name: Implement Login and Logout Services
overview: Update the authentication service to implement login and logout methods that match the provided API specification. Login will make a GET request with query parameters and return a response object, while logout will accept a token parameter and send it in the request body.
todos: []
---

# Implement Login and Logout Services

## Overview

Update the `AuthService` to implement login and logout methods that match the provided API specification. The login method will make an actual API call (instead of just returning a URL), and logout will accept a token parameter.

## Changes Required

### 1. Add Response Types (`src/types/config.types.ts`)

- Add `LoginResponse` interface:
  ```typescript
  interface LoginResponse {
    success: boolean;
    data: {
      loginUrl: string;
      state: string;
    };
    timestamp: string;
  }
  ```

- Add `LogoutResponse` interface:
  ```typescript
  interface LogoutResponse {
    success: boolean;
    message: string;
    timestamp: string;
  }
  ```


### 2. Update AuthService (`src/services/auth.service.ts`)

- **Update `login()` method**:
  - Change signature from `login(redirectUri: string): string` to `login(params: { redirect: string; state?: string }): Promise<LoginResponse>`
  - Make it async and use `httpClient.request()` to make GET request to `/api/v1/auth/login`
  - Add query parameters: `redirect` (required) and `state` (optional)
  - Return the full response object
  - Handle errors appropriately

- **Update `logout()` method**:
  - Change signature from `logout(): Promise<void>` to `logout(params: { token: string }): Promise<LogoutResponse>`
  - Use `httpClient.request()` to make POST request to `/api/v1/auth/logout`
  - Send token in request body: `{ token: string }`
  - Return the full response object
  - Maintain existing error handling for 400 status codes (graceful handling)

### 3. Update MisoClient Wrapper (`src/index.ts`)

- Update `login()` method to match new signature and return type
- Update `logout()` method to match new signature and return type

### 4. Update Tests (`tests/unit/auth.service.test.ts`)

- Update login tests to:
  - Test async API call with query parameters
  - Test response structure
  - Test error handling
- Update logout tests to:
  - Test with token parameter
  - Test request body contains token
  - Test response structure
  - Maintain existing 400 error handling tests

## Implementation Details

### Login Method

- Endpoint: `GET /api/v1/auth/login?redirect={redirect}&state={state}`
- Uses `httpClient.request()` (client token is automatic via interceptor)
- Query params: `redirect` (required), `state` (optional)
- Returns: `LoginResponse` with `loginUrl` and `state`

### Logout Method

- Endpoint: `POST /api/v1/auth/logout`
- Uses `httpClient.request()` (client token is automatic via interceptor)
- Request body: `{ token: string }`
- Returns: `LogoutResponse` with success message
- Maintains graceful 400 error handling (no active session)

## Files to Modify

1. `src/types/config.types.ts` - Add response types
2. `src/services/auth.service.ts` - Update login and logout methods
3. `src/index.ts` - Update wrapper methods
4. `tests/unit/auth.service.test.ts` - Update tests

## Notes

- This is a breaking change: `login()` signature changes from sync string return to async object return
- `logout()` now requires a token parameter
- All public API outputs use camelCase (as per repo rules)
- Client token authentication is handled automatically by HttpClient interceptor