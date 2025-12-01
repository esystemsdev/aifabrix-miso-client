/**
 * HTTP client masking and truncation utilities
 * Handles sensitive data masking and body truncation for audit logging
 */

import { DataMasker } from "./data-masker";

/**
 * Quick size estimation without full JSON.stringify
 * Uses property count and string length for fast estimation
 */
export function estimateObjectSize(obj: unknown): number {
  if (obj === null || obj === undefined) {
    return 0;
  }

  if (typeof obj === "string") {
    return obj.length;
  }

  if (typeof obj !== "object") {
    return 10; // Estimate for primitives
  }

  if (Array.isArray(obj)) {
    // Estimate based on array length and first few items
    const length = obj.length;
    if (length === 0) return 10;

    // Sample first few items for estimation
    const sampleSize = Math.min(3, length);
    let estimatedItemSize = 0;
    for (let i = 0; i < sampleSize; i++) {
      estimatedItemSize += estimateObjectSize(obj[i]);
    }
    const avgItemSize = sampleSize > 0 ? estimatedItemSize / sampleSize : 100;
    return length * avgItemSize;
  }

  // Object: estimate based on property count and values
  const entries = Object.entries(obj as Record<string, unknown>);
  let size = 0;
  for (const [key, value] of entries) {
    size += key.length + estimateObjectSize(value);
  }
  return size;
}

/**
 * Truncate response body to reduce processing cost
 * Returns truncated body with flag indicating truncation
 */
export function truncateResponseBody(
  body: unknown,
  maxSize: number = 10000,
): { data: unknown; truncated: boolean } {
  if (body === null || body === undefined) {
    return { data: body, truncated: false };
  }

  // For strings, truncate directly
  if (typeof body === "string") {
    if (body.length <= maxSize) {
      return { data: body, truncated: false };
    }
    return { data: body.substring(0, maxSize) + "...", truncated: true };
  }

  // For objects/arrays, estimate size first
  const estimatedSize = estimateObjectSize(body);
  if (estimatedSize <= maxSize) {
    return { data: body, truncated: false };
  }

  // If estimated size is too large, return placeholder
  // Full body only processed in debug mode
  return {
    data: {
      _message: "Response body too large, truncated for performance",
      _estimatedSize: estimatedSize,
    },
    truncated: true,
  };
}

/**
 * Analyze request sizes to determine optimization strategy
 */
export function analyzeRequestSizes(
  requestBody: unknown,
  responseBody: unknown,
  maxMaskingSize: number,
): {
  isSmallRequest: boolean;
  isLargeRequest: boolean;
} {
  const estimatedRequestSize = requestBody
    ? estimateObjectSize(requestBody)
    : 0;
  const estimatedResponseSize = responseBody
    ? estimateObjectSize(responseBody)
    : 0;
  const isSmallRequest =
    estimatedRequestSize < 1024 && estimatedResponseSize < 1024;
  const isLargeRequest =
    estimatedRequestSize > maxMaskingSize ||
    estimatedResponseSize > maxMaskingSize;

  return { isSmallRequest, isLargeRequest };
}

/**
 * Truncate request and response bodies
 */
export function truncateBodies(
  requestBody: unknown,
  responseBody: unknown,
  maxResponseSize: number,
): {
  requestBody: unknown;
  responseBody: unknown;
  requestTruncated: boolean;
  responseTruncated: boolean;
} {
  const { data: truncatedResponseBody, truncated: responseTruncated } =
    truncateResponseBody(responseBody, maxResponseSize);

  const { data: truncatedRequestBody, truncated: requestTruncated } =
    requestBody && estimateObjectSize(requestBody) > maxResponseSize
      ? truncateResponseBody(requestBody, maxResponseSize)
      : { data: requestBody, truncated: false };

  return {
    requestBody: truncatedRequestBody,
    responseBody: truncatedResponseBody,
    requestTruncated,
    responseTruncated,
  };
}

/**
 * Apply masking strategy based on request size and audit level
 */
export async function applyMaskingStrategy(
  metadata: {
    requestHeaders: Record<string, unknown>;
    requestBody: unknown;
    responseBody: unknown;
    responseHeaders: Record<string, unknown>;
  },
  auditLevel: "standard" | "detailed" | "full",
  maxResponseSize: number,
  maxMaskingSize: number,
): Promise<{
  headers: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
  requestTruncated: boolean;
  responseTruncated: boolean;
}> {
  const sizeInfo = analyzeRequestSizes(
    metadata.requestBody,
    metadata.responseBody,
    maxMaskingSize,
  );
  const truncated = truncateBodies(
    metadata.requestBody,
    metadata.responseBody,
    maxResponseSize,
  );

  if (auditLevel === "standard") {
    return applyStandardMasking(
      metadata.requestHeaders,
      metadata.responseHeaders,
      truncated.requestBody,
      truncated.responseBody,
      sizeInfo.isSmallRequest,
      sizeInfo.isLargeRequest,
      truncated.requestTruncated,
      truncated.responseTruncated,
    );
  }

  return applyDetailedMasking(
    metadata.requestHeaders,
    metadata.responseHeaders,
    truncated.requestBody,
    truncated.responseBody,
    sizeInfo.isSmallRequest,
    sizeInfo.isLargeRequest,
    truncated.requestTruncated,
    truncated.responseTruncated,
  );
}

