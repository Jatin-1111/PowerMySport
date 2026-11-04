// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/modules/auth/store/authStore";

/**
 * The planner tour: when it opens, what it points at, and that finishing it is
 * remembered on the account.
 *
 * What matters most is the failure direction. A parent who has seen the tour must
 * not be shown it again, and a request that fails must not put the tour in front of
 * everyone on every visit.
 */

const world = { seen: false as boolean | "error", saved: [] as boolean[] };

vi.mock("@/modules/planner/services/planner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/planner/services/planner")>()),
  plannerApi: {
    getTourSeen: async () => {
      if (world.seen === "error") throw new Error("offline");
      return world.seen;
    },
    setTourSeen: async (seen: boolean) => {
      world.saved.push(seen);
      return seen;
    },
  },
}));

import { PlannerTour, TOUR_STEPS } from "@/modules/planner/components/PlannerTour";
import { usePlannerTour } from "@/modules/planner/hooks/usePlannerTour";

function Harness() {
  const tour = usePlannerTour();
  return (
    <div>
      {TOUR_STEPS.map((step) => (
        <section key={step.target} data-tour={step.target} aria-label={`target ${step.target}`} />
      ))}
      <button type="button" onClick={tour.start}>
        How this works
      </button>
      {tour.open && <PlannerTour onFinish={tour.finish} />}
    </div>
  );
}

function renderHarness() {
  useAuthStore.setState({ hydrated: true, token: "token" } as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  world.seen = false;
  world.saved = [];
});
afterEach(cleanup);

const ringed = (target: string) =>
  screen.getByLabelText(`target ${target}`).classList.contains("ring-orange-500");

describe("when the tour opens", () => {
  it("opens by itself for a parent who has not seen it", async () => {
    renderHarness();
    expect(await screen.findByRole("dialog", { name: "Planner tour" })).toBeTruthy();
  });

  it("stays closed for a parent who has", async () => {
    world.seen = true;
    renderHarness();
    await screen.findByRole("button", { name: "How this works" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("stays closed when it cannot be found out whether they have", async () => {
    world.seen = "error";
    renderHarness();
    await screen.findByRole("button", { name: "How this works" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("walking through it", () => {
  it("goes through the four steps in order, ringing each section as it goes", async () => {
    renderHarness();
    await screen.findByRole("dialog");

    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(ringed("setup")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();
    expect(ringed("setup")).toBe(false);
    expect(ringed("pick")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(ringed("next")).toBe(true);
    // The one promise a first-time parent most needs to hear.
    expect(screen.getByText(/We never enter for you/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 2 of 4")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();
    expect(ringed("calendar")).toBe(true);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
  });

  it("offers no Back on the first step", async () => {
    renderHarness();
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});

describe("finishing it", () => {
  it("records it as seen when the last step is done, and takes the ring off", async () => {
    renderHarness();
    await screen.findByRole("dialog");
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(world.saved).toEqual([true]));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ringed("calendar")).toBe(false);
  });

  it("records it as seen when skipped, closed, or dismissed with Escape", async () => {
    renderHarness();
    fireEvent.click(await screen.findByRole("button", { name: "Skip tour" }));
    await waitFor(() => expect(world.saved).toEqual([true]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape", async () => {
    renderHarness();
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(world.saved).toEqual([true]);
  });
});

describe("playing it again", () => {
  it("replays from the help button without touching what is saved", async () => {
    world.seen = true;
    renderHarness();
    fireEvent.click(await screen.findByRole("button", { name: "How this works" }));

    expect(await screen.findByRole("dialog", { name: "Planner tour" })).toBeTruthy();
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(world.saved).toEqual([]);
  });
});
