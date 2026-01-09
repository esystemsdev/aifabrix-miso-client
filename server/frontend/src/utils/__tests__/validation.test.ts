import { describe, it, expect } from 'vitest';
import {
  validateRoleName,
  validatePermissionName,
  validateEndpoint,
  validateRolesList,
  validatePermissionsList,
} from '../validation';

describe('validation', () => {
  describe('validateRoleName', () => {
    it('should reject empty role name', () => {
      const result = validateRoleName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Role name cannot be empty');
    });

    it('should reject whitespace-only role name', () => {
      const result = validateRoleName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Role name cannot be empty');
    });

    it('should reject role name longer than 100 characters', () => {
      const longRole = 'a'.repeat(101);
      const result = validateRoleName(longRole);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Role name must be 100 characters or less');
    });

    it('should reject role name with invalid characters', () => {
      const result = validateRoleName('role@name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Role name can only contain letters, numbers, underscores, and hyphens');
    });

    it('should accept valid role name with letters', () => {
      const result = validateRoleName('admin');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid role name with numbers', () => {
      const result = validateRoleName('role123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid role name with underscores', () => {
      const result = validateRoleName('role_name');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid role name with hyphens', () => {
      const result = validateRoleName('role-name');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept role name with mixed valid characters', () => {
      const result = validateRoleName('role_123-name');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should trim whitespace before validation', () => {
      const result = validateRoleName('  admin  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validatePermissionName', () => {
    it('should reject empty permission name', () => {
      const result = validatePermissionName('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permission name cannot be empty');
    });

    it('should reject whitespace-only permission name', () => {
      const result = validatePermissionName('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permission name cannot be empty');
    });

    it('should reject permission name longer than 100 characters', () => {
      const longPermission = 'a'.repeat(101);
      const result = validatePermissionName(longPermission);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permission name must be 100 characters or less');
    });

    it('should reject permission name with invalid characters', () => {
      const result = validatePermissionName('permission@name');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permission name can only contain letters, numbers, underscores, dots, and hyphens');
    });

    it('should accept valid permission name with dots', () => {
      const result = validatePermissionName('user.read');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid permission name with underscores', () => {
      const result = validatePermissionName('user_write');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid permission name with hyphens', () => {
      const result = validatePermissionName('user-delete');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept permission name with mixed valid characters', () => {
      const result = validatePermissionName('user.read_write-delete');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateEndpoint', () => {
    it('should reject empty endpoint', () => {
      const result = validateEndpoint('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Endpoint cannot be empty');
    });

    it('should reject whitespace-only endpoint', () => {
      const result = validateEndpoint('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Endpoint cannot be empty');
    });

    it('should reject endpoint that does not start with /', () => {
      const result = validateEndpoint('api/users');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Endpoint must start with /');
    });

    it('should reject endpoint with invalid characters', () => {
      const result = validateEndpoint('/api/users@123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Endpoint contains invalid characters');
    });

    it('should accept valid endpoint', () => {
      const result = validateEndpoint('/api/users');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept endpoint with path parameters', () => {
      const result = validateEndpoint('/api/users/123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept endpoint with underscores', () => {
      const result = validateEndpoint('/api/user_profiles');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept endpoint with hyphens', () => {
      const result = validateEndpoint('/api/user-profiles');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept root endpoint', () => {
      const result = validateEndpoint('/');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validateRolesList', () => {
    it('should reject empty roles string', () => {
      const result = validateRolesList('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Roles cannot be empty');
    });

    it('should reject whitespace-only roles string', () => {
      const result = validateRolesList('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Roles cannot be empty');
    });

    it('should reject roles string with only commas', () => {
      const result = validateRolesList(',,,');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('At least one role must be provided');
    });

    it('should reject roles string with invalid role', () => {
      const result = validateRolesList('admin,invalid@role');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid role: invalid@role');
    });

    it('should accept single valid role', () => {
      const result = validateRolesList('admin');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept multiple valid roles', () => {
      const result = validateRolesList('admin,user,moderator');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should trim whitespace around roles', () => {
      const result = validateRolesList('  admin  ,  user  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle roles with underscores and hyphens', () => {
      const result = validateRolesList('role_1,role-2');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('validatePermissionsList', () => {
    it('should reject empty permissions string', () => {
      const result = validatePermissionsList('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permissions cannot be empty');
    });

    it('should reject whitespace-only permissions string', () => {
      const result = validatePermissionsList('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Permissions cannot be empty');
    });

    it('should reject permissions string with only commas', () => {
      const result = validatePermissionsList(',,,');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('At least one permission must be provided');
    });

    it('should reject permissions string with invalid permission', () => {
      const result = validatePermissionsList('user.read,invalid@permission');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid permission: invalid@permission');
    });

    it('should accept single valid permission', () => {
      const result = validatePermissionsList('user.read');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept multiple valid permissions', () => {
      const result = validatePermissionsList('user.read,user.write,admin.delete');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should trim whitespace around permissions', () => {
      const result = validatePermissionsList('  user.read  ,  user.write  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should handle permissions with dots, underscores, and hyphens', () => {
      const result = validatePermissionsList('user.read,user_write,user-delete');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
