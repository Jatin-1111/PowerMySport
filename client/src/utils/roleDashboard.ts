import { UserRole } from "@/types";

const dashboardByRole: Record<UserRole, string> = {
  Player: "/dashboard",
  Parent: "/dashboard",
  VenueLister: "/venue-lister/inventory",
  Coach: "/coach/profile",
  Academy: "/academy",
  EXPERT: "/expert/dashboard",
  Admin: "/admin/users",
};

export const getDashboardPathByRole = (role?: UserRole | null): string => {
  if (!role) {
    return dashboardByRole.Player;
  }

  return dashboardByRole[role] || dashboardByRole.Player;
};
