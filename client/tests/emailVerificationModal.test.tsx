// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EmailVerificationModal from "@/modules/onboarding/components/onboarding/EmailVerificationModal";

describe("email verification modal", () => {
  it("is announced as a dialog, named by its heading", () => {
    render(
      <EmailVerificationModal
        email="a@example.com"
        verifyCode={vi.fn()}
        resendCode={vi.fn()}
        onVerified={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Verify Your Email" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });
});
