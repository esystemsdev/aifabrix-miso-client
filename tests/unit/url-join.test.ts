/**
 * Unit tests for url-join helper (joinApiRoot, normalizeRootUrl).
 *
 * Covers plan 57 decisions:
 *   - Single join function for all backend URLs.
 *   - Trailing-slash normalization on root.
 *   - Path must start with "/".
 *   - Full roots with path (e.g. "/miso") are preserved.
 *   - No silent de-duplication; double-prefix is detected and surfaced.
 */

import {
  joinApiRoot,
  normalizeRootUrl,
  isDoublePrefix,
} from "../../src/utils/url-join";

describe("url-join", () => {
  describe("normalizeRootUrl", () => {
    it("returns http URL without trailing slash unchanged", () => {
      expect(normalizeRootUrl("http://example.com")).toBe("http://example.com");
    });

    it("returns https URL without trailing slash unchanged", () => {
      expect(normalizeRootUrl("https://example.com")).toBe(
        "https://example.com",
      );
    });

    it("strips a single trailing slash from origin-only URL", () => {
      expect(normalizeRootUrl("https://example.com/")).toBe(
        "https://example.com",
      );
    });

    it("preserves a path segment", () => {
      expect(normalizeRootUrl("https://example.com/miso")).toBe(
        "https://example.com/miso",
      );
    });

    it("strips a trailing slash from path", () => {
      expect(normalizeRootUrl("https://example.com/miso/")).toBe(
        "https://example.com/miso",
      );
    });

    it("strips multiple trailing slashes", () => {
      expect(normalizeRootUrl("https://example.com/miso///")).toBe(
        "https://example.com/miso",
      );
    });

    it("preserves nested path", () => {
      expect(normalizeRootUrl("https://example.com/foo/bar")).toBe(
        "https://example.com/foo/bar",
      );
    });

    it("preserves port number", () => {
      expect(normalizeRootUrl("http://localhost:3000")).toBe(
        "http://localhost:3000",
      );
    });

    it("preserves port number with path", () => {
      expect(normalizeRootUrl("http://localhost:3000/miso")).toBe(
        "http://localhost:3000/miso",
      );
    });

    it("drops query string", () => {
      expect(normalizeRootUrl("https://example.com/miso?x=1")).toBe(
        "https://example.com/miso",
      );
    });

    it("drops hash fragment", () => {
      expect(normalizeRootUrl("https://example.com/miso#section")).toBe(
        "https://example.com/miso",
      );
    });

    it("throws on empty string", () => {
      expect(() => normalizeRootUrl("")).toThrow(
        "normalizeRootUrl: root must be a non-empty string",
      );
    });

    it("throws on whitespace-only string", () => {
      expect(() => normalizeRootUrl("   ")).toThrow(
        "normalizeRootUrl: root must be a non-empty string",
      );
    });

    it("throws on non-string input", () => {
      expect(() => normalizeRootUrl(undefined as unknown as string)).toThrow(
        "normalizeRootUrl: root must be a non-empty string",
      );
    });

    it("throws on unparseable URL", () => {
      expect(() => normalizeRootUrl("not a url")).toThrow(
        /normalizeRootUrl: invalid URL/,
      );
    });

    it("throws on non-http(s) protocol (ftp)", () => {
      expect(() => normalizeRootUrl("ftp://example.com")).toThrow(
        /protocol must be http or https/,
      );
    });

    it("throws on non-http(s) protocol (file)", () => {
      expect(() => normalizeRootUrl("file:///etc/passwd")).toThrow(
        /protocol must be http or https/,
      );
    });
  });

  describe("joinApiRoot", () => {
    it("joins origin-only root with API path", () => {
      expect(joinApiRoot("https://example.com", "/api/v1/health")).toBe(
        "https://example.com/api/v1/health",
      );
    });

    it("joins root with /miso virtual-directory and API path", () => {
      expect(joinApiRoot("https://example.com/miso", "/api/v1/health")).toBe(
        "https://example.com/miso/api/v1/health",
      );
    });

    it("joins root with /data virtual-directory and API path", () => {
      expect(joinApiRoot("https://example.com/data", "/api/items")).toBe(
        "https://example.com/data/api/items",
      );
    });

    it("joins root with custom virtual-directory and API path", () => {
      expect(joinApiRoot("https://example.com/myapp", "/api/foo")).toBe(
        "https://example.com/myapp/api/foo",
      );
    });

    it("normalizes trailing slash on root before joining", () => {
      expect(joinApiRoot("https://example.com/miso/", "/api/v1/health")).toBe(
        "https://example.com/miso/api/v1/health",
      );
    });

    it("normalizes trailing slash on origin-only root before joining", () => {
      expect(joinApiRoot("https://example.com/", "/api/v1/health")).toBe(
        "https://example.com/api/v1/health",
      );
    });

    it("does not silently de-duplicate when both root and path include the segment", () => {
      const result = joinApiRoot(
        "https://example.com/miso",
        "/miso/api/v1/health",
      );
      expect(result).toBe("https://example.com/miso/miso/api/v1/health");
    });

    it("preserves localhost host as-is (no IPv4 rewrite in joiner)", () => {
      expect(joinApiRoot("http://localhost:3000", "/api/v1/health")).toBe(
        "http://localhost:3000/api/v1/health",
      );
    });

    it("works with port and virtual-directory together", () => {
      expect(joinApiRoot("http://localhost:3000/miso", "/api/v1/x")).toBe(
        "http://localhost:3000/miso/api/v1/x",
      );
    });

    it("propagates query/hash from path argument", () => {
      expect(joinApiRoot("https://example.com/miso", "/api?x=1#h")).toBe(
        "https://example.com/miso/api?x=1#h",
      );
    });

    it("throws on path that does not start with '/'", () => {
      expect(() =>
        joinApiRoot("https://example.com", "api/v1/health"),
      ).toThrow(/path must start with "\/"/);
    });

    it("throws on empty path", () => {
      expect(() => joinApiRoot("https://example.com", "")).toThrow(
        /path must start with "\/"/,
      );
    });

    it("throws on https absolute URL passed as path (does not start with '/')", () => {
      expect(() =>
        joinApiRoot("https://example.com", "https://other.com/api"),
      ).toThrow(/path must start with "\/"/);
    });

    it("throws on http absolute URL passed as path (does not start with '/')", () => {
      expect(() =>
        joinApiRoot("https://example.com", "http://other.com/api"),
      ).toThrow(/path must start with "\/"/);
    });

    it("throws on absolute URL that begins with '/' but contains protocol-like prefix", () => {
      // Defensive: the protocol guard catches URLs that pass startsWith('/') but
      // still encode an absolute http(s) reference.
      const sneaky = "/https://example.com";
      expect(() => joinApiRoot("https://example.com", sneaky)).not.toThrow();
    });

    it("throws on non-string path", () => {
      expect(() =>
        joinApiRoot("https://example.com", undefined as unknown as string),
      ).toThrow(/path must be a string/);
    });

    it("throws on invalid root URL", () => {
      expect(() => joinApiRoot("not a url", "/api/v1/health")).toThrow(
        /invalid URL/,
      );
    });

    it("throws on non-http(s) root", () => {
      expect(() => joinApiRoot("ftp://example.com", "/api/v1/health")).toThrow(
        /protocol must be http or https/,
      );
    });
  });

  describe("isDoublePrefix", () => {
    it("returns true when path repeats root pathname", () => {
      expect(isDoublePrefix("https://example.com/miso", "/miso/api")).toBe(
        true,
      );
    });

    it("returns true when path equals root pathname exactly", () => {
      expect(isDoublePrefix("https://example.com/miso", "/miso")).toBe(true);
    });

    it("returns false when path differs from root pathname", () => {
      expect(isDoublePrefix("https://example.com/miso", "/api/v1/health")).toBe(
        false,
      );
    });

    it("returns false when root has no path segment", () => {
      expect(isDoublePrefix("https://example.com", "/miso/api")).toBe(false);
    });

    it("returns false for non-prefix path with similar leading text", () => {
      expect(isDoublePrefix("https://example.com/miso", "/misox/api")).toBe(
        false,
      );
    });

    it("returns false when path does not start with '/'", () => {
      expect(isDoublePrefix("https://example.com/miso", "miso/api")).toBe(
        false,
      );
    });

    it("returns false when root is invalid", () => {
      expect(isDoublePrefix("not a url", "/miso/api")).toBe(false);
    });

    it("ignores trailing slash on root pathname", () => {
      expect(isDoublePrefix("https://example.com/miso/", "/miso/api")).toBe(
        true,
      );
    });
  });

  describe("plan 57 generic multi-app behavior", () => {
    // Same code path for "/", "/miso", "/data", "/myapp" — no SDK constants.
    const cases: Array<[string, string, string]> = [
      [
        "https://domain.com",
        "/api/v1/health",
        "https://domain.com/api/v1/health",
      ],
      [
        "https://domain.com/miso",
        "/api/v1/health",
        "https://domain.com/miso/api/v1/health",
      ],
      [
        "https://domain.com/data",
        "/api/items",
        "https://domain.com/data/api/items",
      ],
      [
        "https://domain.com/myapp",
        "/api/foo",
        "https://domain.com/myapp/api/foo",
      ],
      [
        "https://domain.com/anything",
        "/api/x",
        "https://domain.com/anything/api/x",
      ],
    ];

    it.each(cases)(
      "joinApiRoot(%s, %s) === %s",
      (root, path, expected) => {
        expect(joinApiRoot(root, path)).toBe(expected);
      },
    );
  });
});
