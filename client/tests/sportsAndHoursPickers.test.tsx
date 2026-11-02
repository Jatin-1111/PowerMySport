// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/sports/services/sports", () => ({
  sportsApi: {
    getAllSports: () =>
      Promise.resolve([{ name: "Tennis" }, { name: "Badminton" }, { name: "Squash" }]),
  },
}));

import OpeningHoursInput, {
  getDefaultOpeningHours,
  type OpeningHours,
} from "../src/modules/onboarding/components/onboarding/OpeningHoursInput";
import SportsMultiSelect from "../src/modules/sports/components/SportsMultiSelect";

afterEach(cleanup);

function SportsHarness({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SportsMultiSelect value={value} onChange={setValue} />
      <output data-testid="value">{value.join("|")}</output>
    </>
  );
}

describe("SportsMultiSelect", () => {
  it("shows stored sports that are cased differently from the catalogue", async () => {
    render(<SportsHarness initial={["tennis", "badminton"]} />);
    const chips = await screen.findByRole("list", { name: "Selected sports" });
    expect(within(chips).getByText("Tennis")).toBeTruthy();
    expect(within(chips).getByText("Badminton")).toBeTruthy();
  });

  it("does not add a sport that is already chosen under another casing", async () => {
    render(<SportsHarness initial={["tennis"]} />);
    fireEvent.focus(await screen.findByRole("combobox"));
    const option = await screen.findByRole("button", { name: /^Tennis/ });
    expect((option as HTMLButtonElement).disabled).toBe(true);
  });

  it("adds a catalogue sport and removes a stored one", async () => {
    render(<SportsHarness initial={["tennis"]} />);
    fireEvent.focus(await screen.findByRole("combobox"));
    fireEvent.click(await screen.findByRole("button", { name: "Squash" }));
    expect(screen.getByTestId("value").textContent).toBe("tennis|Squash");

    fireEvent.click(screen.getByRole("button", { name: "Remove Tennis" }));
    expect(screen.getByTestId("value").textContent).toBe("Squash");
  });

  it("gives every control a 44px target", async () => {
    render(<SportsHarness initial={["tennis"]} />);
    const remove = await screen.findByRole("button", { name: "Remove Tennis" });
    expect(remove.className).toContain("h-11");
    expect(remove.className).toContain("w-11");
  });
});

function HoursHarness() {
  const [hours, setHours] = useState<OpeningHours>(getDefaultOpeningHours());
  return (
    <>
      <OpeningHoursInput value={hours} onChange={setHours} />
      <output data-testid="json">{JSON.stringify(hours)}</output>
    </>
  );
}

describe("OpeningHoursInput", () => {
  const hours = () => JSON.parse(screen.getByTestId("json").textContent!) as OpeningHours;

  it("closes a day and says so", () => {
    render(<HoursHarness />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Tuesday" }));
    expect(hours().tuesday.isOpen).toBe(false);
    expect(screen.getByText("Closed")).toBeTruthy();
  });

  it("adds a second slot to a day and can remove it again", () => {
    render(<HoursHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Add another Monday slot" }));
    expect(hours().monday.slots).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Remove Monday slot 2" }));
    expect(hours().monday.slots).toHaveLength(1);
  });

  it("copies Monday's hours to every day", () => {
    render(<HoursHarness />);
    fireEvent.change(screen.getByLabelText("Monday, slot 1 opens"), { target: { value: "06:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy Monday to all days" }));
    expect(hours().sunday.slots?.[0].startTime).toBe("06:00");
  });

  it("labels every time field with its day", () => {
    render(<HoursHarness />);
    expect(screen.getByLabelText("Sunday, slot 1 closes")).toBeTruthy();
  });
});
