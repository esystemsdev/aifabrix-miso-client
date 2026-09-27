import { RequestTarget, originOf } from "../../../src/utils/request-target";
import { AxiosHeaders } from "axios";

const config = {
  controllerUrl: "https://miso.test",
  controllerPrivateUrl: "http://miso-controller:3000/miso",
  clientId: "client",
};

describe("originOf", () => {
  it("normalises scheme, host and default port", () => {
    expect(originOf("HTTPS://Miso.Test:443/api")).toBe("https://miso.test:443");
    expect(originOf("http://miso-controller:3000/miso")).toBe(
      "http://miso-controller:3000",
    );
  });

  it("is undefined for relative, protocol-relative, empty and non-http values", () => {
    // [EDGE] these are not origins and must not accidentally match the controller
    expect(originOf("/api/v1/health")).toBeUndefined();
    expect(originOf("//miso.test/api")).toBeUndefined();
    expect(originOf("")).toBeUndefined();
    expect(originOf(undefined)).toBeUndefined();
    expect(originOf("mailto:someone@miso.test")).toBeUndefined();
  });
});

describe("RequestTarget", () => {
  const target = new RequestTarget(config);

  it("treats relative paths and controller-origin URLs as controller targets", () => {
    expect(target.isController("/api/v1/health")).toBe(true);
    expect(target.isController("https://miso.test/api/v1/health")).toBe(true);
    expect(target.isController("https://MISO.test:443/api")).toBe(true);
    expect(
      target.isController("http://miso-controller:3000/miso/api/v1/auth/token"),
    ).toBe(true);
  });

  it("treats every other origin as external", () => {
    expect(
      target.isController("https://api.openai.com/v1/chat/completions"),
    ).toBe(false);
    // [EDGE] other scheme or other port on the controller host is another origin
    expect(target.isController("http://miso.test/api")).toBe(false);
    expect(target.isController("https://miso.test:8443/api")).toBe(false);
    // [EDGE] protocol-relative URLs borrow the scheme; never trusted
    expect(target.isController("//miso.test/api")).toBe(false);
    // [EDGE] a baseURL override to a foreign origin makes a relative path external
    expect(target.isController("/api", "https://foreign.test")).toBe(false);
    expect(target.isController("/api", "https://miso.test")).toBe(true);
  });

  it("strips only SDK credential headers", () => {
    const plain: Record<string, string> = {
      "X-Client-Token": "t",
      "x-client-id": "i",
      "x-client-secret": "s",
      Authorization: "Bearer provider-key",
    };
    RequestTarget.stripSdkCredentials(plain);
    expect(plain).toEqual({ Authorization: "Bearer provider-key" });

    const axiosHeaders = new AxiosHeaders({
      "x-client-token": "t",
      Authorization: "Bearer provider-key",
    });
    RequestTarget.stripSdkCredentials(axiosHeaders);
    expect(axiosHeaders.has("x-client-token")).toBe(false);
    expect(axiosHeaders.get("Authorization")).toBe("Bearer provider-key");
    RequestTarget.stripSdkCredentials(undefined); // [EDGE] no headers at all
  });
});
