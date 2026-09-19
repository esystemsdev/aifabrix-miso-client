import type { AxiosRequestConfig } from "axios";
import { BootstrapError } from "./types";

/** Pin managed credentials to the startup controller, including caller overrides. */
export function managedRequestPolicy(controllerUrl: string) {
  const origin = new URL(controllerUrl).origin;
  return (request: AxiosRequestConfig): void => {
    try {
      const base = new URL(request.baseURL || controllerUrl);
      const target = new URL(request.url || "", base);
      if (
        request.url?.startsWith("//") ||
        request.auth ||
        base.origin !== origin ||
        target.origin !== origin ||
        base.username ||
        base.password ||
        target.username ||
        target.password
      )
        throw new Error();
    } catch {
      throw new BootstrapError("untrusted-request-target");
    }
    request.maxRedirects = 0;
  };
}
