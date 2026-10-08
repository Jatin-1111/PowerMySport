// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BudgetBar } from "@/modules/planner/components/BudgetBar";
import { CostLine } from "@/modules/planner/components/CostLine";
import { HomeCityPrompt } from "@/modules/planner/components/HomeCityPrompt";
import type { EventCost, SeasonCost } from "@/modules/planner/services/planner";
import { formatInr, formatRange, parseRupees } from "@/modules/planner/utils/money";

/**
 * What is tested here is the wording, because the wording is the honesty. A cost
 * estimate that reads as a quote, a total that quietly leaves out entry fees, or
 * a rough figure presented as the AI's would each pass every logic test and still
 * mislead a parent. So these pin what the page says about where a number came
 * from and what is not in it.
 */

afterEach(cleanup);

const cost = (over: Partial<EventCost> = {}): EventCost => ({
  slug: "cs7-chennai",
  source: "ai",
  assumptions:
    "A child and one parent, economy rail or bus, 5 nights in a budget hotel with meals.",
  travel: { low: 13000, high: 27000, basis: "estimate" },
  stay: { low: 11500, high: 22500, basis: "estimate" },
  entryFee: null,
  entryFeeBasis: null,
  total: { low: 24500, high: 49500 },
  entryFeeMissing: true,
  note: null,
  ...over,
});

const season = (over: Partial<SeasonCost> = {}): SeasonCost => ({
  events: 2,
  withoutFigures: 0,
  total: { low: 30000, high: 60000 },
  budget: null,
  status: "none",
  missingEntryFees: 0,
  ...over,
});

describe("money", () => {
  it("groups digits the Indian way and writes a range in words", () => {
    expect(formatInr(150000)).toBe("₹1,50,000");
    expect(formatRange(14000, 22000)).toBe("₹14,000 to ₹22,000");
    expect(formatRange(8000, 8000)).toBe("₹8,000");
    // This site does not use dashes in copy.
    expect(formatRange(1, 2)).not.toMatch(/[–—-]/);
  });

  it("reads what a person types, and tells empty from wrong", () => {
    expect(parseRupees("8,000")).toBe(8000);
    expect(parseRupees(" 8000 ")).toBe(8000);
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("   ")).toBeNull();
    expect(Number.isNaN(parseRupees("eight thousand"))).toBe(true);
    expect(Number.isNaN(parseRupees("80.5"))).toBe(true);
    expect(Number.isNaN(parseRupees("-5"))).toBe(true);
  });
});

