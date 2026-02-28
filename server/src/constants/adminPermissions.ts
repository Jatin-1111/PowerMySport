export const ADMIN_BASE_PERMISSIONS = [
  "manage_inquiries",
  "view_users",
  "view_venues",
  "view_bookings",
] as const;

export const SUPER_ADMIN_PERMISSIONS = [
  ...ADMIN_BASE_PERMISSIONS,
  "manage_admins",
  "manage_coach_verification",
  "manage_refunds_disputes",
  "view_analytics",
  "manage_settings",
  "all_permissions",
] as const;