/**
 * Apply standard level masking (light masking)
 */
export function applyStandardMasking(
  requestHeaders: Record<string, unknown>,
  responseHeaders: Record<string, unknown>,
  requestBody: unknown,
  responseBody: unknown,
  isSmallRequest: boolean,
  isLargeRequest: boolean,
  requestTruncated: boolean,
  responseTruncated: boolean,
): {
  headers: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
  requestTruncated: boolean;
  responseTruncated: boolean;
} {
  const maskedHeaders = DataMasker.maskSensitiveData(requestHeaders) as Record<
    string,
    unknown
  >;
  const maskedResponseHeaders = DataMasker.maskSensitiveData(
    responseHeaders,
  ) as Record<string, unknown>;

  let maskedRequestBody: unknown;
  let maskedResponseBody: unknown;

  if (isSmallRequest || !isLargeRequest) {
    maskedRequestBody = DataMasker.maskSensitiveData(requestBody);
    maskedResponseBody = DataMasker.maskSensitiveData(responseBody);
  } else {
    maskedRequestBody = { _message: "Request body too large, masking skipped" };
    maskedResponseBody = {
      _message: "Response body too large, masking skipped",
    };
  }

  return {
    headers: maskedHeaders,
    requestBody: maskedRequestBody,
    responseBody: maskedResponseBody,
    responseHeaders: maskedResponseHeaders,
    requestTruncated,
    responseTruncated,
  };
}

/**
 * Apply detailed/full level masking (with parallelization for medium objects)
 */
export async function applyDetailedMasking(
  requestHeaders: Record<string, unknown>,
  responseHeaders: Record<string, unknown>,
  requestBody: unknown,
  responseBody: unknown,
  isSmallRequest: boolean,
  isLargeRequest: boolean,
  requestTruncated: boolean,
  responseTruncated: boolean,
): Promise<{
  headers: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
  requestTruncated: boolean;
  responseTruncated: boolean;
}> {
  if (isLargeRequest) {
    return createSkippedMaskingResult(
      requestHeaders,
      responseHeaders,
      requestTruncated,
      responseTruncated,
    );
  }

  if (isSmallRequest) {
    return applySequentialMasking(
      requestHeaders,
      responseHeaders,
      requestBody,
      responseBody,
      requestTruncated,
      responseTruncated,
    );
  }

  return applyParallelMasking(
    requestHeaders,
    responseHeaders,
    requestBody,
    responseBody,
    requestTruncated,
    responseTruncated,
  );
}

/**
 * Create result indicating masking was skipped for large requests
 */
function createSkippedMaskingResult(
  requestHeaders: Record<string, unknown>,
  responseHeaders: Record<string, unknown>,
  requestTruncated: boolean,
  responseTruncated: boolean,
): {
  headers: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
  requestTruncated: boolean;
  responseTruncated: boolean;
} {
  return {
    headers: requestHeaders,
    requestBody: { _message: "Request body too large, masking skipped" },
    responseBody: { _message: "Response body too large, masking skipped" },
    responseHeaders,
    requestTruncated,
    responseTruncated,
  };
}

/**
 * Apply sequential masking for small requests (fast path)
 */
function applySequentialMasking(
  requestHeaders: Record<string, unknown>,
  responseHeaders: Record<string, unknown>,
  requestBody: unknown,
  responseBody: unknown,
  requestTruncated: boolean,
  responseTruncated: boolean,
): {
  headers: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
  requestTruncated: boolean;
  responseTruncated: boolean;
} {
  return {
    headers: DataMasker.maskSensitiveData(requestHeaders) as Record<
      string,
      unknown
    >,
    requestBody: DataMasker.maskSensitiveData(requestBody),
    responseBody: DataMasker.maskSensitiveData(responseBody),
    responseHeaders: DataMasker.maskSensitiveData(responseHeaders) as Record<
      string,
      unknown
    >,
    requestTruncated,
    responseTruncated,
  };
}

/**
 * Apply parallel masking for medium-sized requests
 */
async function applyParallelMasking(
  requestHeaders: Record<string, unknown>,
  responseHeaders: Record<string, unknown>,
  requestBody: unknown,
  responseBody: unknown,
  requestTruncated: boolean,
  responseTruncated: boolean,
): Promise<{
  headers: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
  requestTruncated: boolean;
  responseTruncated: boolean;
}> {
  const [
    maskedHeadersResult,
    maskedRequestBodyResult,
    maskedResponseBodyResult,
    maskedResponseHeadersResult,
  ] = await Promise.all([
    Promise.resolve(DataMasker.maskSensitiveData(requestHeaders)),
    Promise.resolve(DataMasker.maskSensitiveData(requestBody)),
    Promise.resolve(DataMasker.maskSensitiveData(responseBody)),
    Promise.resolve(DataMasker.maskSensitiveData(responseHeaders)),
  ]);

  return {
    headers: maskedHeadersResult as Record<string, unknown>,
    requestBody: maskedRequestBodyResult,
    responseBody: maskedResponseBodyResult,
    responseHeaders: maskedResponseHeadersResult as Record<string, unknown>,
    requestTruncated,
    responseTruncated,
  };
}
