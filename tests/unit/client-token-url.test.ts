import {
  extractClientTokenFromUrl,
  removeClientTokenFromUrl,
} from "../../src/utils/client-token-url";

describe("client-token-url", () => {
  describe("extractClientTokenFromUrl", () => {
    it("returns null when location is unavailable", () => {
      expect(extractClientTokenFromUrl({ location: undefined })).toBeNull();
    });

    it("reads token from query string", () => {
      expect(
        extractClientTokenFromUrl({
          location: {
            href: "http://localhost:3610/?x-client-token=abc",
            search: "?x-client-token=abc",
            hash: "",
          },
        }),
      ).toBe("abc");
    });

    it("reads token from hash when query is empty", () => {
      expect(
        extractClientTokenFromUrl({
          location: {
            href: "http://localhost:3610/#x-client-token=hash-token",
            search: "",
            hash: "#x-client-token=hash-token",
          },
        }),
      ).toBe("hash-token");
    });

    it("prefers query over hash", () => {
      expect(
        extractClientTokenFromUrl({
          location: {
            href: "http://localhost:3610/?x-client-token=query#x-client-token=hash",
            search: "?x-client-token=query",
            hash: "#x-client-token=hash",
          },
        }),
      ).toBe("query");
    });

    it("supports custom param name", () => {
      expect(
        extractClientTokenFromUrl({
          paramName: "clientToken",
          location: {
            href: "http://localhost/?clientToken=xyz",
            search: "?clientToken=xyz",
            hash: "",
          },
        }),
      ).toBe("xyz");
    });
  });

  describe("removeClientTokenFromUrl", () => {
    it("no-ops when location is unavailable", () => {
      const replaceUrl = jest.fn();
      removeClientTokenFromUrl({ location: undefined, replaceUrl });
      expect(replaceUrl).not.toHaveBeenCalled();
    });

    it("removes token from query and hash via replaceUrl", () => {
      const replaceUrl = jest.fn();
      removeClientTokenFromUrl({
        location: {
          href: "http://localhost:3610/app?x-client-token=secret#x-client-token=secret&state=1",
          search: "?x-client-token=secret",
          hash: "#x-client-token=secret&state=1",
        },
        replaceUrl,
      });

      expect(replaceUrl).toHaveBeenCalledTimes(1);
      const next = replaceUrl.mock.calls[0][0] as string;
      expect(next).not.toContain("x-client-token=secret");
      expect(next).toContain("state=1");
    });

    it("uses history.replaceState when replaceUrl is omitted", () => {
      const replaceState = jest.fn();
      const originalHistory = (globalThis as { history?: unknown }).history;
      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: { replaceState },
      });

      removeClientTokenFromUrl({
        location: {
          href: "http://localhost:3610/?x-client-token=remove-me",
          search: "?x-client-token=remove-me",
          hash: "",
        },
      });

      expect(replaceState).toHaveBeenCalledWith(
        {},
        "",
        "http://localhost:3610/",
      );

      Object.defineProperty(globalThis, "history", {
        configurable: true,
        value: originalHistory,
      });
    });
  });
});
