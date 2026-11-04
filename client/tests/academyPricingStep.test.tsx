// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

import Step6Pricing from "@/modules/onboarding/components/academy/Step6Pricing";

beforeEach(() => toastError.mockReset());

const renderStep = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<Step6Pricing onSubmit={onSubmit} />);
  return onSubmit;
};

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const tick = (name: RegExp) => fireEvent.click(screen.getByRole("checkbox", { name }));

describe("Step 6 pricing", () => {
  it("does not save an empty form, and says what is missing", async () => {
    const onSubmit = renderStep();
    save();
    expect(await screen.findByText("Rate must be at least ₹1 per hour")).toBeTruthy();
    expect(screen.getByText("Choose when your batches run")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("saves the rate in paise, with the batch and the limit", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    type("Largest batch (students)", "12");

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      sessionRatePerHour: 60000,
      batchTimings: ["morning"],
      maxBatchSize: 12,
      trialsessionOffered: false,
    });
  });

  it("accepts an amount typed the way people type it", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "₹1,500");
    tick(/Evening \(/);
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].sessionRatePerHour).toBe(150000);
  });

  it("saves morning plus evening as both", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    tick(/Evening \(/);
    expect((screen.getByRole("checkbox", { name: /Morning \(/ }) as HTMLInputElement).checked).toBe(
      true
    );
    expect((screen.getByRole("checkbox", { name: /Evening \(/ }) as HTMLInputElement).checked).toBe(
      true
    );

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].batchTimings).toEqual(["both"]);
  });

  it("unticking one of the two leaves the other", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    tick(/Evening \(/);
    tick(/Morning \(/);
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].batchTimings).toEqual(["evening"]);
  });

  it("holds the batch size to a whole number from 1 to 100", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);

    type("Largest batch (students)", "0");
    save();
    expect(
      await screen.findByText(/whole number from 1 to 100/, { selector: "p.text-red-600" })
    ).toBeTruthy();

    type("Largest batch (students)", "250");
    expect((screen.getByLabelText("Largest batch (students)") as HTMLInputElement).value).toBe(
      "250"
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores letters in the batch size", () => {
    renderStep();
    type("Largest batch (students)", "1a2b");
    expect((screen.getByLabelText("Largest batch (students)") as HTMLInputElement).value).toBe(
      "12"
    );
  });

  it("shows the trial price only when a trial is offered, and sends it in paise", async () => {
    const onSubmit = renderStep();
    expect(screen.queryByLabelText("Trial session price (₹)")).toBeNull();

    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    tick(/Offer a trial session/);
    type("Trial session price (₹)", "200");

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      trialsessionOffered: true,
      trialSessionPrice: 20000,
    });
  });

  it("treats an empty trial price as a free trial", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    tick(/Offer a trial session/);
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0].trialSessionPrice).toBe(0);
  });

  it("drops a typed trial price when the trial is switched off again", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    tick(/Offer a trial session/);
    type("Trial session price (₹)", "200");
    tick(/Offer a trial session/);

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.trialsessionOffered).toBe(false);
    expect("trialSessionPrice" in payload).toBe(false);
  });

  it("warns, without blocking, when the trial costs more than an hour", async () => {
    const onSubmit = renderStep();
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);
    tick(/Offer a trial session/);
    type("Trial session price (₹)", "5000");

    expect(screen.getByText(/more than your normal hourly rate/)).toBeTruthy();
    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("restores saved pricing, so Back does not lose it", () => {
    render(
      <Step6Pricing
        onSubmit={vi.fn()}
        previousData={{
          sessionRatePerHour: 75050,
          batchTimings: ["both"],
          maxBatchSize: 8,
          trialsessionOffered: true,
          trialSessionPrice: 10000,
        }}
      />
    );
    expect((screen.getByLabelText("Session rate per hour (₹)") as HTMLInputElement).value).toBe(
      "750.5"
    );
    expect((screen.getByRole("checkbox", { name: /Morning \(/ }) as HTMLInputElement).checked).toBe(
      true
    );
    expect((screen.getByRole("checkbox", { name: /Evening \(/ }) as HTMLInputElement).checked).toBe(
      true
    );
    expect((screen.getByLabelText("Largest batch (students)") as HTMLInputElement).value).toBe("8");
    expect((screen.getByLabelText("Trial session price (₹)") as HTMLInputElement).value).toBe(
      "100"
    );
  });

  it("says plans come later, from the dashboard", () => {
    renderStep();
    expect(
      screen.getByText(/subscription plans and session packages from your dashboard/)
    ).toBeTruthy();
  });

  it("does not submit twice while a save is in flight", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderStep(onSubmit);
    type("Session rate per hour (₹)", "600");
    tick(/Morning \(/);

    const button = screen.getByRole("button", { name: "Save and continue" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolve();
  });
});
