/**
 * Unit tests for browser JWT decoder utility
 */

import { decodeJWT, extractUserIdFromToken } from "../../src/utils/browser-jwt-decoder";

describe("browser-jwt-decoder", () => {
  describe("decodeJWT", () => {
    it("should decode valid JWT token", () => {
      // Create a valid JWT token (header.payload.signature)
      // Payload: {"sub":"123","userId":"123","iat":1234567890}
      const payload = btoa(
        JSON.stringify({ sub: "123", userId: "123", iat: 1234567890 }),
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const signature = "signature";
      const token = `${header}.${payload}.${signature}`;

      const result = decodeJWT(token);

      expect(result).toEqual({
        sub: "123",
        userId: "123",
        iat: 1234567890,
      });
    });

    it("should return null for invalid token format", () => {
      const result = decodeJWT("invalid-token");
      expect(result).toBeNull();
    });

    it("should return null for token with wrong number of parts", () => {
      const result = decodeJWT("header.payload");
      expect(result).toBeNull();
    });

    it("should return null for token with invalid base64url", () => {
      const result = decodeJWT("header.invalid-base64!.signature");
      expect(result).toBeNull();
    });

    it("should return null for token with invalid JSON payload", () => {
      const invalidPayload = btoa("not-json")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${invalidPayload}.signature`;

      const result = decodeJWT(token);
      expect(result).toBeNull();
    });

    it("should handle base64url padding correctly", () => {
      // Payload that needs padding: {"sub":"123"}
      const payload = btoa(JSON.stringify({ sub: "123" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = decodeJWT(token);
      expect(result).toEqual({ sub: "123" });
    });
  });

  describe("extractUserIdFromToken", () => {
    it("should extract userId from sub field", () => {
      const payload = btoa(JSON.stringify({ sub: "user-123" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = extractUserIdFromToken(token);
      expect(result).toBe("user-123");
    });

    it("should extract userId from userId field", () => {
      const payload = btoa(JSON.stringify({ userId: "user-456" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = extractUserIdFromToken(token);
      expect(result).toBe("user-456");
    });

    it("should extract userId from user_id field", () => {
      const payload = btoa(JSON.stringify({ user_id: "user-789" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = extractUserIdFromToken(token);
      expect(result).toBe("user-789");
    });

    it("should extract userId from id field", () => {
      const payload = btoa(JSON.stringify({ id: "user-999" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = extractUserIdFromToken(token);
      expect(result).toBe("user-999");
    });

    it("should prioritize sub over other fields", () => {
      const payload = btoa(
        JSON.stringify({
          sub: "user-sub",
          userId: "user-id",
          user_id: "user-underscore",
          id: "user-id-field",
        }),
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = extractUserIdFromToken(token);
      expect(result).toBe("user-sub");
    });

    it("should return null if no userId fields found", () => {
      const payload = btoa(JSON.stringify({ email: "test@example.com" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
      const token = `${header}.${payload}.signature`;

      const result = extractUserIdFromToken(token);
      expect(result).toBeNull();
    });

    it("should return null for invalid token", () => {
      const result = extractUserIdFromToken("invalid-token");
      expect(result).toBeNull();
    });
  });
});

