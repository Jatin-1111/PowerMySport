import { UserRole } from "@/types";

const dashboardByRole: Record<UserRole, string> = {
  Player: "/dashboard",
  VenueLister: "/venue-lister/inventory",
  Coach: "/coach/profile",
  Academy: "/academy",
  Admin: "/admin/users",
  Parent: "/dashboard",
};

export const getDashboardPathByRole = (role?: UserRole | null): string => {
  if (!role) {
    return dashboardByRole.Player;
  }

  return dashboardByRole[role] || dashboardByRole.Player;
};
