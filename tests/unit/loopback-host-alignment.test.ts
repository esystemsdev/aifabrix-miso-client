import { alignLoopbackHostnameWithPage } from "../../src/utils/loopback-host-alignment";

describe("alignLoopbackHostnameWithPage", () => {
  it("returns non-http input unchanged", () => {
    expect(alignLoopbackHostnameWithPage("")).toBe("");
    expect(alignLoopbackHostnameWithPage("/api/v1")).toBe("/api/v1");
  });

  it("rewrites 127.0.0.1 to localhost when page is localhost", () => {
    expect(
      alignLoopbackHostnameWithPage("http://127.0.0.1:3600/api", {
        pageHostname: "localhost",
      }),
    ).toBe("http://localhost:3600/api");
  });

  it("rewrites localhost to 127.0.0.1 when page is 127.0.0.1", () => {
    expect(
      alignLoopbackHostnameWithPage("http://localhost:3600/", {
        pageHostname: "127.0.0.1",
      }),
    ).toBe("http://127.0.0.1:3600");
  });

  it("leaves URL unchanged when hosts already match", () => {
    expect(
      alignLoopbackHostnameWithPage("http://localhost:3600", {
        pageHostname: "localhost",
      }),
    ).toBe("http://localhost:3600");
  });

  it("returns original URL when page hostname is unavailable", () => {
    expect(alignLoopbackHostnameWithPage("http://127.0.0.1:3600")).toBe(
      "http://127.0.0.1:3600",
    );
  });

  it("returns original URL when URL parsing fails", () => {
    expect(
      alignLoopbackHostnameWithPage("http://[::1", {
        pageHostname: "localhost",
      }),
    ).toBe("http://[::1");
  });
});
