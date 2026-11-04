// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}));

import Step7Payouts from "@/modules/onboarding/components/academy/Step7Payouts";

beforeEach(() => toastError.mockReset());

const CANCEL = "Cancel at least 24 hours before for a full refund.";
const REFUND = "Refunds are processed within seven days of cancellation.";

const renderStep = (onSubmit = vi.fn().mockResolvedValue(undefined)) => {
  render(<Step7Payouts onSubmit={onSubmit} />);
  return onSubmit;
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const save = () => fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
const agree = () => fireEvent.click(screen.getByRole("checkbox", { name: /Partner Terms/ }));

const fillPolicies = () => {
  type("Cancellation policy", CANCEL);
  type("Refund policy", REFUND);
};
const fillBank = () => {
  type("Account holder name", "Journey Academy");
  type("Account number", "123456789012");
  type("Confirm account number", "123456789012");
  type("IFSC code", "hdfc0001234");
};

describe("Step 7 payouts", () => {
  it("does not save an empty form, and says what is missing", async () => {
    const onSubmit = renderStep();
    save();
    expect(await screen.findByText("Add a bank account or a UPI ID for payouts")).toBeTruthy();
    expect(screen.getByText(/Write your cancellation policy/)).toBeTruthy();
    expect(screen.getByText(/Write your refund policy/)).toBeTruthy();
    expect(screen.getByText("You must agree to the Partner Terms to continue")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("saves a bank account with the account number confirmed and the terms agreed", async () => {
    const onSubmit = renderStep();
    fillBank();
    fillPolicies();
    agree();

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      bankAccountName: "Journey Academy",
      bankAccountNumber: "123456789012",
      bankAccountNumberConfirm: "123456789012",
      bankIfsc: "HDFC0001234",
      payoutFrequency: "monthly",
      cancellationPolicy: CANCEL,
      refundPolicy: REFUND,
      agreeToTerms: true,
    });
  });

  it("saves a UPI ID alone, with no empty bank fields", async () => {
    const onSubmit = renderStep();
    type("UPI ID", "journey@okhdfcbank");
    fillPolicies();
    agree();

    save();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0]![0];
    expect(payload.upiId).toBe("journey@okhdfcbank");
    expect("bankAccountNumber" in payload).toBe(false);
    expect("bankIfsc" in payload).toBe(false);
  });

  it("makes bank details all or nothing", async () => {
    const onSubmit = renderStep();
    type("Account holder name", "Journey Academy");
    type("UPI ID", "journey@okhdfcbank");
    fillPolicies();
    agree();

    save();
    expect(await screen.findByText("Account number must be 9 to 18 digits")).toBeTruthy();
    expect(screen.getByText("Type the account number again to confirm it")).toBeTruthy();
    expect(screen.getByText(/Enter a valid IFSC code/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses account numbers that do not match", async () => {
    const onSubmit = renderStep();
    fillBank();
    type("Confirm account number", "999999999999");
    fillPolicies();
    agree();

    save();
    expect(await screen.findByText("The account numbers do not match")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows only the end of the number once the two match", () => {
    renderStep();
    type("Account number", "123456789012");
    type("Confirm account number", "123456789012");
    expect(screen.getByText("Matches, ending 9012")).toBeTruthy();
    expect(screen.queryByText(/123456789012/)).toBeNull();
  });

  it("cleans spaces and dashes out of the account number, and upper-cases the IFSC", () => {
    renderStep();
    type("Account number", "1234 5678-9012");
    expect((screen.getByLabelText("Account number") as HTMLInputElement).value).toBe(
      "123456789012"
    );
    type("IFSC code", " sbin 0001234");
    expect((screen.getByLabelText("IFSC code") as HTMLInputElement).value).toBe("SBIN0001234");
  });

  it("does not let the confirmation be pasted in", () => {
    renderStep();
    const confirm = screen.getByLabelText("Confirm account number");
    const notPrevented = fireEvent.paste(confirm, {
      clipboardData: { getData: () => "123456789012" },
    });
    expect(notPrevented).toBe(false);
  });

  it("will not save until the terms are ticked, and starts unticked", async () => {
    const onSubmit = renderStep();
    const box = screen.getByRole("checkbox", { name: /Partner Terms/ }) as HTMLInputElement;
    expect(box.checked).toBe(false);

    fillBank();
    fillPolicies();
    save();
    expect(await screen.findByText("You must agree to the Partner Terms to continue")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("links the terms and opens them in a new tab", () => {
    renderStep();
    const link = screen.getByRole("link", { name: "Partner Terms" });
    expect(link.getAttribute("href")).toBe("/partner-terms");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("counts the policy text against its limit", () => {
    renderStep();
    type("Refund policy", "abc");
    expect(screen.getByText("3 / 2000")).toBeTruthy();
  });

  it("restores the frequency and policies, but never bank details or the agreement", () => {
    render(
      <Step7Payouts
        onSubmit={vi.fn()}
        payoutDetailsSaved
        previousData={{
          payoutFrequency: "weekly",
          cancellationPolicy: CANCEL,
          refundPolicy: REFUND,
        }}
      />
    );
    expect((screen.getByLabelText("How often should we pay you?") as HTMLSelectElement).value).toBe(
      "weekly"
    );
    expect((screen.getByLabelText("Cancellation policy") as HTMLTextAreaElement).value).toBe(
      CANCEL
    );
    expect((screen.getByLabelText("Account number") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("UPI ID") as HTMLInputElement).value).toBe("");
    expect(
      (screen.getByRole("checkbox", { name: /Partner Terms/ }) as HTMLInputElement).checked
    ).toBe(false);
    expect(screen.getByText(/we do not show saved payout details again/)).toBeTruthy();
  });

  it("does not submit twice while a save is in flight", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderStep(onSubmit);
    fillBank();
    fillPolicies();
    agree();

    const button = screen.getByRole("button", { name: "Save and continue" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolve();
  });
});
