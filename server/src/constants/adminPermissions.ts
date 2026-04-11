// ============================================
// PERMISSION DEFINITIONS (module:action pattern)
// ============================================

// Users Module
export const USERS_PERMISSIONS = {
  VIEW: "users:view",
  MANAGE: "users:manage",
  DELETE: "users:delete",
} as const;

// Venues Module
export const VENUES_PERMISSIONS = {
  VIEW: "venues:view",
  MANAGE: "venues:manage",
  DELETE: "venues:delete",
  APPROVE: "venues:approve",
} as const;

// Bookings Module
export const BOOKINGS_PERMISSIONS = {
  VIEW: "bookings:view",
  MANAGE: "bookings:manage",
  CANCEL: "bookings:cancel",
  REFUND: "bookings:refund",
} as const;

// Coaches Module
export const COACHES_PERMISSIONS = {
  VIEW: "coaches:view",
  MANAGE: "coaches:manage",
  VERIFY: "coaches:verify",
  DELETE: "coaches:delete",
} as const;

// Inquiries Module
export const INQUIRIES_PERMISSIONS = {
  VIEW: "inquiries:view",
  MANAGE: "inquiries:manage",
  DELETE: "inquiries:delete",
} as const;

// Disputes & Refunds Module
export const DISPUTES_PERMISSIONS = {
  VIEW: "disputes:view",
  MANAGE: "disputes:manage",
  RESOLVE: "disputes:resolve",
} as const;

// Analytics Module
export const ANALYTICS_PERMISSIONS = {
  VIEW: "analytics:view",
  EXPORT: "analytics:export",
} as const;

// Admins Module
export const ADMINS_PERMISSIONS = {
  VIEW: "admins:view",
  MANAGE: "admins:manage",
  DELETE: "admins:delete",
} as const;

// Settings Module
export const SETTINGS_PERMISSIONS = {
  VIEW: "settings:view",
  MANAGE: "settings:manage",
} as const;

// Reviews Module
export const REVIEWS_PERMISSIONS = {
  VIEW: "reviews:view",
  MANAGE: "reviews:manage",
  DELETE: "reviews:delete",
} as const;

// Flatten all permissions into a single array for validation
export const ALL_PERMISSIONS = [
  ...Object.values(USERS_PERMISSIONS),
  ...Object.values(VENUES_PERMISSIONS),
  ...Object.values(BOOKINGS_PERMISSIONS),
  ...Object.values(COACHES_PERMISSIONS),
  ...Object.values(INQUIRIES_PERMISSIONS),
  ...Object.values(DISPUTES_PERMISSIONS),
  ...Object.values(ANALYTICS_PERMISSIONS),
  ...Object.values(ADMINS_PERMISSIONS),
  ...Object.values(SETTINGS_PERMISSIONS),
  ...Object.values(REVIEWS_PERMISSIONS),
] as const;

// ============================================
// ROLE TEMPLATES
// ============================================

// Support Admin - Handles user inquiries and basic support
export const SUPPORT_ADMIN_PERMISSIONS = [
  INQUIRIES_PERMISSIONS.VIEW,
  INQUIRIES_PERMISSIONS.MANAGE,
  USERS_PERMISSIONS.VIEW,
  VENUES_PERMISSIONS.VIEW,
  BOOKINGS_PERMISSIONS.VIEW,
  REVIEWS_PERMISSIONS.VIEW,
  REVIEWS_PERMISSIONS.MANAGE,
] as const;

// Operations Admin - Manages venues, bookings, and coaches
export const OPERATIONS_ADMIN_PERMISSIONS = [
  VENUES_PERMISSIONS.VIEW,
  VENUES_PERMISSIONS.MANAGE,
  VENUES_PERMISSIONS.APPROVE,
  BOOKINGS_PERMISSIONS.VIEW,
  BOOKINGS_PERMISSIONS.MANAGE,
  BOOKINGS_PERMISSIONS.CANCEL,
  COACHES_PERMISSIONS.VIEW,
  COACHES_PERMISSIONS.MANAGE,
  COACHES_PERMISSIONS.VERIFY,
  USERS_PERMISSIONS.VIEW,
  INQUIRIES_PERMISSIONS.VIEW,
  REVIEWS_PERMISSIONS.VIEW,
] as const;

// Finance Admin - Handles refunds, disputes, and financial matters
export const FINANCE_ADMIN_PERMISSIONS = [
  BOOKINGS_PERMISSIONS.VIEW,
  BOOKINGS_PERMISSIONS.REFUND,
  DISPUTES_PERMISSIONS.VIEW,
  DISPUTES_PERMISSIONS.MANAGE,
  DISPUTES_PERMISSIONS.RESOLVE,
  USERS_PERMISSIONS.VIEW,
  VENUES_PERMISSIONS.VIEW,
  ANALYTICS_PERMISSIONS.VIEW,
] as const;

// Analytics Admin - View-only access to reports and analytics
export const ANALYTICS_ADMIN_PERMISSIONS = [
  ANALYTICS_PERMISSIONS.VIEW,
  ANALYTICS_PERMISSIONS.EXPORT,
  USERS_PERMISSIONS.VIEW,
  VENUES_PERMISSIONS.VIEW,
  BOOKINGS_PERMISSIONS.VIEW,
  COACHES_PERMISSIONS.VIEW,
  REVIEWS_PERMISSIONS.VIEW,
] as const;

// System Admin - Full permissions, manages other admins
export const SYSTEM_ADMIN_PERMISSIONS = [...ALL_PERMISSIONS] as const;

