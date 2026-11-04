"use client";

import {
  currentReturnPath,
  loginUrlFor,
  resolveAccess,
  type AccessDecision,
  type SessionState,
} from "@/flow/policy";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Applies the route policy to the current page.
 *
 * This hook holds no rules of its own — it reads the session, asks
 * `resolveAccess` what to do, and performs the navigation. Each console shell
 * calls it with no arguments; which roles may be there is declared once in
 * `src/flow/policy.ts`, not repeated per shell.
 *
 * The split matters for more than tidiness. The decision is pure and lives in
 * the policy module, so when the session becomes readable on the server the
 * same function backs `src/proxy.ts` unchanged, and this hook is deleted rather
 * than ported.
 *
 * A client-side guard is a UX affordance, not a security boundary: it stops
 * showing protected chrome to people who cannot use it. The server remains the
 * only real enforcement point.
 */

export type RoleGuardStatus = "unknown" | "redirecting" | "allowed";

const statusFor = (decision: AccessDecision): RoleGuardStatus => {
  switch (decision.kind) {
    case "allow":
      return "allowed";
    case "wait":
      return "unknown";
    case "redirect":
      return "redirecting";
  }
};

export const useRoleGuard = (): RoleGuardStatus => {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  const session: SessionState = !hydrated
    ? { status: "unknown" }
    : user
      ? { status: "authenticated", role: user.role }
      : { status: "anonymous" };

  const decision = resolveAccess(pathname, session);

  // `decision` is a fresh object every render, so the effect depends on its
  // fields rather than the object itself.
  const redirectTo = decision.kind === "redirect" ? decision.to : null;
  const redirectMessage = decision.kind === "redirect" ? (decision.message ?? null) : null;
  const preserveReturnPath = decision.kind === "redirect" ? decision.preserveReturnPath : false;

  // Redirecting is a one-shot action. Without this, a re-render between
  // `router.replace` being called and the navigation committing fires it again —
  // the bouncing that `MAX_GATE_REDIRECTS` in the coach shell exists to absorb.
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!redirectTo || hasRedirected.current) return;
    hasRedirected.current = true;

    if (preserveReturnPath) {
      router.replace(loginUrlFor(currentReturnPath(pathname)));
      return;
    }

    if (redirectMessage) toast.error(redirectMessage);
    router.replace(redirectTo);
  }, [redirectTo, redirectMessage, preserveReturnPath, pathname, router]);

  return statusFor(decision);
};
