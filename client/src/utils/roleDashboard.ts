import { UserRole } from "@/types";

const dashboardByRole: Record<UserRole, string> = {
  PLAYER: "/dashboard",
  VENUE_LISTER: "/venue-lister/inventory",
  COACH: "/coach/profile",
  ADMIN: "/admin/users",
};

export const getDashboardPathByRole = (role?: UserRole | null): string => {
  if (!role) {
    return dashboardByRole.PLAYER;
  }

  return dashboardByRole[role] || dashboardByRole.PLAYER;
};