// ============================================
// ROLE TEMPLATE METADATA
// ============================================

export const ADMIN_ROLES = {
  SUPPORT_ADMIN: "SUPPORT_ADMIN",
  OPERATIONS_ADMIN: "OPERATIONS_ADMIN",
  FINANCE_ADMIN: "FINANCE_ADMIN",
  ANALYTICS_ADMIN: "ANALYTICS_ADMIN",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
} as const;

export interface RoleTemplate {
  role: string;
  name: string;
  description: string;
  permissions: readonly string[];
}

export const ROLE_TEMPLATES: Record<string, RoleTemplate> = {
  [ADMIN_ROLES.SUPPORT_ADMIN]: {
    role: ADMIN_ROLES.SUPPORT_ADMIN,
    name: "Support Admin",
    description: "Handles user inquiries, reviews, and basic support tasks",
    permissions: SUPPORT_ADMIN_PERMISSIONS,
  },
  [ADMIN_ROLES.OPERATIONS_ADMIN]: {
    role: ADMIN_ROLES.OPERATIONS_ADMIN,
    name: "Operations Admin",
    description: "Manages venues, bookings, and coach verifications",
    permissions: OPERATIONS_ADMIN_PERMISSIONS,
  },
  [ADMIN_ROLES.FINANCE_ADMIN]: {
    role: ADMIN_ROLES.FINANCE_ADMIN,
    name: "Finance Admin",
    description: "Handles refunds, disputes, and financial operations",
    permissions: FINANCE_ADMIN_PERMISSIONS,
  },
  [ADMIN_ROLES.ANALYTICS_ADMIN]: {
    role: ADMIN_ROLES.ANALYTICS_ADMIN,
    name: "Analytics Admin",
    description: "View-only access to analytics and reports",
    permissions: ANALYTICS_ADMIN_PERMISSIONS,
  },
  [ADMIN_ROLES.SYSTEM_ADMIN]: {
    role: ADMIN_ROLES.SYSTEM_ADMIN,
    name: "System Admin",
    description: "Full system access and admin management",
    permissions: SYSTEM_ADMIN_PERMISSIONS,
  },
};

// Helper to get role template permissions
export const getRolePermissions = (role: string): readonly string[] => {
  return ROLE_TEMPLATES[role]?.permissions || [];
};

// Permission module groupings for UI display
export const PERMISSION_MODULES = {
  users: {
    name: "User Management",
    permissions: Object.values(USERS_PERMISSIONS),
  },
  venues: {
    name: "Venue Management",
    permissions: Object.values(VENUES_PERMISSIONS),
  },
  bookings: {
    name: "Booking Management",
    permissions: Object.values(BOOKINGS_PERMISSIONS),
  },
  coaches: {
    name: "Coach Management",
    permissions: Object.values(COACHES_PERMISSIONS),
  },
  inquiries: {
    name: "Inquiry Management",
    permissions: Object.values(INQUIRIES_PERMISSIONS),
  },
  disputes: {
    name: "Dispute & Refund Management",
    permissions: Object.values(DISPUTES_PERMISSIONS),
  },
  analytics: {
    name: "Analytics & Reports",
    permissions: Object.values(ANALYTICS_PERMISSIONS),
  },
  admins: {
    name: "Admin Management",
    permissions: Object.values(ADMINS_PERMISSIONS),
  },
  settings: {
    name: "System Settings",
    permissions: Object.values(SETTINGS_PERMISSIONS),
  },
  reviews: {
    name: "Review Management",
    permissions: Object.values(REVIEWS_PERMISSIONS),
  },
} as const;

// Permission labels for display
export const PERMISSION_LABELS: Record<string, string> = {
  // Users
  "users:view": "View Users",
  "users:manage": "Manage Users",
  "users:delete": "Delete Users",

  // Venues
  "venues:view": "View Venues",
  "venues:manage": "Manage Venues",
  "venues:delete": "Delete Venues",
  "venues:approve": "Approve Venues",

  // Bookings
  "bookings:view": "View Bookings",
  "bookings:manage": "Manage Bookings",
  "bookings:cancel": "Cancel Bookings",
  "bookings:refund": "Process Refunds",

  // Coaches
  "coaches:view": "View Coaches",
  "coaches:manage": "Manage Coaches",
  "coaches:verify": "Verify Coaches",
  "coaches:delete": "Delete Coaches",

  // Inquiries
  "inquiries:view": "View Inquiries",
  "inquiries:manage": "Manage Inquiries",
  "inquiries:delete": "Delete Inquiries",

  // Disputes
  "disputes:view": "View Disputes",
  "disputes:manage": "Manage Disputes",
  "disputes:resolve": "Resolve Disputes",

  // Analytics
  "analytics:view": "View Analytics",
  "analytics:export": "Export Reports",

  // Admins
  "admins:view": "View Admins",
  "admins:manage": "Manage Admins",
  "admins:delete": "Delete Admins",

  // Settings
  "settings:view": "View Settings",
  "settings:manage": "Manage Settings",

  // Reviews
  "reviews:view": "View Reviews",
  "reviews:manage": "Manage Reviews",
  "reviews:delete": "Delete Reviews",
};

// Legacy support (for backward compatibility during migration)
export const ADMIN_BASE_PERMISSIONS = SUPPORT_ADMIN_PERMISSIONS;
// Legacy alias - deprecated
export const SUPER_ADMIN_PERMISSIONS = SYSTEM_ADMIN_PERMISSIONS;
