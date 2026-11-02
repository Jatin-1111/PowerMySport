// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("../src/lib/toast", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import {
  draftFrom,
  draftPayload,
  emptyDraft,
  maskAccountNumber,
  methodFacts,
  validateDraft,
} from "../src/modules/shared/components/payout/PayoutFields";
import { PayoutMethodManager } from "../src/modules/shared/components/payout/PayoutMethodManager";
import { PayoutMethodManager as MultiManager } from "../src/modules/shared/components/payout/PayoutMethodManagerV2";
import type { IPayoutMethod } from "../src/types";

const bank = (over: Partial<IPayoutMethod> = {}): IPayoutMethod => ({
  id: "m1",
  type: "BANK_TRANSFER",
  accountHolderName: "Meera Iyer",
  accountNumber: "123456789012",
  ifscCode: "SBIN0001234",
  bankName: "State Bank of India",
  ...over,
});

describe("payout draft helpers", () => {
  const filled = () => ({
    ...emptyDraft(),
    accountHolderName: "Meera Iyer",
    accountNumber: "123456789012",
    confirmAccountNumber: "123456789012",
    ifscCode: "SBIN0001234",
    bankName: "State Bank of India",
  });

  it("accepts a complete bank draft and uppercases the IFSC in the payload", () => {
    expect(validateDraft(filled())).toBeNull();
    expect(draftPayload({ ...filled(), ifscCode: "sbin0001234" }).ifscCode).toBe("SBIN0001234");
  });

  it("names the first thing wrong", () => {
    expect(validateDraft({ ...filled(), accountHolderName: " " })).toBe(
      "Account holder name is required"
    );
    expect(validateDraft({ ...filled(), confirmAccountNumber: "1" })).toBe(
      "Account numbers don't match"
    );
    expect(validateDraft({ ...filled(), ifscCode: "SBIN123" })).toMatch(/Invalid IFSC/);
  });

  it("validates UPI separately", () => {
    expect(validateDraft({ ...emptyDraft(), type: "UPI", upiId: "" })).toBe("UPI ID is required");
    expect(validateDraft({ ...emptyDraft(), type: "UPI", upiId: "nope" })).toMatch(/Invalid UPI/);
    expect(validateDraft({ ...emptyDraft(), type: "UPI", upiId: "meera@okaxis" })).toBeNull();
  });

  it("masks all but the last four digits of an account number", () => {
    expect(maskAccountNumber("123456789012")).toBe("••••••••9012");
    expect(methodFacts(bank())[1].value).toBe("••••••••9012");
  });

  it("round-trips a saved method through a draft", () => {
    const draft = draftFrom(bank());
    expect(draft.confirmAccountNumber).toBe("123456789012");
    expect(draftPayload(draft)).toMatchObject({
      type: "BANK_TRANSFER",
      bankName: "State Bank of India",
    });
  });
});

describe("PayoutMethodManager (one method)", () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });
  afterEach(cleanup);

  const renderManager = (over: Record<string, unknown> = {}) =>
    render(
      <PayoutMethodManager
        ownerType="VENUE"
        onLoad={() => Promise.resolve(null)}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        {...over}
      />
    );

  it("says nothing is set up and offers to add one", async () => {
    renderManager();
    expect(await screen.findByText("Not set up")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a payout method" })).toBeTruthy();
  });

  it("shows a saved method with the account number masked", async () => {
    renderManager({ onLoad: () => Promise.resolve(bank()) });
    expect(await screen.findByText("Saved")).toBeTruthy();
    expect(screen.getByText("••••••••9012")).toBeTruthy();
    expect(screen.queryByText("123456789012")).toBeNull();
  });

  it("saves a UPI method from the form", async () => {
    const onSave = vi.fn().mockResolvedValue({ id: "m2", type: "UPI", upiId: "meera@okaxis" });
    renderManager({ onSave });

    fireEvent.click(await screen.findByRole("button", { name: "Add a payout method" }));
    fireEvent.click(screen.getByRole("button", { name: "UPI" }));
    fireEvent.change(screen.getByLabelText("UPI ID"), { target: { value: "meera@okaxis" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payout method" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ type: "UPI", upiId: "meera@okaxis" })
    );
    expect(await screen.findByText("meera@okaxis")).toBeTruthy();
    expect(toastSuccess).toHaveBeenCalledWith("Payout method saved");
  });

  it("will not save an invalid IFSC and says why", async () => {
    const onSave = vi.fn();
    renderManager({ onSave });
    fireEvent.click(await screen.findByRole("button", { name: "Add a payout method" }));
    fireEvent.change(screen.getByLabelText("Account holder name"), { target: { value: "Meera" } });
    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByLabelText("Confirm account number"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByLabelText("IFSC code"), { target: { value: "BAD" } });
    fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "SBI" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payout method" }));

    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/Invalid IFSC/));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("needs a second press to remove", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderManager({ onLoad: () => Promise.resolve(bank()), onDelete });

    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Press again to remove" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Not set up")).toBeTruthy();
  });

  it("hides the account number until asked", async () => {
    renderManager();
    fireEvent.click(await screen.findByRole("button", { name: "Add a payout method" }));
    const input = screen.getByLabelText("Account number") as HTMLInputElement;
    expect(input.type).toBe("password");
    fireEvent.click(screen.getAllByRole("button", { name: "Show account number" })[0]);
    expect(input.type).toBe("text");
  });
});

describe("PayoutMethodManager (several methods)", () => {
  afterEach(cleanup);

  it("marks the primary method and lets another be made primary", async () => {
    const onSetDefault = vi.fn().mockResolvedValue(undefined);
    render(
      <MultiManager
        ownerType="Coach"
        onLoad={() =>
          Promise.resolve([
            bank({ id: "a", isDefault: true }),
            { id: "b", type: "UPI", upiId: "meera@okaxis", isDefault: false },
          ])
        }
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onSetDefault={onSetDefault}
      />
    );

    expect(await screen.findByText("Primary")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Make UPI the primary method" }));
    await waitFor(() => expect(onSetDefault).toHaveBeenCalledWith("b"));
    await waitFor(() => expect(screen.getAllByText("Primary")).toHaveLength(1));
    expect(
      within(screen.getByText("meera@okaxis").closest("li")!).getByText("Primary")
    ).toBeTruthy();
  });
});
