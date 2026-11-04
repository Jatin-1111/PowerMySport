import { describe, expect, it } from "vitest";
import {
  DASHBOARD_SECTIONS,
  type DashboardSectionId,
} from "../src/modules/player/config/dashboardSections";

/**
 * Pins the dashboard's per-audience section lists.
 *
 * `PlayerDashboard` renders by looking each id up in a registry, which means a
 * typo'd or removed id fails as `undefined` at render — a blank section on a
 * live page rather than a build error. These assertions turn that into a test
 * failure instead.
 *
 * The registry itself is deliberately not imported here: doing so pulls the
 * whole widget tree (and its data layer) into a config test. The registry keys
 * are typed as `Record<DashboardSectionId, ...>`, so TypeScript already
 * guarantees it covers every id in this union — what it cannot check is that
 * the *lists* only contain ids from that union, which is what this file does.
 */

const KNOWN: DashboardSectionId[] = [
  "actions",
  "family",
  "self",
  "journey",
  "friends",
  "community",
  "quickActions",
];

describe("dashboard sections", () => {
  it("lists only known section ids", () => {
    for (const [audience, sections] of Object.entries(DASHBOARD_SECTIONS)) {
      for (const id of sections) {
        expect(KNOWN, `${audience} references unknown section "${id}"`).toContain(id);
      }
    }
  });

  it("never repeats a section within an audience", () => {
    for (const [audience, sections] of Object.entries(DASHBOARD_SECTIONS)) {
      expect(new Set(sections).size, `${audience} repeats a section`).toBe(sections.length);
    }
  });

  /**
   * The roster and the self card occupy the same slot and answer the same
   * question for different audiences. Showing both would ask a parent to read
   * their own profile twice; showing neither would leave the page with no
   * subject at all.
   */
  it("gives every audience exactly one profile subject", () => {
    for (const [audience, sections] of Object.entries(DASHBOARD_SECTIONS)) {
      const subjects = sections.filter((id) => id === "family" || id === "self");
      expect(subjects, `${audience} must have exactly one of family/self`).toHaveLength(1);
    }
  });

  it("puts the action centre first, so what needs the user is never below a card", () => {
    for (const [audience, sections] of Object.entries(DASHBOARD_SECTIONS)) {
      expect(sections[0], `${audience} should lead with actions`).toBe("actions");
    }
  });

  it("shows a parent their children", () => {
    expect(DASHBOARD_SECTIONS.parent).toContain("family");
    expect(DASHBOARD_SECTIONS.player).not.toContain("family");
  });
});
