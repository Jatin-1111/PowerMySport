"use client";

import { notificationsHomeFor } from "@/flow/policy";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { NotificationsView } from "@/modules/notifications/components/NotificationsView";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Notifications live inside each role's console. This route stays for old
 * links, emails and push notifications: it forwards a signed-in user to their
 * console's page (keeping the query, e.g. `?intent=booking`) and shows the list
 * itself only for roles that have no console.
 */
function NotificationsEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((state) => state.user?.role);
  const hydrated = useAuthStore((state) => state.hydrated);
  const target = notificationsHomeFor(role);
  const forwards = target !== "/notifications";

  useEffect(() => {
    if (!hydrated || !forwards) return;
    const query = searchParams.toString();
    router.replace(query ? `${target}?${query}` : target);
  }, [hydrated, forwards, target, searchParams, router]);

  if (!hydrated || forwards) return null;
  return <NotificationsView />;
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={null}>
      <NotificationsEntry />
    </Suspense>
  );
}
