<!-- f46b2991-bd85-4fcc-9877-4c4e90701151 324ea9ba-6e31-4570-8f01-6402e3565128 -->
# Implement Structured Error Response Interface

Create a generic, reusable error response model following RFC 7807-style structure and integrate it with the existing error handling.

## Implementation Steps

1. **Create Error Response Model** (`src/types/config.types.ts`)

- Add new interface `ErrorResponse` matching the specified structure:
  - `errors`: Array of error messages (string[])
  - `type`: Error type URI (string, e.g., "/Errors/Bad Input")
  - `title`: Human-readable title (string)
  - `statusCode`: HTTP status code (number) - also support `status_code` alias for snake_case compatibility
  - `instance`: Request instance URI (optional string)
- Add helper type guard function `isErrorResponse(data: unknown): data is ErrorResponse` to validate error response structure
- Export from `src/types/config.types.ts` alongside other types

2. **Create MisoClientError Class** (`src/utils/errors.ts`)

- Create new file `src/utils/errors.ts` with `MisoClientError` class extending `Error`
- Add optional `errorResponse?: ErrorResponse` field to store structured error response object
- Add optional `errorBody?: Record<string, unknown>` field for backward compatibility with existing error_body dict
- Add optional `statusCode?: number` field to store HTTP status code
- Constructor accepts:
  - `message: string` (required)
  - `errorResponse?: ErrorResponse` (optional)
  - `errorBody?: Record<string, unknown>` (optional)
  - `statusCode?: number` (optional)
- Update `message` property generation to prioritize structured errors when available:
  - If `errorResponse` exists, use `errorResponse.title` or first error from `errorResponse.errors`
  - Otherwise fall back to provided message
- Export from `src/utils/errors.ts`

3. **Update HttpClient Error Parsing** (`src/utils/http-client.ts`)

- Add private helper method `parseErrorResponse(error: AxiosError, requestUrl?: string): ErrorResponse | null`:
  - Try to parse `error.response?.data` as JSON
  - Validate structure using `isErrorResponse()` type guard
  - Extract instance URI from request URL when available
  - Return `ErrorResponse` object if parsing succeeds, `null` otherwise
- Add private helper method `createMisoClientError(error: AxiosError, requestUrl?: string): MisoClientError`:
  - Attempt to parse structured error response
  - If parsing succeeds, create `MisoClientError` with `ErrorResponse` object
  - If parsing fails, create `MisoClientError` with `errorBody` from response data (backward compatibility)
  - Extract status code from `error.response?.status`
- Update all HTTP method error handlers (get, post, put, delete, authenticatedRequest):
  - Wrap try-catch blocks around axios calls
  - Catch `AxiosError` and convert to `MisoClientError` using helper method
  - Re-throw `MisoClientError` instead of raw `AxiosError`
- Update response interceptor to handle structured errors (enhance 401 errors with structured error info if available)

4. **Update Module Exports** (`src/index.ts`)

- Export `ErrorResponse` interface from `src/types/config.types.ts`
- Export `MisoClientError` class from `src/utils/errors.ts`
- Update exports documentation in code comments

5. **Update Error Tests** (`tests/unit/errors.test.ts`)

- Create new test file `tests/unit/errors.test.ts`
- Add tests for `ErrorResponse` type guard function:
  - Valid error response structure
  - Invalid structures (missing fields, wrong types)
  - Support for both camelCase and snake_case statusCode
- Add tests for `MisoClientError` class:
  - Constructor with `ErrorResponse` object
  - Constructor with `errorBody` dict (backward compatibility)
  - Constructor with both `ErrorResponse` and `errorBody`
  - Message generation priority (ErrorResponse > message)
  - Status code handling

6. **Update HTTP Client Tests** (`tests/unit/http-client.test.ts`)

- Update existing error handling tests to expect `MisoClientError` instead of `AxiosError`
- Add new tests for parsing structured error responses:
  - Parse RFC 7807-style error response successfully
  - Create `MisoClientError` with `ErrorResponse` when structured error is present
  - Fallback to `errorBody` when response doesn't match structured format
  - Test instance URI extraction from request URL
  - Test support for both camelCase (`statusCode`) and snake_case (`status_code`)
  - Test all HTTP methods (get, post, put, delete, authenticatedRequest)
- Maintain backward compatibility tests (non-structured errors still work)

7. **Update Documentation** (`docs/`)

- Update `docs/api-reference.md`:
  - Add section "Structured Error Responses" after "Error Handling Best Practices"
  - Document `ErrorResponse` interface structure and fields
  - Document `MisoClientError` class usage
  - Add example of accessing structured error information:
    ```typescript
    try {
      await client.validateToken(token);
    } catch (error) {
      if (error instanceof MisoClientError && error.errorResponse) {
        console.error('Error type:', error.errorResponse.type);
        console.error('Error title:', error.errorResponse.title);
        console.error('Errors:', error.errorResponse.errors);
        console.error('Status code:', error.errorResponse.statusCode);
      }
    }
    ```

- Update `docs/troubleshooting.md`:
  - Add section about structured error responses in "Error Codes" section
  - Show how to access structured error details
  - Document backward compatibility with non-structured errors
- Update `docs/examples.md`:
  - Enhance existing error handling examples to show structured error access
  - Add dedicated example section "Handling Structured Errors"

8. **Update Changelog** (`CHANGELOG.md` if exists, or create entry)

- Add entry for structured error response feature
- Document `ErrorResponse` interface addition
- Document `MisoClientError` class addition
- Document backward compatibility
- Note breaking change: HTTP methods now throw `MisoClientError` instead of `AxiosError` (but message and errorBody remain accessible for compatibility)

## Technical Details

- Error response parsing should be lenient - if JSON parsing fails or structure doesn't match, fall back to existing behavior
- Maintain full backward compatibility - existing error handling code should continue to work
- `statusCode` field supports both camelCase (`statusCode`) and snake_case (`status_code`) for compatibility
- Instance URI should be extracted from the request URL when available
- All error handling should gracefully degrade if structured error parsing fails

### To-dos

- [ ] Create ErrorResponse interface in src/types/config.types.ts with fields: errors, type, title, statusCode (support camelCase/snake_case), instance (optional). Add isErrorResponse type guard function.
- [ ] Create MisoClientError class in src/utils/errors.ts extending Error, with errorResponse, errorBody, and statusCode fields. Implement message generation priority.
- [ ] Update src/utils/http-client.ts to parse structured error responses, create MisoClientError instances, and update all HTTP methods (get, post, put, delete, authenticatedRequest) to throw MisoClientError.
- [ ] Export ErrorResponse and MisoClientError from src/index.ts
- [ ] Create tests/unit/errors.test.ts with tests for ErrorResponse type guard and MisoClientError class
- [ ] Update tests/unit/http-client.test.ts to test structured error response parsing, backward compatibility, and instance URI extraction
- [ ] Add Structured Error Responses section to docs/api-reference.md with ErrorResponse and MisoClientError documentation and examples
- [ ] Update docs/troubleshooting.md Error Codes section with structured error response information
- [ ] Update docs/examples.md with structured error handling examples and new dedicated section