import {
  parsePublicApplicationUrlReference,
  resolvePublicApplicationUrl,
  resolvePublicOrigins,
} from "../../src/utils/application-url-resolver";

describe("runtime application URL resolution", () => {
  const reader = {
    getApplicationStatus: jest.fn(async (_envKey: string, appKey: string) => ({
      key: appKey,
      url: `https://${appKey}.frontdoor.example/base`,
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reader.getApplicationStatus.mockImplementation(
      async (_envKey: string, appKey: string) => ({
        key: appKey,
        url: `https://${appKey}.frontdoor.example/base`,
      }),
    );
  });

  it("parses self and targeted public references", () => {
    expect(parsePublicApplicationUrlReference("url://public")).toEqual({
      surface: "full",
    });
    expect(
      parsePublicApplicationUrlReference("url://keycloak-host-public"),
    ).toEqual({
      targetKey: "keycloak",
      surface: "host",
    });
  });

  it("reads current status on every resolution without a client-local URL cache", async () => {
    reader.getApplicationStatus
      .mockResolvedValueOnce({
        key: "portal",
        url: "https://direct.example/app",
      })
      .mockResolvedValueOnce({
        key: "portal",
        url: "https://custom.example/app",
      });

    await expect(
      resolvePublicApplicationUrl({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        reference: "url://public",
      }),
    ).resolves.toBe("https://direct.example/app");
    await expect(
      resolvePublicApplicationUrl({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        reference: "url://public",
      }),
    ).resolves.toBe("https://custom.example/app");
    expect(reader.getApplicationStatus).toHaveBeenCalledTimes(2);
  });

  it("resolves mixed CORS lists to normalized, deduplicated public origins", async () => {
    await expect(
      resolvePublicOrigins({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        origins: [
          "http://localhost:*, url://public",
          "url://keycloak-public",
          "https://portal.frontdoor.example",
        ],
      }),
    ).resolves.toEqual([
      "http://localhost:*",
      "https://portal.frontdoor.example",
      "https://keycloak.frontdoor.example",
    ]);
  });

  it("keeps concrete bootstrap origins while resolving current public origins", async () => {
    await expect(
      resolvePublicOrigins({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        bootstrapOrigins: [
          "http://localhost:*,https://initial.example.com,https://portal.azurewebsites.net",
        ],
        origins: [
          "http://localhost:*",
          "url://host-public",
          "url://host-private",
        ],
      }),
    ).resolves.toEqual([
      "http://localhost:*",
      "https://portal.frontdoor.example",
      "https://portal.azurewebsites.net",
    ]);
  });

  it("fails closed when an own-private marker has no concrete bootstrap origin", async () => {
    await expect(
      resolvePublicOrigins({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        bootstrapOrigins: ["http://localhost:*,url://host-private"],
        origins: ["http://localhost:*,url://host-private"],
      }),
    ).rejects.toThrow("Concrete private CORS bootstrap origin is unavailable");
  });

  it("keeps a cross-application private origin from the concrete bootstrap only", async () => {
    await expect(
      resolvePublicOrigins({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        bootstrapOrigins: [
          "https://dataplane.initial.example,https://dataplane.azurewebsites.net",
        ],
        origins: [
          "url://dataplane-host-public",
          "url://dataplane-host-private",
        ],
      }),
    ).resolves.toEqual([
      "https://dataplane.frontdoor.example",
      "https://dataplane.azurewebsites.net",
    ]);
  });

  it("fails closed for internal logical references", async () => {
    await expect(
      resolvePublicOrigins({
        reader,
        envKey: "dev",
        ownAppKey: "portal",
        origins: ["url://keycloak-internal"],
      }),
    ).rejects.toThrow("Concrete private CORS bootstrap origin is unavailable");
  });
});
