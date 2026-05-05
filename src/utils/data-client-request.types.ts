import {
  ApiRequestOptions,
  DataClientConfig,
  InterceptorConfig,
  CacheEntry,
} from "../types/data-client.types";
import { MisoClient } from "../index";
import { HasAnyTokenFn, GetTokenFn } from "./data-client-audit";

export type RefreshUserTokenFn = () => Promise<{
  token: string;
  expiresIn: number;
} | null>;

export type RestoreUserSessionFn = () => Promise<{
  token: string;
  expiresIn: number;
} | null>;

export interface RetryConfig {
  maxRetries: number;
  retryEnabled: boolean;
  baseDelay: number;
  maxDelay: number;
}

export interface RequestRetryState {
  authErrorDetected: boolean;
  tokenRefreshAttempted: boolean;
}

export interface RequestMetricsState {
  totalRequests: number;
  totalFailures: number;
  responseTimes: number[];
}

export interface AttemptRequestParams {
  attempt: number;
  method: string;
  fullUrl: string;
  endpoint: string;
  config: DataClientConfig;
  cache: Map<string, CacheEntry>;
  cacheKey: string;
  cacheEnabled: boolean;
  startTime: number;
  misoClient: MisoClient | null;
  hasAnyToken: HasAnyTokenFn;
  getToken: GetTokenFn;
  handleAuthError: () => void;
  restoreUserSession: RestoreUserSessionFn;
  refreshUserToken: RefreshUserTokenFn;
  interceptors: InterceptorConfig;
  metrics: RequestMetricsState;
  options?: ApiRequestOptions;
  retryConfig: RetryConfig;
  state: RequestRetryState;
}

export interface ExecuteHttpRequestOptions {
  method: string;
  fullUrl: string;
  endpoint: string;
  config: DataClientConfig;
  cache: Map<string, CacheEntry>;
  cacheKey: string;
  cacheEnabled: boolean;
  startTime: number;
  misoClient: MisoClient | null;
  hasAnyToken: HasAnyTokenFn;
  getToken: GetTokenFn;
  handleAuthError: () => void;
  restoreUserSession: RestoreUserSessionFn;
  refreshUserToken: RefreshUserTokenFn;
  interceptors: InterceptorConfig;
  metrics: RequestMetricsState;
  options?: ApiRequestOptions;
}
