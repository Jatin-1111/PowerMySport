import type { ReactNode } from "react";

import DashboardLayoutShell from "../dashboard/LayoutShell";

/**
 * Classes live outside /dashboard because a class is not a booking, but the page
 * is still part of the parent's console, so it keeps the same sidebar, guard and
 * bottom navigation instead of rendering as a bare page.
 */
export default function MyClassesLayout({ children }: { children: ReactNode }) {
  return <DashboardLayoutShell>{children}</DashboardLayoutShell>;
}
