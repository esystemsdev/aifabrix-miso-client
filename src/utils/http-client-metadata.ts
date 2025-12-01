/**
 * HTTP client metadata extraction utilities
 * Extracts request/response metadata for audit logging
 */

import { AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import { MisoClientConfig } from "../types/config.types";
import jwt from "jsonwebtoken";

export interface RequestMetadata {
  startTime: number;
  method?: string;
  url?: string;
  baseURL?: string;
}

export interface AxiosRequestConfigWithMetadata
  extends InternalAxiosRequestConfig {
  metadata?: RequestMetadata;
}

export interface ExtractedMetadata {
  config: InternalAxiosRequestConfig;
  metadata: RequestMetadata;
  duration: number;
  method: string;
  url: string;
  fullUrl: string;
  baseURL: string;
  statusCode: number;
  authHeader?: string;
  userId: string | null;
  requestHeaders: Record<string, unknown>;
  requestBody: unknown;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
}

/**
 * Extract request/response metadata from axios response/error
 */
export function extractRequestMetadata(
  response: AxiosResponse | undefined,
  error: AxiosError | null,
  config: MisoClientConfig,
): ExtractedMetadata | null {
  const axiosConfig = response?.config || error?.config;
  if (!axiosConfig) {
    return null;
  }

  const metadata = (axiosConfig as AxiosRequestConfigWithMetadata).metadata;
  if (!metadata) {
    return null;
  }

  const basicInfo = extractBasicMetadata(metadata, axiosConfig, config);
  const requestData = extractRequestData(axiosConfig, error);
  const responseData = extractResponseData(response, error);

  return {
    ...basicInfo,
    ...requestData,
    ...responseData,
  };
}

/**
 * Extract basic metadata (duration, method, URL, etc.)
 */
function extractBasicMetadata(
  metadata: RequestMetadata,
  config: InternalAxiosRequestConfig,
  misoConfig: MisoClientConfig,
): {
  config: InternalAxiosRequestConfig;
  metadata: RequestMetadata;
  duration: number;
  method: string;
  url: string;
  fullUrl: string;
  baseURL: string;
  statusCode: number;
  authHeader?: string;
  userId: string | null;
} {
  const duration = Date.now() - metadata.startTime;
  const method = metadata.method || "UNKNOWN";
  const url = metadata.url || "";
  const baseURL = metadata.baseURL || misoConfig.controllerUrl;
  const fullUrl = `${baseURL}${url}`;
  const authHeader = config.headers?.authorization as string | undefined;
  const userId = extractUserIdFromToken(authHeader);

  return {
    config,
    metadata,
    duration,
    method,
    url,
    fullUrl,
    baseURL,
    statusCode: 0, // Will be set by responseData
    authHeader,
    userId,
  };
}

/**
 * Extract request data (headers, body)
 */
function extractRequestData(
  config: InternalAxiosRequestConfig,
  error: AxiosError | null,
): {
  requestHeaders: Record<string, unknown>;
  requestBody: unknown;
} {
  return {
    requestHeaders: config.headers || {},
    requestBody: config.data || error?.config?.data,
  };
}

/**
 * Extract response data (status, headers, body)
 */
function extractResponseData(
  response: AxiosResponse | undefined,
  error: AxiosError | null,
): {
  statusCode: number;
  responseBody: unknown;
  responseHeaders: Record<string, unknown>;
} {
  return {
    statusCode: response?.status || error?.response?.status || 0,
    responseBody: response?.data || error?.response?.data,
    responseHeaders: response?.headers || error?.response?.headers || {},
  };
}

/**
 * Extract user ID from JWT token
 */
export function extractUserIdFromToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.decode(token) as Record<string, unknown> | null;
    if (!decoded) return null;
    return (decoded.sub || decoded.userId || decoded.user_id || decoded.id) as
      | string
      | null;
  } catch {
    return null;
  }
}
