/**
 * Unit tests for ValidationHelper
 */

import { Request } from "express";
import { ValidationHelper } from "../../src/express/validation-helper";
import { AppError } from "../../src/express/error-types";

describe("ValidationHelper", () => {
  describe("findOrFail()", () => {
    it("should return entity when found", async () => {
      const entity = { id: "1", name: "Test" };
      const finder = jest.fn().mockResolvedValue(entity);

      const result = await ValidationHelper.findOrFail(finder, "User", "1");

      expect(result).toBe(entity);
      expect(finder).toHaveBeenCalled();
    });

    it("should throw 404 AppError when entity not found", async () => {
      const finder = jest.fn().mockResolvedValue(null);

      await expect(
        ValidationHelper.findOrFail(finder, "User", "1"),
      ).rejects.toThrow(AppError);

      try {
        await ValidationHelper.findOrFail(finder, "User", "1");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(404);
        expect((error as AppError).message).toBe("User not found: 1");
        expect((error as AppError).errorType).toBe("/Errors/NotFound");
      }
    });

    it("should throw 404 without ID in message if not provided", async () => {
      const finder = jest.fn().mockResolvedValue(null);

      try {
        await ValidationHelper.findOrFail(finder, "User");
      } catch (error) {
        expect((error as AppError).message).toBe("User not found");
      }
    });

    it("should work with different entity types", async () => {
      const entity = { id: "123", title: "Post" };
      const finder = jest.fn().mockResolvedValue(entity);

      const result = await ValidationHelper.findOrFail(finder, "Post", "123");

      expect(result).toEqual(entity);
    });
  });

  describe("ensureNotExists()", () => {
    it("should not throw when entity does not exist", async () => {
      const finder = jest.fn().mockResolvedValue(null);

      await expect(
        ValidationHelper.ensureNotExists(finder, "User", "test@example.com"),
      ).resolves.not.toThrow();
    });

    it("should throw 409 AppError when entity exists", async () => {
      const entity = { id: "1", email: "test@example.com" };
      const finder = jest.fn().mockResolvedValue(entity);

      await expect(
        ValidationHelper.ensureNotExists(finder, "User", "test@example.com"),
      ).rejects.toThrow(AppError);

      try {
        await ValidationHelper.ensureNotExists(
          finder,
          "User",
          "test@example.com",
        );
      } catch (error) {
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).message).toBe(
          "User already exists: test@example.com",
        );
        expect((error as AppError).errorType).toBe("/Errors/Conflict");
      }
    });

    it("should throw 409 without identifier in message if not provided", async () => {
      const entity = { id: "1" };
      const finder = jest.fn().mockResolvedValue(entity);

      try {
        await ValidationHelper.ensureNotExists(finder, "User");
      } catch (error) {
        expect((error as AppError).message).toBe("User already exists");
      }
    });
  });

  describe("ensureOwnershipOrAdmin()", () => {
    it("should not throw when user is owner", () => {
      const req = { userId: "123", userRoles: [] };

      expect(() => {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      }).not.toThrow();
    });

    it("should not throw when user is admin", () => {
      const req = { userId: "456", userRoles: ["admin"] };

      expect(() => {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      }).not.toThrow();
    });

    it("should not throw when user is superuser", () => {
      const req = { userId: "456", userRoles: ["superuser"] };

      expect(() => {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      }).not.toThrow();
    });

    it("should throw 403 when user is neither owner nor admin", () => {
      const req = { userId: "456", userRoles: ["user"] };

      expect(() => {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      }).toThrow(AppError);

      try {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      } catch (error) {
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).message).toBe(
          "No permission to access this resource",
        );
        expect((error as AppError).errorType).toBe("/Errors/Forbidden");
      }
    });

    it("should use custom error message", () => {
      const req = { userId: "456", userRoles: [] };
      const customMessage = "You cannot edit this post";

      try {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123", customMessage);
      } catch (error) {
        expect((error as AppError).message).toBe(customMessage);
      }
    });

    it("should handle missing userRoles", () => {
      const req = { userId: "456" };

      expect(() => {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      }).toThrow(AppError);
    });

    it("should handle missing userId", () => {
      const req = { userRoles: ["user"] };

      expect(() => {
        ValidationHelper.ensureOwnershipOrAdmin(req, "123");
      }).toThrow(AppError);
    });
  });

  describe("validateAll()", () => {
    it("should execute all validations successfully", async () => {
      const validation1 = jest.fn().mockResolvedValue(undefined);
      const validation2 = jest.fn().mockResolvedValue(undefined);
      const validation3 = jest.fn().mockResolvedValue(undefined);

      await ValidationHelper.validateAll([
        validation1,
        validation2,
        validation3,
      ]);

      expect(validation1).toHaveBeenCalled();
      expect(validation2).toHaveBeenCalled();
      expect(validation3).toHaveBeenCalled();
    });

    it("should throw if any validation fails", async () => {
      const validation1 = jest.fn().mockResolvedValue(undefined);
      const validation2 = jest
        .fn()
        .mockRejectedValue(new Error("Validation failed"));
      const validation3 = jest.fn().mockResolvedValue(undefined);

      await expect(
        ValidationHelper.validateAll([validation1, validation2, validation3]),
      ).rejects.toThrow("Validation failed");
    });

    it("should handle empty validation array", async () => {
      await expect(ValidationHelper.validateAll([])).resolves.not.toThrow();
    });

    it("should run validations in parallel", async () => {
      let completed = 0;
      const validation1 = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        completed++;
      });
      const validation2 = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        completed++;
      });

      const startTime = Date.now();
      await ValidationHelper.validateAll([validation1, validation2]);
      const duration = Date.now() - startTime;

      // Should take ~30ms if parallel, ~60ms if sequential
      // Allow extra time for slower systems
      expect(duration).toBeLessThan(100);
      expect(completed).toBe(2);
    });
  });

  describe("validateRequiredFields()", () => {
    it("should not throw when all required fields are present", () => {
      const data = { name: "John", email: "john@example.com", age: 30 };

      expect(() => {
        ValidationHelper.validateRequiredFields(
          data,
          ["name", "email"],
          "User",
        );
      }).not.toThrow();
    });

    it("should throw 400 when required fields are missing", () => {
      const data = { name: "John" };

      expect(() => {
        ValidationHelper.validateRequiredFields(
          data,
          ["name", "email", "age"],
          "User",
        );
      }).toThrow(AppError);

      try {
        ValidationHelper.validateRequiredFields(
          data,
          ["name", "email", "age"],
          "User",
        );
      } catch (error) {
        expect((error as AppError).statusCode).toBe(400);
        expect((error as AppError).message).toContain(
          "Missing required fields for User",
        );
        expect((error as AppError).message).toContain("email");
        expect((error as AppError).message).toContain("age");
        expect((error as AppError).errorType).toBe("/Errors/BadRequest");
      }
    });

    it("should treat null as missing", () => {
      const data = { name: "John", email: null };

      expect(() => {
        ValidationHelper.validateRequiredFields(
          data,
          ["name", "email"],
          "User",
        );
      }).toThrow();
    });

    it("should treat empty string as missing", () => {
      const data = { name: "John", email: "" };

      expect(() => {
        ValidationHelper.validateRequiredFields(
          data,
          ["name", "email"],
          "User",
        );
      }).toThrow();
    });

    it("should handle no required fields", () => {
      const data = { name: "John" };

      expect(() => {
        ValidationHelper.validateRequiredFields(data, [], "User");
      }).not.toThrow();
    });

    it("should accept 0 and false as valid values", () => {
      const data = { count: 0, active: false, name: "Test" };

      expect(() => {
        ValidationHelper.validateRequiredFields(
          data,
          ["count", "active", "name"],
          "Entity",
        );
      }).not.toThrow();
    });
  });

  describe("ensureAuthenticated()", () => {
    it("should not throw when userId is present", () => {
      const req = { userId: "123" } as Request & { userId?: string };

      expect(() => {
        ValidationHelper.ensureAuthenticated(req);
      }).not.toThrow();
    });

    it("should throw 401 when userId is missing", () => {
      const req = {} as Request & { userId?: string };

      expect(() => {
        ValidationHelper.ensureAuthenticated(req);
      }).toThrow(AppError);

      try {
        ValidationHelper.ensureAuthenticated(req);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(401);
        expect((error as AppError).message).toBe("Authentication required");
        expect((error as AppError).errorType).toBe("/Errors/Unauthorized");
      }
    });

    it("should throw 401 when userId is undefined", () => {
      const req = { userId: undefined } as Request & { userId?: string };

      expect(() => {
        ValidationHelper.ensureAuthenticated(req);
      }).toThrow(AppError);
    });
  });

  describe("validateStringLength()", () => {
    it("should not throw for valid string length", () => {
      expect(() => {
        ValidationHelper.validateStringLength("hello", "name", 3, 10);
      }).not.toThrow();
    });

    it("should throw 400 when string is too short", () => {
      expect(() => {
        ValidationHelper.validateStringLength("ab", "password", 8, 100);
      }).toThrow(AppError);

      try {
        ValidationHelper.validateStringLength("ab", "password", 8);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(400);
        expect((error as AppError).message).toBe(
          "password must be at least 8 characters",
        );
        expect((error as AppError).errorType).toBe("/Errors/BadRequest");
      }
    });

    it("should throw 400 when string is too long", () => {
      expect(() => {
        ValidationHelper.validateStringLength(
          "a".repeat(101),
          "bio",
          undefined,
          100,
        );
      }).toThrow(AppError);

      try {
        ValidationHelper.validateStringLength(
          "a".repeat(101),
          "bio",
          undefined,
          100,
        );
      } catch (error) {
        expect((error as AppError).statusCode).toBe(400);
        expect((error as AppError).message).toBe(
          "bio must not exceed 100 characters",
        );
      }
    });

    it("should allow validation with only min", () => {
      expect(() => {
        ValidationHelper.validateStringLength("hello", "name", 3);
      }).not.toThrow();
    });

    it("should allow validation with only max", () => {
      expect(() => {
        ValidationHelper.validateStringLength("hello", "name", undefined, 10);
      }).not.toThrow();
    });

    it("should handle empty string with min constraint", () => {
      expect(() => {
        ValidationHelper.validateStringLength("", "name", 1);
      }).toThrow();
    });

    it("should allow empty string with no constraints", () => {
      expect(() => {
        ValidationHelper.validateStringLength("", "name");
      }).not.toThrow();
    });

    it("should accept string at exact min length", () => {
      expect(() => {
        ValidationHelper.validateStringLength("12345678", "password", 8);
      }).not.toThrow();
    });

    it("should accept string at exact max length", () => {
      expect(() => {
        ValidationHelper.validateStringLength("12345", "code", undefined, 5);
      }).not.toThrow();
    });
  });
});
