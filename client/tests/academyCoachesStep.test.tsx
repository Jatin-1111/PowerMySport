// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

// The real picker loads sports from the API; here it is a button per sport.
vi.mock("@/modules/sports/components/SportsMultiSelect", () => ({
  default: ({ value, onChange }: { value: string[]; onChange: (s: string[]) => void }) => (
    <div>
      {["Tennis", "Chess"].map((sport) => (
        <button
          key={sport}
          type="button"
          aria-pressed={value.includes(sport)}
          onClick={() =>
            onChange(value.includes(sport) ? value.filter((s) => s !== sport) : [...value, sport])
          }
        >
          {`Sport ${sport}`}
        </button>
      ))}
    </div>
  ),
}));

import Step5Coaches from "@/modules/onboarding/components/academy/Step5Coaches";

beforeEach(() => toastError.mockReset());

const renderStep = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<Step5Coaches onSubmit={onSubmit} />);
  return onSubmit;
};

const addCoach = () =>
  fireEvent.click(screen.getByRole("button", { name: /Add (a|another) coach/ }));

const fillFirstCoach = () => {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: " Asha " } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Rao" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: " Asha@Example.COM " } });
  fireEvent.click(screen.getByRole("button", { name: "Sport Tennis" }));
};

describe("Step 5 coaches", () => {
  it("is optional: with no coaches the button says Skip, and saving sends an empty list", async () => {
    const onSubmit = renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ academyCoaches: [] }));
  });

  it("tells the owner what is kept and that nobody is contacted", () => {
    renderStep();
    expect(screen.getByText(/only a name, an email and the sports/)).toBeTruthy();
    expect(screen.getByText(/not contacted/)).toBeTruthy();
  });

  it("asks for nothing beyond name, email and sports", () => {
    renderStep();
    addCoach();
    const labels = screen
      .getAllByText(/^(First name|Last name|Email|Sports)$/)
      .map((e) => e.textContent);
    expect(labels).toEqual(["First name", "Last name", "Email", "Sports"]);
    expect(screen.queryByLabelText(/phone/i)).toBeNull();
    expect(screen.queryByLabelText(/bio/i)).toBeNull();
    expect(screen.queryByLabelText(/rate|price/i)).toBeNull();
  });

  it("saves a coach trimmed, with the email in lower case", async () => {
    const onSubmit = renderStep();
    addCoach();
    fillFirstCoach();

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      academyCoaches: [
        { firstName: "Asha", lastName: "Rao", email: "asha@example.com", sports: ["Tennis"] },
      ],
    });
  });

  it("does not save a half-filled coach, and says what is missing", async () => {
    const onSubmit = renderStep();
    addCoach();
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Asha" } });

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("Enter a last name")).toBeTruthy();
    expect(screen.getByText("Enter a valid email")).toBeTruthy();
    expect(screen.getByText("Choose at least one sport")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("ignores a row that was added and left empty", async () => {
    const onSubmit = renderStep();
    addCoach();
    fillFirstCoach();
    addCoach(); // a second row, never filled in

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].academyCoaches).toHaveLength(1);
  });

  it("flags the same email entered twice", async () => {
    const onSubmit = renderStep();
    addCoach();
    fillFirstCoach();
    addCoach();
    const [first, second] = [
      screen.getAllByLabelText("First name")[1]!,
      screen.getAllByLabelText("Last name")[1]!,
    ];
    fireEvent.change(first, { target: { value: "Bina" } });
    fireEvent.change(second, { target: { value: "Shah" } });
    fireEvent.change(screen.getAllByLabelText("Email")[1]!, {
      target: { value: "asha@example.com" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Sport Chess" })[1]!);

    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(await screen.findByText("This email is already in the list")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("removes a coach", () => {
    renderStep();
    addCoach();
    addCoach();
    expect(screen.getAllByText(/^Coach \d$/).length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove coach" })[0]!);
    expect(screen.getAllByText(/^Coach \d$/).length).toBe(1);
  });

  it("restores saved coaches, showing only the four fields", () => {
    render(
      <Step5Coaches
        onSubmit={vi.fn()}
        previousData={{
          academyCoaches: [
            {
              firstName: "Asha",
              lastName: "Rao",
              email: "asha@example.com",
              sports: ["Tennis"],
              // Older records carried more; the form must not show or resend it.
              ...({ phone: "+919876543210", bio: "Old bio" } as object),
            },
          ],
        }}
      />
    );
    expect((screen.getByLabelText("First name") as HTMLInputElement).value).toBe("Asha");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("asha@example.com");
    expect(screen.getByRole("button", { name: "Save and continue" })).toBeTruthy();
  });

  it("does not submit twice while a save is in flight", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderStep(onSubmit);
    addCoach();
    fillFirstCoach();

    const save = screen.getByRole("button", { name: "Save and continue" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolve();
  });

  it("stops adding at the limit", () => {
    render(
      <Step5Coaches
        onSubmit={vi.fn()}
        previousData={{
          academyCoaches: Array.from({ length: 50 }, (_, i) => ({
            firstName: "Coach",
            lastName: `Number${i}`,
            email: `c${i}@example.com`,
            sports: ["Tennis"],
          })),
        }}
      />
    );
    expect(
      (screen.getByRole("button", { name: "Add another coach" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(screen.getByText("You can add up to 50 coaches.")).toBeTruthy();
  });
});
