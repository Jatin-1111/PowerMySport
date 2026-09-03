import { UserRole } from "@/types";
import { describe, expect, it } from "vitest";
import {
  CONSOLE_POLICIES,
  consoleHomeFor,
  policyForPath,
  postLoginFor,
  postSignupFor,
  resolveAccess,
  settingsHomeFor,
  type SessionState,
} from "./policy";

const ALL_ROLES: UserRole[] = [
  "Player",
  "Parent",
  "VenueLister",
  "Coach",
  "Academy",
  "EXPERT",
  "Admin",
];

const anonymous: SessionState = { status: "anonymous" };
const unknown: SessionState = { status: "unknown" };
const as = (role: UserRole): SessionState => ({
  status: "authenticated",
  role,
});

describe("policyForPath", () => {
  it("matches a console and its descendants", () => {
    expect(policyForPath("/coach")?.prefix).toBe("/coach");
    expect(policyForPath("/coach/earnings")?.prefix).toBe("/coach");
  });

  it("does not match a path that merely shares a prefix string", () => {
    // /coaches/[coachId] is the PUBLIC coach profile a parent books from. If it
    // matched the /coach console policy, browsing a coach would bounce visitors
    // to login.
    expect(policyForPath("/coaches/abc123")).toBeNull();
    expect(policyForPath("/academies/some-slug")).toBeNull();
    expect(policyForPath("/experts")).toBeNull();
    expect(policyForPath("/experts/abc123")).toBeNull();
  });

  it("leaves public routes ungoverned", () => {
    for (const path of ["/", "/booking", "/rankings/tennis", "/shop", "/login"]) {
      expect(policyForPath(path)).toBeNull();
    }
  });
});

describe("resolveAccess — the access matrix", () => {
  it("allows any session on an ungoverned route", () => {
    for (const session of [unknown, anonymous, ...ALL_ROLES.map(as)]) {
      expect(resolveAccess("/booking", session).kind).toBe("allow");
    }
  });

  it("waits rather than acting while the session is unknown", () => {
    // The original bug in reverse: acting on an unresolved session bounces real
    // users mid-hydration.
    for (const policy of CONSOLE_POLICIES) {
      expect(resolveAccess(policy.prefix, unknown).kind).toBe("wait");
    }
  });

  it("sends anonymous visitors to login, preserving the return path", () => {
    // This is the hole that served the full console to signed-out visitors.
    for (const policy of CONSOLE_POLICIES) {
      const decision = resolveAccess(`${policy.prefix}/anything`, anonymous);
      expect(decision).toMatchObject({
        kind: "redirect",
        to: "/login",
        preserveReturnPath: true,
      });
    }
  });

  it("admits exactly the roles each console declares, and no others", () => {
    for (const policy of CONSOLE_POLICIES) {
      for (const role of ALL_ROLES) {
        const decision = resolveAccess(policy.prefix, as(role));
        if (policy.roles.includes(role)) {
          expect(decision.kind, `${role} on ${policy.prefix}`).toBe("allow");
        } else {
          expect(decision.kind, `${role} on ${policy.prefix}`).toBe("redirect");
        }
      }
    }
  });

  it("does not send a wrong-role user to login", () => {
    // They are signed in; bouncing them to a login form is a dead end. They go
    // home, and no return path is preserved.
    const decision = resolveAccess("/venue-lister", as("Coach"));
    expect(decision).toMatchObject({
      kind: "redirect",
      to: "/",
      preserveReturnPath: false,
    });
    if (decision.kind === "redirect") {
      expect(decision.message).toBeTruthy();
    }
  });

  it("keeps declared public paths open to everyone", () => {
    for (const session of [unknown, anonymous, as("Parent"), as("Coach")]) {
      expect(resolveAccess("/academy/onboarding", session).kind).toBe("allow");
      expect(resolveAccess("/academy/onboarding/success/abc", session).kind).toBe("allow");
    }
  });

  it("does not let a public path leak access to its siblings", () => {
    expect(resolveAccess("/academy", anonymous).kind).toBe("redirect");
    expect(resolveAccess("/academy/earnings", anonymous).kind).toBe("redirect");
    // A path that merely starts with the public prefix string must not pass.
    expect(resolveAccess("/academy/onboarding-secrets", anonymous).kind).toBe("redirect");
  });

  it("is total — every console/session pair yields exactly one decision", () => {
    const kinds = new Set<string>();
    for (const policy of CONSOLE_POLICIES) {
      for (const session of [unknown, anonymous, ...ALL_ROLES.map(as)]) {
        kinds.add(resolveAccess(policy.prefix, session).kind);
      }
    }
    expect([...kinds].sort()).toEqual(["allow", "redirect", "wait"]);
  });
});

describe("landing destinations", () => {
  it("gives every role a console home and a settings page", () => {
    for (const role of ALL_ROLES) {
      expect(consoleHomeFor(role)).toMatch(/^\//);
      expect(settingsHomeFor(role)).toMatch(/^\//);
    }
  });

  it("falls back safely for a missing or unrecognised role", () => {
    expect(consoleHomeFor(null)).toMatch(/^\//);
    expect(consoleHomeFor(undefined)).toMatch(/^\//);
    expect(consoleHomeFor("Nonsense" as UserRole)).toMatch(/^\//);
    expect(postLoginFor("Nonsense" as UserRole)).toMatch(/^\//);
    expect(postSignupFor("Nonsense" as UserRole)).toMatch(/^\//);
  });

  it("lands each role somewhere that role is actually allowed", () => {
    // The regression this pins: a landing map that sends a role to a console its
    // own policy rejects, producing the redirect loop the coach shell needed a
    // counter to absorb.
    for (const role of ALL_ROLES) {
      for (const destination of [
        consoleHomeFor(role),
        postLoginFor(role),
        postSignupFor(role),
        settingsHomeFor(role),
      ]) {
        const decision = resolveAccess(destination, as(role));
        expect(decision.kind, `${role} → ${destination}`).not.toBe("redirect");
      }
    }
  });

  it("sends new coaches and experts to setup, not to their console", () => {
    expect(postSignupFor("Coach")).toBe("/coach/verification");
    expect(postSignupFor("EXPERT")).toBe("/expert/onboarding");
    expect(postSignupFor("Parent")).toBe("/assessment");
  });
});