describe("the cost line", () => {
  it("gives a range, calls it an estimate, and says entry fees are not in it", () => {
    render(<CostLine cost={cost()} loading={false} />);

    expect(screen.getByText(/Travel and stay ₹24,500 to ₹49,500/)).toBeTruthy();
    expect(screen.getByText(/\(estimate, entry fee not included\)/)).toBeTruthy();
  });

  it("calls a figure from the rough table a rough estimate, never the AI's", () => {
    render(<CostLine cost={cost({ source: "rough" })} loading={false} />);

    expect(screen.getByText(/rough estimate/)).toBeTruthy();
  });

  it("says when the parent's own figures are in it, and includes their entry fee", () => {
    render(
      <CostLine
        cost={cost({
          travel: { low: 8000, high: 8000, basis: "yours" },
          stay: { low: 9000, high: 9000, basis: "yours" },
          entryFee: 1500,
          entryFeeBasis: "yours",
          entryFeeMissing: false,
          total: { low: 18500, high: 18500 },
        })}
        loading={false}
      />
    );

    expect(screen.getByText(/Travel and stay ₹18,500/)).toBeTruthy();
    expect(screen.getByText(/your figures, includes your entry fee of ₹1,500/)).toBeTruthy();
  });

  it("says when the entry fee is AITA's own, and not the parent's", () => {
    render(
      <CostLine
        cost={cost({
          entryFee: 600,
          entryFeeBasis: "fact-sheet",
          entryFeeMissing: false,
          total: { low: 25100, high: 50100 },
        })}
        loading={false}
      />
    );

    expect(screen.getByText(/includes the ₹600 AITA entry fee/)).toBeTruthy();
    expect(screen.queryByText(/your entry fee/)).toBeNull();
  });

  it("says when the entry fee is the rules' figure because the event's page could not be read", () => {
    render(
      <CostLine
        cost={cost({
          entryFee: 600,
          entryFeeBasis: "rules",
          entryFeeMissing: false,
          total: { low: 25100, high: 50100 },
        })}
        loading={false}
      />
    );

    expect(screen.getByText(/includes the ₹600 entry fee from AITA's rules/)).toBeTruthy();
  });

  it("says when only part of it is theirs", () => {
    render(
      <CostLine
        cost={cost({ travel: { low: 8000, high: 8000, basis: "yours" } })}
        loading={false}
      />
    );

    expect(screen.getByText(/estimate and your figures/)).toBeTruthy();
  });

  it("explains what each part assumes, and that these are not quotes", () => {
    render(<CostLine cost={cost()} loading={false} />);

    expect(screen.queryByText(/economy rail or bus/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /How this is worked out/ }));

    expect(screen.getByText(/economy rail or bus/)).toBeTruthy();
    expect(screen.getByText(/estimates, not quotes/)).toBeTruthy();
    expect(screen.getByText(/Not estimated, check the fact sheet/)).toBeTruthy();
  });

  it("gives the reason, not a blank, when there is no total", () => {
    render(
      <CostLine
        cost={cost({
          total: null,
          travel: null,
          stay: null,
          note: "Add your city to estimate travel and stay.",
        })}
        loading={false}
      />
    );

    expect(screen.getByText(/Add your city to estimate travel and stay/)).toBeTruthy();
  });

  it("says it is working while the first estimate is on its way", () => {
    render(<CostLine cost={undefined} loading />);
    expect(screen.getByText(/Estimating travel and stay/)).toBeTruthy();
  });

  it("offers editing only where figures can be saved", () => {
    const { rerender } = render(<CostLine cost={cost()} loading={false} />);
    expect(screen.queryByRole("button", { name: /my figures/ })).toBeNull();

    rerender(<CostLine cost={cost()} loading={false} onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Add or edit my figures/ })).toBeTruthy();
  });

  it("saves a typed figure as whole rupees, and sends null for a box left empty", () => {
    const onSave = vi.fn();
    render(<CostLine cost={cost()} loading={false} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /Add or edit my figures/ }));
    fireEvent.change(screen.getByLabelText("Travel"), { target: { value: "8,000" } });
    fireEvent.change(screen.getByLabelText("Entry fee"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save figures" }));

    // An empty box is a clear: the estimate for that part comes back.
    expect(onSave).toHaveBeenCalledWith({ travel: 8000, stay: null, entryFee: 1500 });
  });

  it("will not save something that is not an amount", () => {
    const onSave = vi.fn();
    render(<CostLine cost={cost()} loading={false} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /Add or edit my figures/ }));
    fireEvent.change(screen.getByLabelText("Travel"), { target: { value: "lots" } });

    expect(
      (screen.getByRole("button", { name: "Save figures" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/whole rupees/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("starts the form from the parent's own figures, not from ours", () => {
    render(<CostLine cost={cost()} loading={false} yours={{ travel: 8000 }} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Add or edit my figures/ }));

    expect((screen.getByLabelText("Travel") as HTMLInputElement).value).toBe("8000");
    expect((screen.getByLabelText("Stay and meals") as HTMLInputElement).value).toBe("");
  });
});

describe("the budget bar", () => {
  it("says when the plan is within the budget", () => {
    render(<BudgetBar season={season({ budget: 80000, status: "within" })} />);
    expect(screen.getByText(/within your budget, even at the top of the range/)).toBeTruthy();
  });

  it("says when the plan may go over, with the figure it could reach", () => {
    render(<BudgetBar season={season({ budget: 45000, status: "may-exceed" })} />);
    expect(screen.getByText(/could reach ₹60,000 against ₹45,000/)).toBeTruthy();
  });

  it("says when the plan is over even at the low end", () => {
    render(<BudgetBar season={season({ budget: 20000, status: "over" })} />);
    expect(screen.getByText(/over your budget even at the low end/)).toBeTruthy();
  });

  it("points to the preference when no budget is set, and draws no bar", () => {
    render(<BudgetBar season={season()} />);
    expect(screen.getByText(/Set a season budget in your season setup/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("gives the bar a text alternative carrying the same facts", () => {
    render(<BudgetBar season={season({ budget: 45000, status: "may-exceed" })} />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Estimated ₹30,000 to ₹60,000 against a budget of ₹45,000"
    );
  });

  it("never lets a total pass for the whole cost: it says what is left out", () => {
    render(<BudgetBar season={season({ missingEntryFees: 2, withoutFigures: 1 })} />);

    expect(screen.getByText(/Entry fees are not included for 2 events/)).toBeTruthy();
    expect(screen.getByText(/has not published a fee/)).toBeTruthy();
    expect(screen.getByText(/1 event has no travel and stay figure yet/)).toBeTruthy();
  });

  it("has no total to show for an empty plan, and says so plainly", () => {
    render(<BudgetBar season={season({ events: 0, total: null })} />);
    expect(screen.getByText(/Add events to the plan to see what the season may cost/)).toBeTruthy();
  });
});

describe("the home city prompt", () => {
  const state = { kind: "state", state: "Haryana", label: "Haryana" } as const;
  const city = { kind: "city", city: "Pune", label: "Pune" } as const;
  const none = { kind: "none", label: null } as const;

  it("says where estimates start from when it is only a state, and offers a city", () => {
    render(<HomeCityPrompt origin={state} saving={false} onSave={vi.fn()} />);

    expect(screen.getByText(/start from Haryana, the state on the ranking list/)).toBeTruthy();
    expect(screen.getByLabelText("Your city")).toBeTruthy();
  });

  it("asks for a city when there is nothing to start from", () => {
    render(<HomeCityPrompt origin={none} saving={false} onSave={vi.fn()} />);
    expect(screen.getByText(/Add your city to estimate travel and stay/)).toBeTruthy();
  });

  it("is a quiet line, with a way to change it, once there is a city", () => {
    render(<HomeCityPrompt origin={city} saving={false} onSave={vi.fn()} />);

    expect(screen.getByText(/Travel estimates start from Pune/)).toBeTruthy();
    expect(screen.queryByLabelText("Your city")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByLabelText("Your city")).toBeTruthy();
  });

  it("says what happens to the city where it is asked for", () => {
    render(<HomeCityPrompt origin={none} saving={false} onSave={vi.fn()} />);

    const note = screen.getByText(/Saved to your profile/);
    expect(note.textContent).toMatch(/shared with our AI model/);
    expect(note.textContent).toMatch(/do not ask for an address/);
  });

  it("saves the city, trimmed", () => {
    const onSave = vi.fn();
    render(<HomeCityPrompt origin={none} saving={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Your city"), { target: { value: "  Navi Mumbai " } });
    fireEvent.click(screen.getByRole("button", { name: "Save city" }));

    expect(onSave).toHaveBeenCalledWith("Navi Mumbai");
  });

  it("will not save a city that is too short to be one", () => {
    const onSave = vi.fn();
    render(<HomeCityPrompt origin={none} saving={false} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Your city"), { target: { value: "P" } });

    expect((screen.getByRole("button", { name: "Save city" }) as HTMLButtonElement).disabled).toBe(
      true
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
