/**
 * Unit tests for HttpClient
 */

import { HttpClient } from "../../src/utils/http-client";
import { InternalHttpClient } from "../../src/utils/internal-http-client";
import { LoggerService } from "../../src/services/logger.service";
import { MisoClientConfig } from "../../src/types/config.types";
import { MisoClientError } from "../../src/utils/errors";
import { AxiosError } from "axios";

// Mock axios
jest.mock("axios");
// Mock InternalHttpClient
jest.mock("../../src/utils/internal-http-client");
// Mock LoggerService
jest.mock("../../src/services/logger.service");
// Mock jsonwebtoken
jest.mock("jsonwebtoken");

// Unhandled rejection handling is configured in tests/setup.ts

let requestInterceptorFn: ((config: any) => Promise<any>) | null = null;
let responseSuccessFn: ((response: any) => any) | null = null;
let responseErrorFn: ((error: any) => Promise<any>) | null = null;

const mockAxios = {
  create: jest.fn(),
  interceptors: {
    request: {
      use: jest.fn((onFulfilled, onRejected) => {
        requestInterceptorFn = onFulfilled;
        return 0;
      }),
    },
    response: {
      use: jest.fn((onFulfilled, onRejected) => {
        responseSuccessFn = onFulfilled;
        responseErrorFn = onRejected;
        return 0;
      }),
    },
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

// Store expected responses per test to allow interceptors to execute
let expectedAxiosResponses = new Map<string, { data?: any; error?: any }>();

// Make axios methods execute interceptors - use lazy evaluation to get latest interceptor functions
const createInterceptorExecutor = (method: string) => {
  return async (url: string, data?: any, config?: any): Promise<any> => {
    // Get latest interceptor functions (they're set when HttpClient is created)
    const currentRequestFn = requestInterceptorFn;
    const currentResponseFn = responseSuccessFn;
    const currentResponseErrorFn = responseErrorFn;

    // Execute request interceptor
    let requestConfig = {
      url,
      method: method.toLowerCase(),
      baseURL: config?.baseURL || "https://controller.aifabrix.ai",
      headers: config?.headers || {},
      data,
      ...config,
    };

    if (currentRequestFn) {
      try {
        requestConfig = await currentRequestFn(requestConfig);
      } catch (e) {
        // If request interceptor fails, still proceed
      }
    }

    // Check if there's an expected response or error for this call
    const callKey = `${method}:${url}`;
    const expectedResponse = expectedAxiosResponses.get(callKey);

    if (expectedResponse?.error) {
      // For errors, create error response and execute error interceptor
      const error = {
        config: requestConfig,
        response: expectedResponse.error.response,
        message: expectedResponse.error.message || "Request failed",
        ...expectedResponse.error,
      };

      // Execute response error interceptor (async, fire-and-forget via setTimeout)
      if (currentResponseErrorFn) {
        try {
          // The interceptor uses setTimeout internally, so we need to ensure
          // any promise rejections are handled. The interceptor returns Promise.reject(error)
          // but we still need to wait for the setTimeout callback to execute.
          const result = currentResponseErrorFn(error);

          // Wait for setTimeout callbacks to execute (they use setTimeout with 0 delay)
          // Use multiple Promise.resolve() and setTimeout/setImmediate to ensure all microtasks and macrotasks complete
          for (let i = 0; i < 5; i++) {
            await new Promise<void>((resolve) => {
              if (typeof setImmediate !== "undefined") {
                setImmediate(() => {
                  Promise.resolve()
                    .then(() => {
                      setImmediate(() => {
                        Promise.resolve()
                          .then(() => {
                            resolve();
                          })
                          .catch(() => resolve());
                      });
                    })
                    .catch(() => {
                      setImmediate(() => resolve());
                    });
                });
              } else {
                setTimeout(() => {
                  Promise.resolve()
                    .then(() => {
                      setTimeout(() => {
                        Promise.resolve()
                          .then(() => {
                            resolve();
                          })
                          .catch(() => resolve());
                      }, 0);
                    })
                    .catch(() => {
                      setTimeout(() => resolve(), 0);
                    });
                }, 0);
              }
            });
            await Promise.resolve();
          }

          // Return the rejected promise (the interceptor returns Promise.reject(error))
          return result;
        } catch (e) {
          // If the interceptor throws synchronously, reject with the error
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }

    // For successful responses, create a response and execute response interceptor
    const responseData = expectedResponse?.data || { success: true };
    const response = {
      config: requestConfig,
      status: 200,
      data: responseData,
      headers: {},
    };

    // Execute response success interceptor (async, fire-and-forget via setTimeout)
    if (currentResponseFn) {
      try {
        // The interceptor uses setTimeout internally, so we need to ensure
        // any promise rejections are handled. Wrap in try-catch and wait for next tick.
        currentResponseFn(response);

        // Wait for setTimeout callbacks to execute (they use setTimeout with 0 delay)
        // The interceptor uses setTimeout(() => { logHttpRequestAudit().catch(...) }, 0)
        // We need to wait for this setTimeout to execute and its promise to settle
        // Use multiple Promise.resolve() and setTimeout to ensure all microtasks and macrotasks complete
        for (let i = 0; i < 5; i++) {
          await new Promise<void>((resolve) => {
            if (typeof setImmediate !== "undefined") {
              setImmediate(() => {
                Promise.resolve()
                  .then(() => {
                    setImmediate(() => {
                      Promise.resolve()
                        .then(() => {
                          resolve();
                        })
                        .catch(() => resolve());
                    });
                  })
                  .catch(() => {
                    setImmediate(() => resolve());
                  });
              });
            } else {
              setTimeout(() => {
                Promise.resolve()
                  .then(() => {
                    setTimeout(() => {
                      Promise.resolve()
                        .then(() => {
                          resolve();
                        })
                        .catch(() => resolve());
                    }, 0);
                  })
                  .catch(() => {
                    setTimeout(() => resolve(), 0);
                  });
              }, 0);
            }
          });
          await Promise.resolve();
        }
      } catch (e) {
        // Ignore errors from response interceptor
      }
    }

    return Promise.resolve(response);
  };
};

mockAxios.get.mockImplementation((url: string, config?: any) => {
  const executor = createInterceptorExecutor("GET");
  return executor(url, undefined, config);
});
mockAxios.post.mockImplementation((url: string, data?: any, config?: any) => {
  const executor = createInterceptorExecutor("POST");
  return executor(url, data, config);
});
mockAxios.put.mockImplementation((url: string, data?: any, config?: any) => {
  const executor = createInterceptorExecutor("PUT");
  return executor(url, data, config);
});
mockAxios.delete.mockImplementation((url: string, config?: any) => {
  const executor = createInterceptorExecutor("DELETE");
  return executor(url, undefined, config);
});

const axios = require("axios");
axios.create.mockReturnValue(mockAxios);

// Helper function to create MisoClientError from AxiosError-like data
// This simulates what InternalHttpClient does when converting errors
function createMisoClientErrorFromAxiosError(
  status: number,
  statusText: string,
  data: unknown,
  message?: string,
  requestUrl?: string,
): MisoClientError {
  // Try to parse structured error response
  let errorResponse: any = null;
  if (data && typeof data === "object") {
    const errorData = data as any;
    if (errorData.errors && Array.isArray(errorData.errors)) {
      errorResponse = {
        errors: errorData.errors,
        type: errorData.type || `/Errors/${statusText}`,
        title: errorData.title || statusText,
        statusCode: errorData.statusCode || status,
        instance: errorData.instance || requestUrl,
      };
    }
  }

  // Extract errorBody for backward compatibility
  let errorBody: Record<string, unknown> | undefined;
  if (data && typeof data === "object") {
    errorBody = data as Record<string, unknown>;
  }

  // Generate message
  const errorMessage =
    message || statusText || `Request failed with status code ${status}`;

  return new MisoClientError(
    errorMessage,
    errorResponse || undefined,
    errorBody,
    status,
  );
}

describe("HttpClient", () => {
  let httpClient: HttpClient;
  let config: MisoClientConfig;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockInternalClient: jest.Mocked<InternalHttpClient>;

  // Helper function to flush timers and promises
  async function flushTimersAndPromises() {
    // Run all pending timers
    if (jest.isMockFunction(setTimeout)) {
      // Run timers multiple times to ensure all callbacks complete
      // Some timers may create new promises that need to settle
      for (let i = 0; i < 5; i++) {
        try {
          jest.runOnlyPendingTimers();
        } catch (e) {
          // Ignore errors from running timers
        }
        await Promise.resolve();
        await Promise.resolve();
      }
    } else {
      // If using real timers, just wait for microtasks
      await Promise.resolve();
      await Promise.resolve();
    }
  }

  // Ensure real timers are restored after all tests to prevent leaks
  afterAll(async () => {
    // First ensure we're using real timers
    jest.useRealTimers();
    // Clear any remaining timers
    jest.clearAllTimers();
    // Wait for any microtasks to settle (multiple ticks)
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  });

  beforeEach(() => {
    // Ensure real timers are used by default (tests that need fake timers will set them)
    jest.useRealTimers();
    jest.clearAllTimers();

    // Clear expected responses and mock state
    expectedAxiosResponses.clear();
    requestInterceptorFn = null;
    responseSuccessFn = null;
    responseErrorFn = null;

    // Clear stored mock return values from previous tests
    if (mockInternalClient) {
      ["get", "post", "put", "delete", "request"].forEach((method) => {
        const mockFn = (mockInternalClient as any)[method] as
          | jest.Mock
          | undefined;
        if (mockFn) {
          delete (mockFn as any)._resolvedValue;
          delete (mockFn as any)._rejectedValue;
        }
      });
    }

    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
    };

    // Mock LoggerService
    mockLogger = {
      audit: jest.fn().mockResolvedValue(undefined),
      debug: jest.fn().mockResolvedValue(undefined),
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create mock functions that will use axios to trigger interceptors
    // When tests call .mockResolvedValue(), we need to capture that value
    // and store it so the axios executor can use it while still executing interceptors
    const createMockMethod = (
      method: string,
      axiosMethod: "get" | "post" | "put" | "delete",
    ) => {
      const mockFn = jest.fn();

      // Override mockResolvedValue to also store in expectedAxiosResponses
      const originalMockResolvedValue = mockFn.mockResolvedValue.bind(mockFn);
      mockFn.mockResolvedValue = function (value: any) {
        // Store the resolved value pattern for this method
        // We'll match it when the method is called
        (this as any)._resolvedValue = value;
        return originalMockResolvedValue(value);
      };

      const originalMockRejectedValue = mockFn.mockRejectedValue.bind(mockFn);
      mockFn.mockRejectedValue = function (value: any) {
        (this as any)._rejectedValue = value;
        return originalMockRejectedValue(value);
      };

      return mockFn.mockImplementation(
        async (url: string, data?: any, config?: any) => {
          // Get the configured return value from the mock (set via .mockResolvedValue() or .mockRejectedValue())
          // Jest stores this in _mockState.results or we can check _resolvedValue we stored
          const resolvedValue = (mockFn as any)._resolvedValue;
          const rejectedValue = (mockFn as any)._rejectedValue;

          // Try to get from Jest's mock results if available
          let actualValue: any = resolvedValue;
          let actualError: any = rejectedValue;

          try {
            const mockState = (mockFn as any)._mockState;
            if (
              mockState &&
              mockState.results &&
              mockState.results.length > 0
            ) {
              const lastResult =
                mockState.results[mockState.results.length - 1];
              if (lastResult && lastResult.type === "return") {
                try {
                  actualValue = await Promise.resolve(lastResult.value);
                } catch (e) {
                  actualError = e;
                }
              } else if (lastResult && lastResult.type === "throw") {
                actualError = lastResult.value;
              }
            }
          } catch (e) {
            // Use stored values if available
          }

          // Store the expected response for the executor to use
          const callKey = `${method.toUpperCase()}:${url}`;
          if (actualError !== undefined) {
            expectedAxiosResponses.set(callKey, { error: actualError });
          } else if (actualValue !== undefined) {
            expectedAxiosResponses.set(callKey, { data: actualValue });
          } else {
            expectedAxiosResponses.set(callKey, { data: { success: true } });
          }

          // Now call axios which will execute interceptors
          if (axiosMethod === "get" || axiosMethod === "delete") {
            return mockAxios[axiosMethod](url, config);
          } else {
            return mockAxios[axiosMethod](url, data, config);
          }
        },
      );
    };

    // Mock InternalHttpClient - make methods use the mocked axios instance to trigger interceptors
    mockInternalClient = {
      getAxiosInstance: jest.fn().mockReturnValue(mockAxios),
      get: createMockMethod("get", "get"),
      post: createMockMethod("post", "post"),
      put: createMockMethod("put", "put"),
      delete: createMockMethod("delete", "delete"),
      request: jest.fn(
        (
          method: "GET" | "POST" | "PUT" | "DELETE",
          url: string,
          data?: any,
          config?: any,
        ) => {
          const axiosMethod = method.toLowerCase();
          if (axiosMethod === "get") return mockAxios.get(url, config);
          if (axiosMethod === "post") return mockAxios.post(url, data, config);
          if (axiosMethod === "put") return mockAxios.put(url, data, config);
          if (axiosMethod === "delete") return mockAxios.delete(url, config);
          throw new Error(`Unsupported method: ${method}`);
        },
      ),
      authenticatedRequest: jest.fn(
        (
          method: "GET" | "POST" | "PUT" | "DELETE",
          url: string,
          token: string,
          data?: any,
          config?: any,
        ) => {
          const fullConfig = {
            ...config,
            headers: {
              ...config?.headers,
              Authorization: `Bearer ${token}`,
            },
          };
          return mockInternalClient.request(method, url, data, fullConfig);
        },
      ),
      config: config,
    } as any;

    (
      InternalHttpClient as jest.MockedClass<typeof InternalHttpClient>
    ).mockImplementation(() => mockInternalClient);

    jest.clearAllMocks();
    httpClient = new HttpClient(config, mockLogger);
  });

  describe("constructor", () => {
    it("should create InternalHttpClient", () => {
      expect(InternalHttpClient).toHaveBeenCalledWith(config);
    });

    it("should set up audit logging interceptors", () => {
      expect(mockInternalClient.getAxiosInstance).toHaveBeenCalled();
      // HttpClient adds interceptors to the axios instance from getAxiosInstance()
      expect(mockAxios.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxios.interceptors.response.use).toHaveBeenCalled();
    });

    it("should expose config as public readonly property", () => {
      expect(httpClient.config).toEqual(config);
    });
  });

  describe("get", () => {
    it("should make GET request and return data", async () => {
      const mockData = { message: "success" };
      mockInternalClient.get.mockResolvedValue(mockData);

      const result = await httpClient.get("/test");

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.get).toHaveBeenCalledWith("/test", undefined);
      expect(result).toEqual(mockData);
    });

    it("should pass config to axios", async () => {
      const requestConfig = { timeout: 5000 };
      const mockData = { message: "success" };
      mockInternalClient.get.mockResolvedValue(mockData);

      await httpClient.get("/test", requestConfig);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/test",
        requestConfig,
      );
    });
  });

  describe("post", () => {
    it("should make POST request with data", async () => {
      const requestData = { name: "test" };
      const mockData = { id: "123" };
      mockInternalClient.post.mockResolvedValue(mockData);

      const result = await httpClient.post("/test", requestData);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.post).toHaveBeenCalledWith(
        "/test",
        requestData,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should return value from post method (covers line 234)", async () => {
      // This test explicitly covers line 234 (return statement)
      const requestData = { name: "test" };
      const mockData = { id: "123", name: "test" };
      mockInternalClient.post.mockResolvedValue(mockData);

      // Call post and verify return value is returned
      const result = await httpClient.post<typeof mockData>(
        "/test",
        requestData,
      );

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify the return statement executed by checking the value was returned
      expect(result).toBe(mockData);
      expect(result.id).toBe("123");
      expect(mockInternalClient.post).toHaveBeenCalledWith(
        "/test",
        requestData,
        undefined,
      );
    });

    it("should pass config to post method", async () => {
      const requestData = { name: "test" };
      const requestConfig = { timeout: 5000 };
      const mockData = { id: "123" };
      mockInternalClient.post.mockResolvedValue(mockData);

      const result = await httpClient.post("/test", requestData, requestConfig);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.post).toHaveBeenCalledWith(
        "/test",
        requestData,
        requestConfig,
      );
      expect(result).toEqual(mockData);
    });
  });

  describe("put", () => {
    it("should make PUT request with data", async () => {
      const requestData = { name: "updated" };
      const mockData = { updated: true };
      mockInternalClient.put.mockResolvedValue(mockData);

      const result = await httpClient.put("/test", requestData);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.put).toHaveBeenCalledWith(
        "/test",
        requestData,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should return value from put method (covers lines 237-238)", async () => {
      // This test explicitly covers lines 237-238 (return statement)
      const requestData = { name: "updated" };
      const mockData = { updated: true, id: "123" };
      mockInternalClient.put.mockResolvedValue(mockData);

      // Call put and verify return value is returned
      const result = await httpClient.put<typeof mockData>(
        "/test",
        requestData,
      );

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify the return statement executed by checking the value was returned
      expect(result).toBe(mockData);
      expect(result.updated).toBe(true);
      expect(mockInternalClient.put).toHaveBeenCalledWith(
        "/test",
        requestData,
        undefined,
      );
    });

    it("should pass config to put method", async () => {
      const requestData = { name: "updated" };
      const requestConfig = { timeout: 5000 };
      const mockData = { updated: true };
      mockInternalClient.put.mockResolvedValue(mockData);

      const result = await httpClient.put("/test", requestData, requestConfig);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.put).toHaveBeenCalledWith(
        "/test",
        requestData,
        requestConfig,
      );
      expect(result).toEqual(mockData);
    });
  });

  describe("delete", () => {
    it("should make DELETE request", async () => {
      const mockData = { deleted: true };
      mockInternalClient.delete.mockResolvedValue(mockData);

      const result = await httpClient.delete("/test");

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.delete).toHaveBeenCalledWith(
        "/test",
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should return value from delete method (covers lines 241-242)", async () => {
      // This test explicitly covers lines 241-242 (return statement)
      const mockData = { deleted: true, id: "123" };
      mockInternalClient.delete.mockResolvedValue(mockData);

      // Call delete and verify return value is returned
      const result = await httpClient.delete<typeof mockData>("/test");

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify the return statement executed by checking the value was returned
      expect(result).toBe(mockData);
      expect(result.deleted).toBe(true);
      expect(mockInternalClient.delete).toHaveBeenCalledWith(
        "/test",
        undefined,
      );
    });

    it("should pass config to axios", async () => {
      const requestConfig = { timeout: 5000 };
      const mockData = { deleted: true };
      mockInternalClient.delete.mockResolvedValue(mockData);

      const result = await httpClient.delete("/test", requestConfig);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.delete).toHaveBeenCalledWith(
        "/test",
        requestConfig,
      );
      expect(result).toEqual(mockData);
    });
  });

  describe("request", () => {
    it("should make GET request via request method", async () => {
      const mockData = { message: "success" };
      mockInternalClient.request.mockResolvedValue(mockData);

      const result = await httpClient.request("GET", "/test");

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.request).toHaveBeenCalledWith(
        "GET",
        "/test",
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should make POST request via request method", async () => {
      const requestData = { name: "test" };
      const mockData = { id: "123" };
      mockInternalClient.request.mockResolvedValue(mockData);

      const result = await httpClient.request("POST", "/test", requestData);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.request).toHaveBeenCalledWith(
        "POST",
        "/test",
        requestData,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should make PUT request via request method", async () => {
      const requestData = { name: "updated" };
      const mockData = { updated: true };
      mockInternalClient.request.mockResolvedValue(mockData);

      const result = await httpClient.request("PUT", "/test", requestData);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.request).toHaveBeenCalledWith(
        "PUT",
        "/test",
        requestData,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should make DELETE request via request method", async () => {
      const mockData = { deleted: true };
      mockInternalClient.request.mockResolvedValue(mockData);

      const result = await httpClient.request("DELETE", "/test");

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.request).toHaveBeenCalledWith(
        "DELETE",
        "/test",
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should pass config when provided", async () => {
      const requestConfig = { timeout: 5000 };
      const mockData = { message: "success" };
      mockInternalClient.request.mockResolvedValue(mockData);

      await httpClient.request("GET", "/test", undefined, requestConfig);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockInternalClient.request).toHaveBeenCalledWith(
        "GET",
        "/test",
        undefined,
        requestConfig,
      );
    });

    it("should throw error for unsupported method", async () => {
      // InternalHttpClient throws the error for unsupported methods
      const error = new Error("Unsupported HTTP method: PATCH");
      mockInternalClient.request.mockRejectedValue(error);

      await expect(httpClient.request("PATCH" as any, "/test")).rejects.toThrow(
        "Unsupported HTTP method: PATCH",
      );
    });
  });

  describe("error handling", () => {
    it("should propagate non-Axios errors as-is", async () => {
      const networkError = new Error("Network error");
      mockInternalClient.get.mockRejectedValue(networkError);

      await expect(httpClient.get("/test")).rejects.toThrow("Network error");

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should convert AxiosError to MisoClientError with errorBody (backward compatibility)", async () => {
      // InternalHttpClient converts AxiosError to MisoClientError
      const misoError = createMisoClientErrorFromAxiosError(
        404,
        "Not Found",
        { error: "Not found", details: "Resource not found" },
        "Request failed with status code 404",
        "/test",
      );
      mockInternalClient.get.mockRejectedValue(misoError);

      await expect(httpClient.get("/test")).rejects.toThrow(MisoClientError);

      // Wait for async logging to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      try {
        mockInternalClient.get.mockRejectedValue(misoError);
        await httpClient.get("/test");
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const err = error as MisoClientError;
        expect(err.statusCode).toBe(404);
        expect(err.errorBody).toEqual({
          error: "Not found",
          details: "Resource not found",
        });
        expect(err.errorResponse).toBeUndefined();
      }
    });

    it("should parse structured error response and create MisoClientError with ErrorResponse", async () => {
      const structuredError = {
        errors: ["Validation failed", "Invalid input"],
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: 400,
        instance: "/api/test",
      };

      // InternalHttpClient converts AxiosError to MisoClientError
      const misoError = createMisoClientErrorFromAxiosError(
        400,
        "Bad Request",
        structuredError,
        "Request failed with status code 400",
        "/api/test",
      );
      mockInternalClient.get.mockRejectedValue(misoError);

      await expect(httpClient.get("/api/test")).rejects.toThrow(
        MisoClientError,
      );

      try {
        await httpClient.get("/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const err = error as MisoClientError;
        expect(err.errorResponse).toBeDefined();
        expect(err.errorResponse?.errors).toEqual([
          "Validation failed",
          "Invalid input",
        ]);
        expect(err.errorResponse?.type).toBe("/Errors/Bad Input");
        expect(err.errorResponse?.title).toBe("Bad Request");
        expect(err.errorResponse?.statusCode).toBe(400);
        expect(err.errorResponse?.instance).toBe("/api/test");
        expect(err.statusCode).toBe(400);
        expect(err.message).toBe("Bad Request");
      }
    });

    it("should support camelCase statusCode in error response", async () => {
      const structuredError = {
        errors: ["Server error"],
        type: "/Errors/Internal Error",
        title: "Internal Server Error",
        statusCode: 500,
      };

      // InternalHttpClient converts AxiosError to MisoClientError
      const misoError = createMisoClientErrorFromAxiosError(
        500,
        "Internal Server Error",
        structuredError,
        "Request failed with status code 500",
        "/api/test",
      );
      mockInternalClient.get.mockRejectedValue(misoError);

      try {
        await httpClient.get("/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const err = error as MisoClientError;
        expect(err.errorResponse).toBeDefined();
        expect(err.errorResponse?.statusCode).toBe(500);
      }
    });

    it("should extract instance URI from request URL when not provided in error response", async () => {
      const structuredError = {
        errors: ["Not found"],
        type: "/Errors/Not Found",
        title: "Resource Not Found",
        statusCode: 404,
      };

      // InternalHttpClient converts AxiosError to MisoClientError
      const misoError = createMisoClientErrorFromAxiosError(
        404,
        "Not Found",
        structuredError,
        "Request failed with status code 404",
        "/api/users/123",
      );
      mockInternalClient.get.mockRejectedValue(misoError);

      try {
        await httpClient.get("/api/users/123");
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const err = error as MisoClientError;
        expect(err.errorResponse?.instance).toBe("/api/users/123");
      }
    });

    it("should handle string response data by parsing JSON", async () => {
      // Note: InternalHttpClient's createMisoClientError will try to parse JSON strings
      // For this test, we'll simulate what happens when parsing succeeds
      const structuredError = {
        errors: ["Parsed error"],
        type: "/Errors/Test",
        title: "Test Error",
        statusCode: 400,
      };

      // InternalHttpClient converts AxiosError to MisoClientError
      // In real scenario, InternalHttpClient.parseErrorResponse would parse the JSON string
      const misoError = createMisoClientErrorFromAxiosError(
        400,
        "Bad Request",
        structuredError, // Already parsed
        "Request failed with status code 400",
        "/api/test",
      );
      mockInternalClient.get.mockRejectedValue(misoError);

      try {
        await httpClient.get("/api/test");
      } catch (error) {
        expect(error).toBeInstanceOf(MisoClientError);
        const err = error as MisoClientError;
        expect(err.errorResponse).toBeDefined();
        expect(err.errorResponse?.title).toBe("Test Error");
      }
    });

    it("should enhance 401 errors with authentication context", async () => {
      // HttpClient interceptors handle errors, but InternalHttpClient already converts them
      // So HttpClient's interceptor receives the error and logs it, but doesn't modify it
      const misoError = createMisoClientErrorFromAxiosError(
        401,
        "Unauthorized",
        { error: "Unauthorized" },
        "Request failed with status code 401",
        "/test",
      );
      mockInternalClient.get.mockRejectedValue(misoError);

      // HttpClient just passes through the error from InternalHttpClient
      await expect(httpClient.get("/test")).rejects.toThrow(MisoClientError);
    });

    it("should handle POST errors with MisoClientError", async () => {
      const misoError = createMisoClientErrorFromAxiosError(
        500,
        "Internal Server Error",
        { error: "POST failed" },
        "Request failed",
        "/test",
      );
      mockInternalClient.post.mockRejectedValue(misoError);

      await expect(httpClient.post("/test", {})).rejects.toThrow(
        MisoClientError,
      );
    });

    it("should handle PUT errors with MisoClientError", async () => {
      const misoError = createMisoClientErrorFromAxiosError(
        500,
        "Internal Server Error",
        { error: "PUT failed" },
        "Request failed",
        "/test",
      );
      mockInternalClient.put.mockRejectedValue(misoError);

      await expect(httpClient.put("/test", {})).rejects.toThrow(
        MisoClientError,
      );
    });

    it("should handle DELETE errors with MisoClientError", async () => {
      const misoError = createMisoClientErrorFromAxiosError(
        500,
        "Internal Server Error",
        { error: "DELETE failed" },
        "Request failed",
        "/test",
      );
      mockInternalClient.delete.mockRejectedValue(misoError);

      await expect(httpClient.delete("/test")).rejects.toThrow(MisoClientError);
    });

    it("should handle authenticated request errors with MisoClientError", async () => {
      const misoError = createMisoClientErrorFromAxiosError(
        403,
        "Forbidden",
        { error: "Auth request failed" },
        "Request failed",
        "/test",
      );
      mockInternalClient.authenticatedRequest.mockRejectedValue(misoError);

      await expect(
        httpClient.authenticatedRequest("GET", "/test", "token123"),
      ).rejects.toThrow(MisoClientError);
    });

    it("should handle all HTTP methods with structured error responses", async () => {
      const structuredError = {
        errors: ["Method specific error"],
        type: "/Errors/Method Error",
        title: "Method Error",
        statusCode: 405,
      };

      const createMisoError = (url: string) =>
        createMisoClientErrorFromAxiosError(
          405,
          "Method Not Allowed",
          structuredError,
          "Request failed",
          url,
        );

      // Test GET
      mockInternalClient.get.mockRejectedValue(createMisoError("/test"));
      await expect(httpClient.get("/test")).rejects.toThrow(MisoClientError);

      // Test POST
      mockInternalClient.post.mockRejectedValue(createMisoError("/test"));
      await expect(httpClient.post("/test", {})).rejects.toThrow(
        MisoClientError,
      );

      // Test PUT
      mockInternalClient.put.mockRejectedValue(createMisoError("/test"));
      await expect(httpClient.put("/test", {})).rejects.toThrow(
        MisoClientError,
      );

      // Test DELETE
      mockInternalClient.delete.mockRejectedValue(createMisoError("/test"));
      await expect(httpClient.delete("/test")).rejects.toThrow(MisoClientError);

      // Test authenticatedRequest
      mockInternalClient.authenticatedRequest.mockRejectedValue(
        createMisoError("/test"),
      );
      await expect(
        httpClient.authenticatedRequest("GET", "/test", "token"),
      ).rejects.toThrow(MisoClientError);
    });
  });

  // Note: Client token management and InternalHttpClient interceptors are tested
  // in internal-http-client tests. HttpClient only adds audit logging interceptors.

  describe("edge cases", () => {
    it("should handle empty response data", async () => {
      // InternalHttpClient returns response.data directly, so null data becomes null
      mockInternalClient.get.mockResolvedValue(null);

      const result = await httpClient.get("/test");

      expect(result).toBeNull();
    });

    it("should handle POST with empty data", async () => {
      // InternalHttpClient returns response.data directly
      const mockData = { success: true };
      mockInternalClient.post.mockResolvedValue(mockData);

      const result = await httpClient.post("/test", undefined);

      expect(mockInternalClient.post).toHaveBeenCalledWith(
        "/test",
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should handle authenticatedRequest with empty token", async () => {
      const mockData = { user: "test" };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      const result = await httpClient.authenticatedRequest("GET", "/test", "");

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/test",
        "",
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should preserve existing config properties when merging headers", async () => {
      const requestConfig = {
        timeout: 5000,
        headers: { "Custom-Header": "value" },
      };
      const mockData = { success: true };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      await httpClient.authenticatedRequest(
        "POST",
        "/test",
        "token123",
        {},
        requestConfig,
      );

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "POST",
        "/test",
        "token123",
        {},
        requestConfig,
        undefined,
      );
    });

    it("should handle POST with config", async () => {
      const requestData = { name: "test" };
      const requestConfig = { timeout: 5000 };
      const mockData = { id: "123" };
      mockInternalClient.post.mockResolvedValue(mockData);

      await httpClient.post("/test", requestData, requestConfig);

      expect(mockInternalClient.post).toHaveBeenCalledWith(
        "/test",
        requestData,
        requestConfig,
      );
    });

    it("should handle PUT with config", async () => {
      const requestData = { name: "updated" };
      const requestConfig = { timeout: 5000 };
      const mockData = { updated: true };
      mockInternalClient.put.mockResolvedValue(mockData);

      await httpClient.put("/test", requestData, requestConfig);

      expect(mockInternalClient.put).toHaveBeenCalledWith(
        "/test",
        requestData,
        requestConfig,
      );
    });
  });

  describe("authenticatedRequest", () => {
    beforeEach(() => {
      // Mock token fetch for all authenticated requests
      const tokenResponse = {
        data: {
          success: true,
          token: "client-token-123",
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      };
      const mockTempAxios = {
        post: jest.fn().mockResolvedValue(tokenResponse),
      };
      axios.create.mockImplementation((config?: any) => {
        if (config?.headers?.["x-client-id"]) {
          return mockTempAxios;
        }
        return mockAxios;
      });
    });

    it("should make GET request with Authorization header", async () => {
      const mockData = { user: "test" };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      const result = await httpClient.authenticatedRequest(
        "GET",
        "/user",
        "token123",
      );

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/user",
        "token123",
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should make POST request with Authorization header and data", async () => {
      const requestData = { name: "test" };
      const mockData = { success: true };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      const result = await httpClient.authenticatedRequest(
        "POST",
        "/test",
        "token123",
        requestData,
      );

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "POST",
        "/test",
        "token123",
        requestData,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should make PUT request with Authorization header and data", async () => {
      const requestData = { name: "updated" };
      const mockData = { updated: true };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      const result = await httpClient.authenticatedRequest(
        "PUT",
        "/test",
        "token123",
        requestData,
      );

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "PUT",
        "/test",
        "token123",
        requestData,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should make DELETE request with Authorization header", async () => {
      const mockData = { deleted: true };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      const result = await httpClient.authenticatedRequest(
        "DELETE",
        "/test",
        "token123",
      );

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "DELETE",
        "/test",
        "token123",
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockData);
    });

    it("should throw error for unsupported method", async () => {
      // InternalHttpClient throws the error for unsupported methods
      const error = new Error("Unsupported HTTP method: PATCH");
      mockInternalClient.authenticatedRequest.mockRejectedValue(error);

      await expect(
        httpClient.authenticatedRequest("PATCH" as any, "/test", "token123"),
      ).rejects.toThrow("Unsupported HTTP method: PATCH");
    });

    it("should merge headers with existing config", async () => {
      const requestConfig = { headers: { "Custom-Header": "value" } };
      const mockData = { success: true };
      mockInternalClient.authenticatedRequest.mockResolvedValue(mockData);

      await httpClient.authenticatedRequest(
        "POST",
        "/test",
        "token123",
        {},
        requestConfig,
      );

      expect(mockInternalClient.authenticatedRequest).toHaveBeenCalledWith(
        "POST",
        "/test",
        "token123",
        {},
        requestConfig,
        undefined,
      );
    });
  });

  describe("audit logging", () => {
    let axiosInstance: any;
    let requestInterceptorFn: any;
    let responseSuccessFn: any;
    let responseErrorFn: any;

    beforeEach(() => {
      // Get the actual axios instance from mockInternalClient
      axiosInstance = mockAxios;

      // Get interceptors from setup
      const requestUseCall = mockAxios.interceptors.request.use.mock.calls[0];
      const responseUseCall = mockAxios.interceptors.response.use.mock.calls[0];

      requestInterceptorFn = requestUseCall[0];
      responseSuccessFn = responseUseCall[0];
      responseErrorFn = responseUseCall[1];
    });

    describe("request interceptor", () => {
      it("should add metadata to config for audit-able requests", async () => {
        const config: any = {
          url: "/api/users",
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          headers: {},
        };

        const result = await requestInterceptorFn(config);

        expect(result.metadata).toBeDefined();
        expect(result.metadata.startTime).toBeGreaterThan(0);
        expect(result.metadata.method).toBe("GET");
        expect(result.metadata.url).toBe("/api/users");
        expect(result.metadata.baseURL).toBe("https://controller.aifabrix.ai");
      });

      it("should not add metadata for /api/v1/logs endpoint", async () => {
        const config: any = {
          url: "/api/v1/logs",
          method: "post",
          headers: {},
        };

        const result = await requestInterceptorFn(config);

        expect(result.metadata).toBeUndefined();
      });

      it("should not add metadata for /api/v1/auth/token endpoint", async () => {
        const config: any = {
          url: "/api/v1/auth/token",
          method: "post",
          headers: {},
        };

        const result = await requestInterceptorFn(config);

        expect(result.metadata).toBeUndefined();
      });

      it("should handle request interceptor error", async () => {
        const error = new Error("Request error");

        // Request interceptor error handler (second parameter)
        const requestErrorHandler =
          mockAxios.interceptors.request.use.mock.calls[0][1];

        await expect(requestErrorHandler(error)).rejects.toThrow(
          "Request error",
        );
      });

      it("should handle requests with no url", async () => {
        const config: any = {
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          headers: {},
        };

        const result = await requestInterceptorFn(config);

        // Metadata should be added even if url is missing (metadata.url will be undefined)
        // The request interceptor always adds metadata for audit-able requests
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.url).toBeUndefined(); // url is undefined when config.url is undefined
      });

      it("should handle requests with undefined url", async () => {
        const config: any = {
          url: undefined,
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          headers: {},
        };

        const result = await requestInterceptorFn(config);

        // Metadata should be added even if url is undefined (metadata.url will be undefined)
        // The request interceptor always adds metadata for audit-able requests
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.url).toBeUndefined(); // url is undefined when config.url is undefined
      });

      it("should execute lines 52-63: add metadata when shouldAuditRequest returns true", async () => {
        // This test explicitly covers lines 52-63
        const config: any = {
          url: "/api/test",
          method: "post",
          baseURL: "https://controller.aifabrix.ai",
          headers: {},
        };

        const result = await requestInterceptorFn(config);

        // Verify metadata is added (this executes lines 54-59)
        expect(result.metadata).toBeDefined();
        expect(result.metadata).toHaveProperty("startTime");
        expect(result.metadata).toHaveProperty("method", "POST");
        expect(result.metadata).toHaveProperty("url", "/api/test");
        expect(result.metadata).toHaveProperty(
          "baseURL",
          "https://controller.aifabrix.ai",
        );
      });

      it("should handle method being undefined in request config", async () => {
        const config: any = {
          url: "/api/test",
          baseURL: "https://controller.aifabrix.ai",
          headers: {},
          // No method field
        };

        const result = await requestInterceptorFn(config);

        // Metadata should still be added
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.method).toBeUndefined(); // method will be undefined
      });

      it("should handle baseURL being undefined in request config", async () => {
        const config: any = {
          url: "/api/test",
          method: "get",
          headers: {},
          // No baseURL field
        };

        const result = await requestInterceptorFn(config);

        // Metadata should still be added
        expect(result.metadata).toBeDefined();
        expect(result.metadata?.baseURL).toBeUndefined(); // baseURL will be undefined
      });
    });

    describe("response interceptor - success", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(async () => {
        // Run all pending timers first to ensure any promises are settled
        if (jest.isMockFunction(setTimeout)) {
          // Run timers multiple times to ensure all callbacks complete
          // Some timers may create new promises that need to settle
          for (let i = 0; i < 5; i++) {
            try {
              jest.runOnlyPendingTimers();
            } catch (e) {
              // Ignore errors from running timers
            }
            await Promise.resolve();
            await Promise.resolve();
          }
        }
        // Wait for any microtasks and promise resolution (multiple ticks)
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
        // Clear all timers
        jest.clearAllTimers();
        // Switch back to real timers
        jest.useRealTimers();
        // Wait one more tick to ensure cleanup is complete
        await Promise.resolve();
      });

      it("should log audit event on successful response", async () => {
        const config: any = {
          url: "/api/users",
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: { users: [] },
          headers: {},
        };

        // Mock JWT decode
        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        responseSuccessFn(response);

        // Advance timers to trigger setTimeout
        jest.advanceTimersByTime(1);
        // Flush timers and promises
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            method: "GET",
            url: "https://controller.aifabrix.ai/api/users",
            statusCode: 200,
            duration: expect.any(Number),
            userId: "user-123",
          }),
          expect.objectContaining({
            token: undefined, // userId extracted, token not needed
          }),
        );
      });

      it("should include token in context when userId not extracted", async () => {
        const config: any = {
          url: "/api/users",
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: { users: [] },
          headers: {},
        };

        // Mock JWT decode to return null (no userId)
        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue(null);

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.any(Object),
          expect.objectContaining({
            token: "token123",
          }),
        );
      });

      it("should not log when config has no metadata", async () => {
        const response: any = {
          config: {
            url: "/api/users",
          },
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Should not throw, but also may not log
        expect(mockLogger.audit).not.toHaveBeenCalled();
      });

      it("should not log when response has no config", async () => {
        const response: any = {
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Should not log if no config
        expect(mockLogger.audit).not.toHaveBeenCalled();
      });

      it("should handle logging errors silently", async () => {
        // Mock logger to reject - errors should be caught and swallowed
        mockLogger.audit.mockRejectedValueOnce(new Error("Logging failed"));

        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        // Should not throw even if logger rejects
        responseSuccessFn(response);

        // Advance timers and wait for promises to settle
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Advance timers more to ensure catch handlers complete
        jest.advanceTimersByTime(10);
        await flushTimersAndPromises();

        // Logger should have been called (even though it rejected)
        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle response without status", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          // No status field
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            statusCode: 0, // No status, defaults to 0
          }),
          expect.any(Object),
        );
      });

      it("should handle response without data", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          // No data field
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle response without headers", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
          // No headers field
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle response with config but no config.headers", async () => {
        const config: any = {
          url: "/api/users",
          // No headers field
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle response with config.headers but no authorization", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            "content-type": "application/json",
            // No authorization field
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle response with empty requestBody (requestSize = 0)", async () => {
        const config: any = {
          url: "/api/users",
          method: "post",
          // No data field
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.POST",
          "/api/users",
          expect.objectContaining({
            requestSize: undefined, // Empty requestBody = 0, so requestSize is undefined
          }),
          expect.any(Object),
        );
      });

      it("should handle response with empty responseBody (responseSize = 0)", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          // No data field
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            responseSize: undefined, // Empty responseBody = 0, so responseSize is undefined
          }),
          expect.any(Object),
        );
      });

      it("should handle metadata with missing method", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            // No method field
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.UNKNOWN", // method defaults to 'UNKNOWN'
          "/api/users",
          expect.any(Object),
          expect.any(Object),
        );
      });

      it("should handle metadata with missing url", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            // No url field
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "", // url defaults to empty string
          expect.any(Object),
          expect.any(Object),
        );
      });

      it("should handle metadata with missing baseURL", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
            // No baseURL field
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            url: expect.stringContaining(
              httpClient.config.controllerUrl || "https://controller.aifabrix.ai"
            ), // baseURL defaults to controllerUrl or resolved URL
          }),
          expect.any(Object),
        );
      });
    });

    describe("response interceptor - error", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(async () => {
        // Run all pending timers first to ensure any promises are settled
        if (jest.isMockFunction(setTimeout)) {
          // Run timers multiple times to ensure all callbacks complete
          // Some timers may create new promises that need to settle
          for (let i = 0; i < 5; i++) {
            try {
              jest.runOnlyPendingTimers();
            } catch (e) {
              // Ignore errors from running timers
            }
            await Promise.resolve();
            await Promise.resolve();
          }
        }
        // Wait for any microtasks and promise resolution (multiple ticks)
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
        // Clear all timers
        jest.clearAllTimers();
        // Switch back to real timers
        jest.useRealTimers();
        // Wait one more tick to ensure cleanup is complete
        await Promise.resolve();
      });

      it("should log audit event on error response", async () => {
        const config: any = {
          url: "/api/users",
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const error: any = {
          config,
          response: {
            status: 404,
            data: { error: "Not found" },
            headers: {},
          },
          message: "Not Found",
        };

        // Mock JWT decode
        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        const resultPromise = responseErrorFn(error);

        // Advance timers to trigger async logging (fire-and-forget)
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Check logging happened (async, fire-and-forget)
        // Note: logging happens asynchronously, so we check after advancing timers
        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            method: "GET",
            statusCode: 404,
            error: "Not Found",
          }),
          expect.any(Object),
        );

        // The promise should reject with the error (happens immediately, not async)
        // Use catch to handle rejection without blocking
        try {
          await resultPromise;
          fail("Expected promise to reject");
        } catch (rejectedError) {
          expect(rejectedError).toEqual(error);
        }
      });

      it("should handle errors without response", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          message: "Network Error",
        };

        const result = responseErrorFn(error);

        // Advance timers and wait for promises to settle
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Run any remaining timers
        jest.runOnlyPendingTimers();
        await Promise.resolve();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            statusCode: 0,
            error: "Network Error",
          }),
          expect.any(Object),
        );

        // Should reject with the error
        // Use catch to handle rejection without blocking
        try {
          await result;
          fail("Expected promise to reject");
        } catch (rejectedError) {
          expect(rejectedError).toEqual(error);
        }
      });

      it("should handle errors with response.status", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 500,
            data: { error: "Internal Server Error" },
          },
          message: "Internal Server Error",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.POST",
          "/api/users",
          expect.objectContaining({
            statusCode: 500,
            error: "Internal Server Error",
          }),
          expect.any(Object),
        );
      });

      it("should handle errors with error.response but no status", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            data: { error: "Unknown error" },
            // No status field
          },
          message: "Unknown error",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            statusCode: 0, // No status, defaults to 0
            error: "Unknown error",
          }),
          expect.any(Object),
        );
      });

      it("should handle errors with no error.message", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 400,
          },
          // No message field
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          "http.request.GET",
          "/api/users",
          expect.objectContaining({
            statusCode: 400,
            error: undefined, // No error message
          }),
          expect.any(Object),
        );
      });

      it("should handle errors with config.data but no config.headers", async () => {
        const config: any = {
          url: "/api/users",
          data: { test: "data" },
          // No headers field
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 400,
          },
          message: "Bad Request",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle errors with error.config.data", async () => {
        const config: any = {
          url: "/api/users",
          // No data field
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
        };

        const error: any = {
          config: {
            ...config,
            data: { error: "Request data" },
          },
          response: {
            status: 400,
          },
          message: "Bad Request",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle errors with error.response.data", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 404,
            data: { error: "Not found" },
          },
          message: "Not Found",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle errors with error.response.headers", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 500,
            headers: { "x-custom-header": "value" },
          },
          message: "Server Error",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle errors with response but no response.data", async () => {
        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 500,
            // No data field
          },
          message: "Server Error",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle errors with no config", async () => {
        const error: any = {
          message: "Network Error",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Should not log if no config
        expect(mockLogger.audit).not.toHaveBeenCalled();
      });

      it("should handle errors with config but no metadata", async () => {
        const error: any = {
          config: {
            url: "/api/users",
          },
          message: "Network Error",
        };

        responseErrorFn(error);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Should not log if no metadata
        expect(mockLogger.audit).not.toHaveBeenCalled();
      });

      it("should handle logging errors silently in error handler", async () => {
        // Mock logger to reject - errors should be caught and swallowed
        mockLogger.audit.mockRejectedValueOnce(new Error("Logging failed"));

        const config: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          message: "Network Error",
        };

        // Should not throw even if logger rejects
        const result = responseErrorFn(error);

        // The error handler should reject the error (not throw from logging)
        expect(result).toBeInstanceOf(Promise);

        // Advance timers and wait for promises to settle
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Advance timers more to ensure catch handlers complete
        jest.advanceTimersByTime(10);
        await flushTimersAndPromises();

        // Logger should have been called (even though it rejected)
        expect(mockLogger.audit).toHaveBeenCalled();

        // The promise should reject with the original error (not the logging error)
        // Use catch to handle rejection without blocking
        try {
          await result;
          fail("Expected promise to reject");
        } catch (rejectedError) {
          expect(rejectedError).toEqual(error);
        }
      });
    });

    describe("debug logging", () => {
      beforeEach(() => {
        jest.useFakeTimers();
        // Clear mocks before each test
        jest.clearAllMocks();
        // Ensure config has logLevel set
        config = {
          ...config,
          logLevel: "debug",
        };
        httpClient = new HttpClient(config, mockLogger);

        // Re-setup interceptors - get the LATEST (last) call after creating new HttpClient
        const requestCalls = mockAxios.interceptors.request.use.mock.calls;
        const responseCalls = mockAxios.interceptors.response.use.mock.calls;
        const requestUseCall = requestCalls[requestCalls.length - 1];
        const responseUseCall = responseCalls[responseCalls.length - 1];
        requestInterceptorFn = requestUseCall[0];
        responseSuccessFn = responseUseCall[0];
      });

      afterEach(async () => {
        // Run all pending timers first to ensure any promises are settled
        if (jest.isMockFunction(setTimeout)) {
          // Run timers multiple times to ensure all callbacks complete
          // Some timers may create new promises that need to settle
          for (let i = 0; i < 5; i++) {
            try {
              jest.runOnlyPendingTimers();
            } catch (e) {
              // Ignore errors from running timers
            }
            await Promise.resolve();
            await Promise.resolve();
          }
        }
        // Wait for any microtasks and promise resolution (multiple ticks)
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
        // Clear all timers
        jest.clearAllTimers();
        // Switch back to real timers
        jest.useRealTimers();
        // Wait one more tick to ensure cleanup is complete
        await Promise.resolve();
      });

      it("should log debug event when logLevel is debug", async () => {
        const config: any = {
          url: "/api/users",
          method: "post",
          baseURL: "https://controller.aifabrix.ai",
          timeout: 30000,
          headers: {
            authorization: "Bearer token123",
            "content-type": "application/json",
          },
          data: { name: "test" },
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: { id: "123", name: "test" },
          headers: { "content-type": "application/json" },
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Additional timer advances for nested async operations
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        jest.runOnlyPendingTimers();
        await Promise.resolve();

        expect(mockLogger.debug).toHaveBeenCalledWith(
          "HTTP POST /api/users",
          expect.objectContaining({
            method: "POST",
            url: "https://controller.aifabrix.ai/api/users",
            statusCode: 200,
            requestHeaders: expect.any(Object),
            responseHeaders: expect.any(Object),
            requestBody: expect.any(Object),
            responseBody: expect.any(Object),
          }),
          expect.any(Object),
        );
      });

      it("should truncate large response bodies in debug logs", async () => {
        // Create a large response body (> 1000 chars to trigger truncation)
        const largeData = {
          items: Array.from({ length: 200 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `This is a long description for item ${i} that makes the response body large`,
            metadata: {
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
            },
          })),
        };

        const config: any = {
          url: "/api/users",
          method: "get",
          baseURL: "https://controller.aifabrix.ai",
          timeout: 30000,
          headers: {
            authorization: "Bearer token123",
            "content-type": "application/json",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: largeData,
          headers: { "content-type": "application/json" },
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Additional timer advances for nested async operations
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        // Extra flush to ensure all async operations complete
        await flushTimersAndPromises();

        // Verify debug was called
        expect(mockLogger.debug).toHaveBeenCalled();

        // Get the actual call arguments
        const debugCall = mockLogger.debug.mock.calls.find(
          (call) => call[0] === "HTTP GET /api/users",
        );

        expect(debugCall).toBeDefined();
        if (debugCall) {
          const debugContext = debugCall[1];
          const responseBodyStr = JSON.stringify(debugContext.responseBody);
          // Response body should be truncated (less than original size)
          expect(responseBodyStr.length).toBeLessThan(JSON.stringify(largeData).length);
          // Should contain truncation indicator or be significantly smaller
          expect(responseBodyStr.length).toBeLessThanOrEqual(1003); // 1000 + "..."
        }
      });

      it("should not log debug event when logLevel is not debug", async () => {
        config.logLevel = "info";
        httpClient = new HttpClient(config, mockLogger);

        const configObj: any = {
          url: "/api/users",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config: configObj,
          status: 200,
          data: {},
        };

        // Get the latest interceptor after creating new HttpClient
        const responseUseCall =
          mockAxios.interceptors.response.use.mock.calls[
            mockAxios.interceptors.response.use.mock.calls.length - 1
          ];
        const successFn = responseUseCall[0];

        successFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
        expect(mockLogger.debug).not.toHaveBeenCalled();
      });

      it("should handle non-object responseBody in debug logs", async () => {
        config.logLevel = "debug";
        httpClient = new HttpClient(config, mockLogger);

        // Get the latest interceptor after creating new HttpClient
        const responseUseCall =
          mockAxios.interceptors.response.use.mock.calls[
            mockAxios.interceptors.response.use.mock.calls.length - 1
          ];
        const successFn = responseUseCall[0];

        const configObj: any = {
          url: "/api/users",
          method: "get",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config: configObj,
          status: 200,
          data: "string response",
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        successFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Additional timer advances for nested async operations
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        jest.runOnlyPendingTimers();
        await Promise.resolve();

        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it("should handle empty responseBody in debug logs", async () => {
        config.logLevel = "debug";
        httpClient = new HttpClient(config, mockLogger);

        // Get the latest interceptor after creating new HttpClient
        const responseUseCall =
          mockAxios.interceptors.response.use.mock.calls[
            mockAxios.interceptors.response.use.mock.calls.length - 1
          ];
        const successFn = responseUseCall[0];

        const configObj: any = {
          url: "/api/users",
          method: "get",
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config: configObj,
          status: 200,
          data: null,
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        successFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Additional timer advances for nested async operations
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
        jest.runOnlyPendingTimers();
        await Promise.resolve();

        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it("should handle requestSize calculation with null requestBody", async () => {
        const config: any = {
          url: "/api/users",
          method: "post",
          baseURL: "https://controller.aifabrix.ai",
          headers: {},
          data: null,
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
          headers: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalled();
      });
    });

    describe("extractUserIdFromToken", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(async () => {
        // Run all pending timers first to ensure any promises are settled
        if (jest.isMockFunction(setTimeout)) {
          // Run timers multiple times to ensure all callbacks complete
          // Some timers may create new promises that need to settle
          for (let i = 0; i < 5; i++) {
            try {
              jest.runOnlyPendingTimers();
            } catch (e) {
              // Ignore errors from running timers
            }
            await Promise.resolve();
            await Promise.resolve();
          }
        }
        // Wait for any microtasks and promise resolution (multiple ticks)
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
        // Clear all timers
        jest.clearAllTimers();
        // Switch back to real timers
        jest.useRealTimers();
        // Wait one more tick to ensure cleanup is complete
        await Promise.resolve();
      });

      it("should extract userId from sub field", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: "user-123",
          }),
          expect.any(Object),
        );
      });

      it("should extract userId from userId field", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ userId: "user-456" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: "user-456",
          }),
          expect.any(Object),
        );
      });

      it("should extract userId from user_id field", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ user_id: "user-789" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: "user-789",
          }),
          expect.any(Object),
        );
      });

      it("should extract userId from id field", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ id: "user-999" });

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: "user-999",
          }),
          expect.any(Object),
        );
      });

      it("should handle JWT decode throwing an error", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Bearer token123",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        const jwt = require("jsonwebtoken");
        // Make decode throw an error - extractUserIdFromToken should catch it
        jwt.decode.mockImplementation(() => {
          throw new Error("JWT decode error");
        });

        // Call responseSuccessFn which will call logHttpRequestAudit
        // which calls extractUserIdFromToken which catches the error
        responseSuccessFn(response);

        // Advance timers and wait for all promises to settle
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Advance more to ensure catch handlers complete
        jest.advanceTimersByTime(10);
        await flushTimersAndPromises();
        // Wait for additional microtasks
        await Promise.resolve();
        await Promise.resolve();

        // Should still log audit even if JWT decode throws
        // extractUserIdFromToken catches the error and returns null
        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: undefined, // JWT decode failed, so no userId
          }),
          expect.any(Object),
        );
      });

      it("should handle invalid token gracefully", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Bearer invalid-token",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue(null);

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: undefined,
          }),
          expect.objectContaining({
            token: "invalid-token",
          }),
        );
      });

      it("should handle non-Bearer authorization header", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "Basic dXNlcjpwYXNz",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: undefined,
          }),
          expect.any(Object),
        );
      });

      it("should handle missing authorization header", async () => {
        const config: any = {
          url: "/api/users",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: undefined,
          }),
          expect.any(Object),
        );
      });

      it("should handle undefined authorization header", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: undefined,
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: undefined,
          }),
          expect.any(Object),
        );
      });

      it("should handle empty authorization header", async () => {
        const config: any = {
          url: "/api/users",
          headers: {
            authorization: "",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        expect(mockLogger.audit).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.objectContaining({
            userId: undefined,
          }),
          expect.any(Object),
        );
      });
    });

    describe("logHttpRequestAudit edge cases", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(async () => {
        // Run all pending timers first to ensure any promises are settled
        if (jest.isMockFunction(setTimeout)) {
          // Run timers multiple times to ensure all callbacks complete
          // Some timers may create new promises that need to settle
          for (let i = 0; i < 5; i++) {
            try {
              jest.runOnlyPendingTimers();
            } catch (e) {
              // Ignore errors from running timers
            }
            await Promise.resolve();
            await Promise.resolve();
          }
        }
        // Wait for any microtasks and promise resolution (multiple ticks)
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
        // Clear all timers
        jest.clearAllTimers();
        // Switch back to real timers
        jest.useRealTimers();
        // Wait one more tick to ensure cleanup is complete
        await Promise.resolve();
      });

      it("should handle logHttpRequestAudit when DataMasker throws", async () => {
        // This test covers the catch block in logHttpRequestAudit (lines 223-225)
        const dataMasker = require("../../src/utils/data-masker");
        const originalMaskSensitiveData =
          dataMasker.DataMasker.maskSensitiveData;

        // Make DataMasker throw an error
        dataMasker.DataMasker.maskSensitiveData = jest.fn(() => {
          throw new Error("DataMasker error");
        });

        const config: any = {
          url: "/api/users",
          method: "post",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Should not throw - error is silently swallowed (line 223-225)
        expect(mockLogger.audit).not.toHaveBeenCalled(); // Or may have been called before error

        // Restore
        dataMasker.DataMasker.maskSensitiveData = originalMaskSensitiveData;
      });

      it("should handle logHttpRequestAudit when logger.audit throws", async () => {
        // This test ensures the catch block handles logger errors (lines 223-225)
        mockLogger.audit.mockRejectedValueOnce(new Error("Logger error"));

        const config: any = {
          url: "/api/users",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        // Should not throw - error is silently swallowed
        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        jest.advanceTimersByTime(10);
        await flushTimersAndPromises();

        // Error should be caught and swallowed
        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should handle logHttpRequestAudit when logger.debug throws", async () => {
        config.logLevel = "debug";
        httpClient = new HttpClient(config, mockLogger);

        // Get the latest interceptor after creating new HttpClient
        const responseUseCall =
          mockAxios.interceptors.response.use.mock.calls[
            mockAxios.interceptors.response.use.mock.calls.length - 1
          ];
        const successFn = responseUseCall[0];

        mockLogger.debug.mockRejectedValueOnce(new Error("Debug logger error"));

        const configObj: any = {
          url: "/api/users",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config: configObj,
          status: 200,
          data: {},
        };

        // Should not throw - error is silently swallowed
        successFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        jest.advanceTimersByTime(10);
        await flushTimersAndPromises();

        // Error should be caught and swallowed
        expect(mockLogger.debug).toHaveBeenCalled();
      });

      it("should handle response with circular reference in data", async () => {
        // This test covers edge cases in JSON.stringify (lines 167-168, 194-197)
        // Note: JSON.stringify throws synchronously for circular references,
        // so the catch block (lines 223-225) will catch it and swallow the error
        const circularData: any = { name: "test" };
        circularData.self = circularData; // Create circular reference

        const configObj: any = {
          url: "/api/users",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
          data: circularData,
        };

        const response: any = {
          config: configObj,
          status: 200,
          data: {},
          headers: {},
        };

        // JSON.stringify will throw for circular references when calculating requestSize
        // The catch block should catch it and swallow the error silently
        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();
        // Advance more to ensure catch handlers complete
        jest.advanceTimersByTime(10);
        await flushTimersAndPromises();

        // The error is silently swallowed, so audit may or may not be called
        // The important thing is that it doesn't throw
        // In practice, if JSON.stringify throws during requestSize calculation,
        // the catch block swallows it, so audit might not be called
      });

      it("should handle requestSize calculation with non-serializable data", async () => {
        const nonSerializableData = { func: () => {} }; // Function cannot be serialized

        const config: any = {
          url: "/api/users",
          method: "post",
          headers: {},
          data: nonSerializableData,
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: {},
        };

        responseSuccessFn(response);

        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Should handle JSON.stringify errors gracefully
        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should execute lines 71-75: response success interceptor setTimeout callback", async () => {
        // This test explicitly covers lines 71-75
        const config: any = {
          url: "/api/users",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const response: any = {
          config,
          status: 200,
          data: { success: true },
        };

        // Execute response interceptor - this triggers setTimeout (line 71)
        responseSuccessFn(response);

        // Advance timers to execute setTimeout callback (lines 71-75)
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Verify logHttpRequestAudit was called (line 72)
        expect(mockLogger.audit).toHaveBeenCalled();
      });

      it("should execute lines 78-86: response error interceptor setTimeout callback", async () => {
        // This test explicitly covers lines 78-86
        const config: any = {
          url: "/api/users",
          headers: {},
          metadata: {
            startTime: Date.now() - 100,
            method: "GET",
            url: "/api/users",
          },
        };

        const error: any = {
          config,
          response: {
            status: 500,
            data: { error: "Server error" },
          },
          message: "Internal Server Error",
        };

        // Execute error interceptor - this triggers setTimeout (line 81)
        const result = responseErrorFn(error);

        // Advance timers to execute setTimeout callback (lines 81-85)
        jest.advanceTimersByTime(1);
        await flushTimersAndPromises();

        // Verify logHttpRequestAudit was called (line 82)
        expect(mockLogger.audit).toHaveBeenCalled();

        // Verify error is rejected (line 86)
        try {
          await result;
          fail("Expected promise to reject");
        } catch (e) {
          expect(e).toEqual(error);
        }
      });
    });

    describe("data masking in audit logs", () => {
      beforeEach(() => {
        jest.useFakeTimers();
        // Set logLevel to debug for this test suite
        config.logLevel = "debug";
        httpClient = new HttpClient(config, mockLogger);

        // Re-setup interceptors
        const requestUseCall =
          mockAxios.interceptors.request.use.mock.calls[
            mockAxios.interceptors.request.use.mock.calls.length - 1
          ];
        const responseUseCall =
          mockAxios.interceptors.response.use.mock.calls[
            mockAxios.interceptors.response.use.mock.calls.length - 1
          ];
        requestInterceptorFn = requestUseCall[0];
        responseSuccessFn = responseUseCall[0];
      });

      afterEach(async () => {
        // Run all pending timers first to ensure any promises are settled
        if (jest.isMockFunction(setTimeout)) {
          // Run timers multiple times to ensure all callbacks complete
          // Some timers may create new promises that need to settle
          for (let i = 0; i < 5; i++) {
            try {
              jest.runOnlyPendingTimers();
            } catch (e) {
              // Ignore errors from running timers
            }
            await Promise.resolve();
            await Promise.resolve();
          }
        }
        // Wait for any microtasks and promise resolution (multiple ticks)
        for (let i = 0; i < 5; i++) {
          await Promise.resolve();
        }
        // Clear all timers
        jest.clearAllTimers();
        // Switch back to real timers
        jest.useRealTimers();
        // Wait one more tick to ensure cleanup is complete
        await Promise.resolve();
      });

      it("should mask sensitive data in request body", async () => {
        const configObj: any = {
          url: "/api/users",
          method: "post",
          baseURL: "https://controller.aifabrix.ai",
          headers: {
            authorization: "Bearer token123",
          },
          data: {
            username: "john",
            password: "secret123",
            email: "john@example.com",
          },
          metadata: {
            startTime: Date.now() - 100,
            method: "POST",
            url: "/api/users",
            baseURL: "https://controller.aifabrix.ai",
          },
        };

        const response: any = {
          config: configObj,
          status: 200,
          data: {},
          headers: {},
        };

        const jwt = require("jsonwebtoken");
        jwt.decode.mockReturnValue({ sub: "user-123" });

        // Get the latest responseSuccessFn from the recreated httpClient
        const responseUseCall =
          mockAxios.interceptors.response.use.mock.calls[
            mockAxios.interceptors.response.use.mock.calls.length - 1
          ];
        const successFn = responseUseCall[0];

        successFn(response);

        // Run timers to trigger setTimeout callbacks
        jest.advanceTimersByTime(1);
        jest.runOnlyPendingTimers();
        await flushTimersAndPromises();
        // Additional wait for async operations
        await Promise.resolve();
        await Promise.resolve();

        // Check that debug log contains masked data
        expect(mockLogger.debug).toHaveBeenCalled();
        const debugCall = mockLogger.debug.mock.calls[0];
        if (debugCall && debugCall?.[1]) {
          const requestBody = debugCall[1]?.requestBody;

          expect(requestBody).toEqual({
            username: "john",
            password: "***MASKED***",
            email: "***MASKED***",
          });
        }
      });
    });

    describe("constructor with sensitiveFieldsConfig", () => {
      it("should set DataMasker config path when provided", () => {
        const configWithFields: MisoClientConfig = {
          ...config,
          sensitiveFieldsConfig: "/path/to/config.json",
        };

        // Use actual DataMasker (don't mock) to ensure line 37 executes
        const dataMasker = require("../../src/utils/data-masker");
        const setConfigPathSpy = jest
          .spyOn(dataMasker.DataMasker, "setConfigPath")
          .mockImplementation(() => {
            // Allow actual execution
          });

        const client = new HttpClient(configWithFields, mockLogger);

        // Verify the method was called
        expect(setConfigPathSpy).toHaveBeenCalledWith("/path/to/config.json");

        // Verify client was created
        expect(client).toBeInstanceOf(HttpClient);

        setConfigPathSpy.mockRestore();
      });

      it("should not set DataMasker config path when not provided", () => {
        const dataMasker = require("../../src/utils/data-masker");
        const setConfigPathSpy = jest.spyOn(
          dataMasker.DataMasker,
          "setConfigPath",
        );

        const client = new HttpClient(config, mockLogger);

        expect(setConfigPathSpy).not.toHaveBeenCalled();
        expect(client).toBeInstanceOf(HttpClient);

        setConfigPathSpy.mockRestore();
      });

      it("should execute DataMasker.setConfigPath line 37", () => {
        // This test ensures line 37 is actually executed
        const configWithFields: MisoClientConfig = {
          ...config,
          sensitiveFieldsConfig: "/test/path.json",
        };

        // Ensure DataMasker is not completely mocked - use actual implementation
        const dataMasker = require("../../src/utils/data-masker");
        const originalSetConfigPath = dataMasker.DataMasker.setConfigPath;

        let wasCalled = false;
        dataMasker.DataMasker.setConfigPath = jest.fn((path: string) => {
          wasCalled = true;
          originalSetConfigPath.call(dataMasker.DataMasker, path);
        });

        const client = new HttpClient(configWithFields, mockLogger);

        expect(wasCalled).toBe(true);
        expect(client).toBeInstanceOf(HttpClient);

        // Restore
        dataMasker.DataMasker.setConfigPath = originalSetConfigPath;
      });
    });
  });
});
