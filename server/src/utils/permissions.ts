import { ADMIN_ROLES } from "../constants/adminPermissions";

/**
 * Permission Hierarchy Map
 * Defines which permissions imply others (e.g., manage implies view)
 */
const PERMISSION_HIERARCHY: Record<string, string[]> = {
  // Users Module
  "users:delete": ["users:manage", "users:view"],
  "users:manage": ["users:view"],

  // Venues Module
  "venues:delete": ["venues:manage", "venues:view"],
  "venues:manage": ["venues:view"],
  "venues:approve": ["venues:view"],

  // Bookings Module
  "bookings:refund": ["bookings:manage", "bookings:view"],
  "bookings:cancel": ["bookings:manage", "bookings:view"],
  "bookings:manage": ["bookings:view"],

  // Coaches Module
  "coaches:delete": ["coaches:manage", "coaches:view"],
  "coaches:manage": ["coaches:view"],
  "coaches:verify": ["coaches:view"],

  // Inquiries Module
  "inquiries:delete": ["inquiries:manage", "inquiries:view"],
  "inquiries:manage": ["inquiries:view"],

  // Disputes Module
  "disputes:resolve": ["disputes:manage", "disputes:view"],
  "disputes:manage": ["disputes:view"],

  // Analytics Module
  "analytics:export": ["analytics:view"],

  // Admins Module
  "admins:delete": ["admins:manage", "admins:view"],
  "admins:manage": ["admins:view"],

  // Settings Module
  "settings:manage": ["settings:view"],

  // Reviews Module
  "reviews:delete": ["reviews:manage", "reviews:view"],
  "reviews:manage": ["reviews:view"],
};

/**
 * Get all implied permissions for a given permission
 * E.g., "users:manage" implies ["users:view"]
 */
export const getImpliedPermissions = (permission: string): string[] => {
  return PERMISSION_HIERARCHY[permission] || [];
};

/**
 * Expand a permission list to include all implied permissions
 */
export const expandPermissions = (permissions: string[]): string[] => {
  const expanded = new Set<string>(permissions);

  for (const permission of permissions) {
    const implied = getImpliedPermissions(permission);
    implied.forEach((p) => expanded.add(p));
  }

  return Array.from(expanded);
};

/**
 * Check if a permission matches a pattern (supports wildcards)
 * E.g., "venues:*" matches "venues:view", "venues:manage", etc.
 */
export const matchesPermissionPattern = (
  permission: string,
  pattern: string,
): boolean => {
  // Exact match
  if (permission === pattern) return true;

  // Wildcard match (e.g., "venues:*" matches "venues:view")
  if (pattern.endsWith(":*")) {
    const module = pattern.split(":")[0];
    return permission.startsWith(`${module}:`);
  }

  return false;
};

/**
 * Check if an admin has a specific permission
 * Supports:
 * - Direct permission check
 * - Wildcard patterns (e.g., "venues:*")
 * - Hierarchical implications (manage implies view)
 * - System Admin bypass
 */
export const hasPermission = (
  adminPermissions: string[],
  adminRole: string,
  requiredPermission: string,
): boolean => {
  // System Admins have all permissions
  if (adminRole === ADMIN_ROLES.SYSTEM_ADMIN) {
    return true;
  }

  // Expand admin permissions to include implied ones
  const expandedPermissions = expandPermissions(adminPermissions);

  // Check for direct match or pattern match
  return expandedPermissions.some(
    (perm) =>
      perm === requiredPermission ||
      matchesPermissionPattern(requiredPermission, perm),
  );
};

/**
 * Check if an admin has at least one of the required permissions
 */
export const hasAnyPermission = (
  adminPermissions: string[],
  adminRole: string,
  requiredPermissions: string[],
): boolean => {
  // System Admins have all permissions
  if (adminRole === ADMIN_ROLES.SYSTEM_ADMIN) {
    return true;
  }

  return requiredPermissions.some((required) =>
    hasPermission(adminPermissions, adminRole, required),
  );
};

/**
 * Check if an admin has all of the required permissions
 */
export const hasAllPermissions = (
  adminPermissions: string[],
  adminRole: string,
  requiredPermissions: string[],
): boolean => {
  // System Admins have all permissions
  if (adminRole === ADMIN_ROLES.SYSTEM_ADMIN) {
    return true;
  }

  return requiredPermissions.every((required) =>
    hasPermission(adminPermissions, adminRole, required),
  );
};

/**
 * Validate if a list of permissions are all valid
 */
export const areValidPermissions = (
  permissions: string[],
  validPermissions: readonly string[],
): boolean => {
  return permissions.every((perm) => validPermissions.includes(perm));
};

/**
 * Deduplicate and normalize permission list
 */
export const normalizePermissions = (permissions: string[]): string[] => {
  return Array.from(new Set(permissions)).sort();
};

/**
 * Get permission module from permission string
 * E.g., "users:view" -> "users"
 */
export const getPermissionModule = (permission: string): string => {
  return permission.split(":")[0] || "";
};

/**
 * Get permission action from permission string
 * E.g., "users:view" -> "view"
 */
export const getPermissionAction = (permission: string): string => {
  return permission.split(":")[1] || "";
};

/**
 * Group permissions by module
 */
export const groupPermissionsByModule = (
  permissions: string[],
): Record<string, string[]> => {
  return permissions.reduce(
    (groups, permission) => {
      const module = getPermissionModule(permission);
      if (!groups[module]) {
        groups[module] = [];
      }
      groups[module].push(permission);
      return groups;
    },
    {} as Record<string, string[]>,
  );
};
