import type { AxiosInstance, AxiosResponse } from "axios";
import { resolveControllerUrl } from "../utils/controller-url-resolver";
import { ClientTokenResponse, MisoClientConfig } from "../types/config.types";

export interface EnvTokenClient {
  tempAxios: AxiosInstance;
  timeoutId: NodeJS.Timeout;
  controller: AbortController;
}

/**
 * Extract token from response payload (handles nested and flat formats).
 */
export function extractTokenFromEnvResponse(data: unknown): string | undefined {
  const rd = data as Record<string, unknown>;
  const dataObj = rd?.data as Record<string, unknown> | undefined;
  const nestedData = dataObj?.data as Record<string, unknown> | undefined;
  return (nestedData?.token || dataObj?.token || rd?.token) as string | undefined;
}

/**
 * Create a temporary axios client for fetching environment tokens.
 */
export async function createEnvTokenClient(
  config: MisoClientConfig,
  axiosTimeout: number,
  clientId: string,
): Promise<EnvTokenClient> {
  const axios = (await import("axios")).default;
  const http = await import("http");
  const https = await import("https");
  const controllerUrl = resolveControllerUrl(config);
  const isHttps = controllerUrl.startsWith("https://");
  const agentOpts = { family: 4, timeout: axiosTimeout };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), axiosTimeout);

  const tempAxios = axios.create({
    baseURL: controllerUrl,
    timeout: axiosTimeout,
    signal: controller.signal,
    httpAgent: !isHttps ? new http.Agent(agentOpts) : undefined,
    httpsAgent: isHttps ? new https.Agent(agentOpts) : undefined,
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": config.clientSecret,
    },
  });

  return { tempAxios, timeoutId, controller };
}

/**
 * Fetch environment token response with timeout handling.
 */
export async function fetchEnvironmentTokenResponse(
  tempAxios: AxiosInstance,
  timeoutId: NodeJS.Timeout,
  controller: AbortController,
  clientTokenUri: string,
  axiosTimeout: number,
): Promise<AxiosResponse<ClientTokenResponse>> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Request timeout after ${axiosTimeout}ms`)),
      axiosTimeout,
    ),
  );

  try {
    const response = await Promise.race([
      tempAxios.post<ClientTokenResponse>(clientTokenUri),
      timeoutPromise,
    ]);
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    controller.abort();
    throw error;
  }
}
