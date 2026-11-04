import { beforeEach, describe, expect, it, vi } from "vitest";

const { post, put } = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }));

vi.mock("@/lib/api/axios", () => ({ default: { post, put, get: vi.fn(), delete: vi.fn() } }));

import { useParentalConsentStore } from "@/modules/player/store/parentalConsentStore";
import { useAuthStore } from "../store/authStore";
import { authApi } from "./auth";

const consentRequired = () =>
  Object.assign(new Error("Please accept the Parental Consent policy to add a child."), {
    response: { status: 428 },
  });

/** Answers the consent dialog as soon as it opens. */
const answerDialog = (agreed: boolean) => {
  const unsubscribe = useParentalConsentStore.subscribe((state) => {
    if (state.pending) {
      unsubscribe();
      queueMicrotask(() => useParentalConsentStore.getState().settle(agreed));
    }
  });
};

beforeEach(() => {
  post.mockReset();
  put.mockReset();
  useParentalConsentStore.setState({ pending: null });
  useAuthStore.setState({
    user: { id: "u1", parentalConsentCurrent: false } as never,
  });
});

describe("adding a child when the profile already says consent is missing", () => {
  it("asks first and sends one request, already carrying the agreement", async () => {
    post.mockResolvedValueOnce({ data: { success: true } });
    answerDialog(true);

    const result = await authApi.addDependent({ name: "Riya", dob: "2016-01-01" });

    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({ name: "Riya", parentalConsent: true });
    expect(useAuthStore.getState().user?.parentalConsentCurrent).toBe(true);
  });

  it("sends no request at all when the parent cancels", async () => {
    answerDialog(false);

    await expect(authApi.addDependent({ name: "Riya", dob: "2016-01-01" })).rejects.toThrow(
      /agreement/
    );
    expect(post).not.toHaveBeenCalled();
  });

  it("does not ask a parent who has already agreed", async () => {
    useAuthStore.setState({ user: { id: "u1", parentalConsentCurrent: true } as never });
    post.mockResolvedValueOnce({ data: { success: true } });

    await authApi.addDependent({ name: "Riya", dob: "2016-01-01" });

    expect(useParentalConsentStore.getState().pending).toBeNull();
    expect(post.mock.calls[0][1]).not.toHaveProperty("parentalConsent");
  });
});

describe("adding a child when the consent state is not known yet", () => {
  // A fresh sign-in has not loaded the profile, so the flag is absent. The server then
  // decides, and answers 428 when it needs the agreement.
  beforeEach(() => {
    useAuthStore.setState({ user: { id: "u1" } as never });
  });

  it("shows the dialog on a 428, then retries with the agreement", async () => {
    post
      .mockRejectedValueOnce(consentRequired())
      .mockResolvedValueOnce({ data: { success: true } });
    answerDialog(true);

    const result = await authApi.addDependent({ name: "Riya", dob: "2016-01-01" });

    expect(result.success).toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toMatchObject({ name: "Riya", parentalConsent: true });
    expect(useAuthStore.getState().user?.parentalConsentCurrent).toBe(true);
  });

  it("does not add the child when the parent cancels", async () => {
    post.mockRejectedValueOnce(consentRequired());
    answerDialog(false);

    await expect(authApi.addDependent({ name: "Riya", dob: "2016-01-01" })).rejects.toThrow(
      /agreement/
    );
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("passes any other error straight through, without a dialog", async () => {
    post.mockRejectedValueOnce(Object.assign(new Error("boom"), { response: { status: 500 } }));

    await expect(authApi.addDependent({ name: "Riya", dob: "2016-01-01" })).rejects.toThrow("boom");
    expect(useParentalConsentStore.getState().pending).toBeNull();
  });
});

describe("editing a child", () => {
  it("asks a parent who has not agreed yet, and sends the agreement", async () => {
    put.mockResolvedValue({ data: { success: true } });
    answerDialog(true);

    await authApi.updateDependent("c1", { location: "Delhi" } as never);

    expect(put.mock.calls[0][1]).toMatchObject({ parentalConsent: true });
  });

  it("still saves the edit when the parent declines", async () => {
    put.mockResolvedValue({ data: { success: true } });
    answerDialog(false);

    await authApi.updateDependent("c1", { location: "Delhi" } as never);

    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][1]).not.toHaveProperty("parentalConsent");
  });

  it("does not ask a parent who has already agreed", async () => {
    useAuthStore.setState({ user: { id: "u1", parentalConsentCurrent: true } as never });
    put.mockResolvedValue({ data: { success: true } });

    await authApi.updateDependent("c1", { location: "Delhi" } as never);

    expect(useParentalConsentStore.getState().pending).toBeNull();
    expect(put.mock.calls[0][1]).not.toHaveProperty("parentalConsent");
  });
});
