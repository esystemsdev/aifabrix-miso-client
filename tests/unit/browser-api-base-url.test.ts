import { resolveBrowserApiBaseUrl } from "../../src/utils/browser-api-base-url";

describe("resolveBrowserApiBaseUrl", () => {
  it("returns explicit miso base URL when set", () => {
    expect(
      resolveBrowserApiBaseUrl({
        explicitMisoApiBaseUrl: "https://api.example.com/",
        configuredApiBaseUrl: "http://localhost:3600",
        pageOrigin: "http://localhost:3610",
      }),
    ).toBe("https://api.example.com");
  });

  it("uses page origin when configured host differs (split-port dev)", () => {
    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "http://localhost:3600",
        pageOrigin: "http://localhost:3610",
      }),
    ).toBe("http://localhost:3610");
  });

  it("keeps configured URL when host matches page origin", () => {
    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "http://localhost:3610",
        pageOrigin: "http://localhost:3610",
      }),
    ).toBe("http://localhost:3610");
  });

  it("keeps configured path prefix when host matches", () => {
    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "http://localhost:3610/miso",
        pageOrigin: "http://localhost:3610",
      }),
    ).toBe("http://localhost:3610/miso");
  });

  it("returns page origin when configured URL is empty", () => {
    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "",
        pageOrigin: "http://localhost:3610",
      }),
    ).toBe("http://localhost:3610");
  });

  it("returns configured URL when page origin is empty", () => {
    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "http://localhost:3600",
        pageOrigin: "",
      }),
    ).toBe("http://localhost:3600");
  });

  it("returns configured URL when configured URL is invalid but page origin set", () => {
    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "not-a-url",
        pageOrigin: "http://localhost:3610",
      }),
    ).toBe("not-a-url");
  });

  it("merges basePath onto default page origin when pageOrigin omitted", () => {
    const originalLocation = (globalThis as { location?: { origin: string } })
      .location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { origin: "http://localhost:3610" },
    });

    expect(
      resolveBrowserApiBaseUrl({
        configuredApiBaseUrl: "",
        basePath: "/miso",
      }),
    ).toBe("http://localhost:3610/miso");

    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
