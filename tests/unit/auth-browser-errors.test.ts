import {
  isInactiveTokenMessage,
  isStaleBrowserSessionFailure,
  isUnauthorizedApiError,
} from "../../src/utils/auth-browser-errors";

describe("auth-browser-errors", () => {
  describe("isUnauthorizedApiError", () => {
    it("returns false for nullish values", () => {
      expect(isUnauthorizedApiError(null)).toBe(false);
      expect(isUnauthorizedApiError(undefined)).toBe(false);
    });

    it("detects status and statusCode on error", () => {
      expect(isUnauthorizedApiError({ status: 401 })).toBe(true);
      expect(isUnauthorizedApiError({ statusCode: 401 })).toBe(true);
      expect(isUnauthorizedApiError({ status: 403 })).toBe(false);
    });

    it("detects nested response status fields", () => {
      expect(isUnauthorizedApiError({ response: { status: 401 } })).toBe(true);
      expect(isUnauthorizedApiError({ response: { statusCode: 401 } })).toBe(
        true,
      );
      expect(
        isUnauthorizedApiError({ response: { data: { status: 401 } } }),
      ).toBe(true);
      expect(
        isUnauthorizedApiError({ response: { data: { statusCode: 401 } } }),
      ).toBe(true);
    });

    it("detects Unauthorized message patterns", () => {
      expect(isUnauthorizedApiError(new Error("401 Unauthorized"))).toBe(true);
      expect(isUnauthorizedApiError(new Error("Request failed"))).toBe(false);
    });
  });

  describe("isInactiveTokenMessage", () => {
    it("matches inactive token phrases case-insensitively", () => {
      expect(isInactiveTokenMessage("Token is not active")).toBe(true);
      expect(isInactiveTokenMessage("token is not active")).toBe(true);
      expect(isInactiveTokenMessage(null)).toBe(false);
      expect(isInactiveTokenMessage("expired")).toBe(false);
    });
  });

  describe("isStaleBrowserSessionFailure", () => {
    it("flags invalid and unauthorized restore failures", () => {
      expect(
        isStaleBrowserSessionFailure({ ok: false, reason: "invalid" }),
      ).toBe(true);
      expect(
        isStaleBrowserSessionFailure({ ok: false, reason: "unauthorized" }),
      ).toBe(true);
      expect(
        isStaleBrowserSessionFailure({ ok: false, reason: "network" }),
      ).toBe(false);
      expect(isStaleBrowserSessionFailure({ ok: true })).toBe(false);
    });
  });
});
