/**
 * Input validation utilities
 */

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the input is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
}

/**
 * Validate role name input
 * 
 * @param role - Role name to validate
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const validation = validateRoleName(role);
 * if (!validation.valid) {
 *   toast.error(validation.error);
 * }
 * ```
 */
export function validateRoleName(role: string): ValidationResult {
  if (!role || role.trim().length === 0) {
    return { valid: false, error: 'Role name cannot be empty' };
  }
  if (role.length > 100) {
    return { valid: false, error: 'Role name must be 100 characters or less' };
  }
  // Check for invalid characters
  if (!/^[a-zA-Z0-9_-]+$/.test(role.trim())) {
    return { valid: false, error: 'Role name can only contain letters, numbers, underscores, and hyphens' };
  }
  return { valid: true };
}

/**
 * Validate permission name input
 * 
 * @param permission - Permission name to validate
 * @returns Validation result
 */
export function validatePermissionName(permission: string): ValidationResult {
  if (!permission || permission.trim().length === 0) {
    return { valid: false, error: 'Permission name cannot be empty' };
  }
  if (permission.length > 100) {
    return { valid: false, error: 'Permission name must be 100 characters or less' };
  }
  // Check for invalid characters
  if (!/^[a-zA-Z0-9_.-]+$/.test(permission.trim())) {
    return { valid: false, error: 'Permission name can only contain letters, numbers, underscores, dots, and hyphens' };
  }
  return { valid: true };
}

/**
 * Validate endpoint URL
 * 
 * @param endpoint - Endpoint path to validate
 * @returns Validation result
 * 
 * @example
 * ```typescript
 * const validation = validateEndpoint(endpoint);
 * if (!validation.valid) {
 *   toast.error(validation.error);
 *   return;
 * }
 * ```
 */
export function validateEndpoint(endpoint: string): ValidationResult {
  if (!endpoint || endpoint.trim().length === 0) {
    return { valid: false, error: 'Endpoint cannot be empty' };
  }
  if (!endpoint.startsWith('/')) {
    return { valid: false, error: 'Endpoint must start with /' };
  }
  // Basic path validation
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(endpoint)) {
    return { valid: false, error: 'Endpoint contains invalid characters' };
  }
  return { valid: true };
}

/**
 * Validate comma-separated list of roles
 * 
 * @param rolesString - Comma-separated roles string
 * @returns Validation result
 */
export function validateRolesList(rolesString: string): ValidationResult {
  if (!rolesString || rolesString.trim().length === 0) {
    return { valid: false, error: 'Roles cannot be empty' };
  }
  const roles = rolesString.split(',').map(r => r.trim()).filter(Boolean);
  if (roles.length === 0) {
    return { valid: false, error: 'At least one role must be provided' };
  }
  // Validate each role
  for (const role of roles) {
    const roleValidation = validateRoleName(role);
    if (!roleValidation.valid) {
      return { valid: false, error: `Invalid role: ${role}. ${roleValidation.error}` };
    }
  }
  return { valid: true };
}

/**
 * Validate comma-separated list of permissions
 * 
 * @param permissionsString - Comma-separated permissions string
 * @returns Validation result
 */
export function validatePermissionsList(permissionsString: string): ValidationResult {
  if (!permissionsString || permissionsString.trim().length === 0) {
    return { valid: false, error: 'Permissions cannot be empty' };
  }
  const permissions = permissionsString.split(',').map(p => p.trim()).filter(Boolean);
  if (permissions.length === 0) {
    return { valid: false, error: 'At least one permission must be provided' };
  }
  // Validate each permission
  for (const permission of permissions) {
    const permissionValidation = validatePermissionName(permission);
    if (!permissionValidation.valid) {
      return { valid: false, error: `Invalid permission: ${permission}. ${permissionValidation.error}` };
    }
  }
  return { valid: true };
}
