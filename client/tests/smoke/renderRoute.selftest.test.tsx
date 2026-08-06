// @vitest-environment jsdom
/**
 * Guards the safety net itself.
 *
 * The route smoke tests are only worth having if they fail when a route breaks.
 * These cases assert that `renderRoute` actually rejects the three failure modes
 * a structural refactor produces: a crashed render, a route that collapses to
 * nothing, and a route that logs errors while appearing to work.
 */
import { useParams, useSearchParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { renderRoute } from "./renderRoute";

describe("renderRoute self-test", () => {
  it("fails when the component throws (a broken import looks like this)", async () => {
    const Throws = () => {
      throw new Error("Cannot read properties of undefined (reading 'map')");
    };
    await expect(renderRoute(Throws)).rejects.toThrow(/Cannot read properties/);
  });

  it("fails when the route renders almost nothing", async () => {
    const Empty = () => <div />;
    await expect(renderRoute(Empty)).rejects.toThrow(/almost no text/);
  });

  it("fails when the route logs a console error", async () => {
    const Noisy = () => {
      console.error("TypeError: coach.sports is undefined");
      return <div>{"x".repeat(80)}</div>;
    };
    await expect(renderRoute(Noisy)).rejects.toThrow(/logged console errors/);
  });

  it("passes a healthy route and returns its text", async () => {
    const Healthy = () => <main>A perfectly ordinary page with real copy on it.</main>;
    const { text } = await renderRoute(Healthy);
    expect(text).toContain("perfectly ordinary page");
  });

  it("ignores known React/jsdom noise", async () => {
    const ActWarning = () => {
      console.error(
        "Warning: An update to X inside a test was not wrapped in act(...)",
      );
      return <div>{"y".repeat(80)}</div>;
    };
    await expect(renderRoute(ActWarning)).resolves.toBeTruthy();
  });

  it("exposes routing state to the component under test", async () => {
    const spy = vi.fn();
    const ReadsQuery = () => {
      spy({
        venueId: useSearchParams().get("venueId"),
        coachId: (useParams() as Record<string, string>).coachId,
      });
      return <div>{"z".repeat(80)}</div>;
    };
    await renderRoute(ReadsQuery, {
      query: "venueId=v-42",
      params: { coachId: "c-7" },
    });
    expect(spy).toHaveBeenCalledWith({ venueId: "v-42", coachId: "c-7" });
  });
});
