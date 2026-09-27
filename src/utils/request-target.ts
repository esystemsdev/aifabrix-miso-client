/**
 * Decide which transport a request may use.
 *
 * The SDK owns one application credential: the client token. It belongs to the
 * Miso controller and to nothing else, so every request is classified by its
 * target origin before any credential is looked up:
 *
 * - controller target: a relative path, or an absolute URL whose scheme, host
 *   and port equal one of the configured controller URLs. These carry
 *   `x-client-token` and, under a managed runtime, the origin pin.
 * - external target: every other absolute URL (LLM providers, CRMs, webhooks).
 *   These travel on a plain transport that adds nothing of the SDK's; SDK
 *   credential headers a caller copied in are removed. Protocol-relative URLs
 *   (`//host/...`) would borrow the controller scheme and are always external.
 */

import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type { MisoClientConfig } from "../types/config.types";

export const SDK_CREDENTIAL_HEADERS = [
  "x-client-token",
  "x-client-id",
  "x-client-secret",
];

const DEFAULT_PORTS: Record<string, string> = {
  "http:": "80",
  "https:": "443",
};

/** `scheme://host:port` of an absolute http(s) URL; undefined for anything else. */
export function originOf(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  const text = url.trim();
  if (!text || text.startsWith("//")) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return undefined;
  }
  if (!(parsed.protocol in DEFAULT_PORTS) || !parsed.hostname) return undefined;
  const port = parsed.port || DEFAULT_PORTS[parsed.protocol];
  return `${parsed.protocol}//${parsed.hostname.toLowerCase()}:${port}`;
}

function isAbsolute(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

type HeaderBag = Record<string, unknown> | { delete(name: string): unknown };

export class RequestTarget {
  private readonly origins = new Set<string>();

  constructor(config: MisoClientConfig) {
    for (const candidate of [
      config.controllerUrl,
      config.controllerPrivateUrl,
      config.controllerPublicUrl,
    ]) {
      const origin = originOf(candidate);
      if (origin) this.origins.add(origin);
    }
  }

  get controllerOrigins(): string[] {
    return [...this.origins];
  }

  /**
   * Relative paths and controller-origin URLs are controller targets; a request
   * that overrides `baseURL` to another origin, a protocol-relative URL and any
   * other absolute URL are external.
   */
  isController(url: string, baseURL?: string): boolean {
    if (baseURL !== undefined && baseURL !== "") {
      const base = originOf(baseURL);
      if (!base || !this.origins.has(base)) return false;
    }
    const text = String(url ?? "").trim();
    if (text.startsWith("//")) return false;
    if (!isAbsolute(text)) return true;
    const origin = originOf(text);
    return origin !== undefined && this.origins.has(origin);
  }

  /** Drop SDK credential headers a caller copied into an external request. */
  static stripSdkCredentials(headers: unknown): void {
    if (!headers || typeof headers !== "object") return;
    const bag = headers as HeaderBag;
    for (const name of Object.keys(bag)) {
      if (SDK_CREDENTIAL_HEADERS.includes(name.toLowerCase())) {
        if (typeof (bag as { delete?: unknown }).delete === "function") {
          (bag as { delete(name: string): unknown }).delete(name);
        } else {
          delete (bag as Record<string, unknown>)[name];
        }
      }
    }
  }
}

/**
 * Plain transport for non-controller targets: no base URL, no default headers,
 * no token interceptor. SDK credential headers a caller copied in are removed
 * before dispatch.
 */
export function createExternalTransport(timeout: number): AxiosInstance {
  const instance = axios.create({ timeout });
  instance.interceptors.request.use((request: InternalAxiosRequestConfig) => {
    RequestTarget.stripSdkCredentials(request.headers);
    return request;
  });
  return instance;
}
