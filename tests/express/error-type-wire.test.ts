/**
 * What a caller receives on the wire when a route throws an AppError (real asyncHandler and
 * handleRouteError behind a real HTTP server). A typed `errorType` must reach the RFC 7807 `type`;
 * without one, `type` still follows the status code.
 */

import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { asyncHandler } from "../../src/express/async-handler";
import { AppError } from "../../src/express/error-types";

describe("RFC 7807 type on the wire", () => {
  let server: Server;
  let baseUrl: string;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    const app = express();
    const routes: Record<string, () => unknown> = {
      "typed-404": () => {
        throw new AppError("Application not found", 404, true, {
          errorType: "/Errors/ApplicationNotFound",
        });
      },
      "typed-502": () => {
        throw new AppError("Upstream failed", 502, true, {
          errorType: "/Errors/BadGateway",
        });
      },
      "typed-400": () => {
        throw new AppError("Invalid input", 400, true, {
          errorType: "/Errors/ValidationError",
        });
      },
      "untyped-404": () => {
        throw new AppError("Missing", 404);
      },
      "legacy-array": () => {
        throw new AppError("Bad fields", 400, true, [
          { field: "name", message: "required" },
        ]);
      },
      "plain-error": () => {
        throw new Error("User not found");
      },
    };
    app.get(
      "/:case",
      asyncHandler(async (req) => {
        routes[String(req.params["case"])]();
      }, "wireCase"),
    );
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  async function get(path: string) {
    const response = await fetch(`${baseUrl}/${path}`);
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  it.each([
    ["typed-404", 404, "/Errors/ApplicationNotFound", "Not Found"],
    ["typed-502", 502, "/Errors/BadGateway", "Internal Server Error"],
    ["typed-400", 400, "/Errors/ValidationError", "Bad Request"],
  ])(
    "[CORE] %s keeps the typed errorType as type",
    async (path, status, type, title) => {
      const res = await get(path);

      expect(res.status).toBe(status);
      expect(res.contentType).toContain("application/problem+json");
      expect(res.body).toMatchObject({
        type,
        title,
        status,
        instance: `/${path}`,
      });
    },
  );

  it.each([
    ["untyped-404", 404, "/Errors/NotFound"],
    ["legacy-array", 400, "/Errors/BadRequest"],
    ["plain-error", 404, "/Errors/NotFound"],
  ])(
    "%s without errorType still gets the status type",
    async (path, status, type) => {
      const res = await get(path);

      expect(res.status).toBe(status);
      expect(res.body).toMatchObject({ type, status });
    },
  );

  it("an AppError given validation errors as an array still sends them", async () => {
    const res = await get("legacy-array");

    expect(res.body["errors"]).toEqual([
      { field: "name", message: "required" },
    ]);
  });
});
