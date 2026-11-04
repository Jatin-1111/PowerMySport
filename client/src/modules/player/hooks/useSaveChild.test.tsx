// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addDependent, updateDependent, refreshProfile } = vi.hoisted(() => ({
  addDependent: vi.fn(),
  updateDependent: vi.fn(),
  refreshProfile: vi.fn(),
}));

vi.mock("@/modules/auth/services/auth", () => ({ authApi: { addDependent, updateDependent } }));
vi.mock("@/modules/auth/hooks/useProfile", () => ({ useRefreshProfile: () => refreshProfile }));

import { queryKeys } from "@/lib/query/keys";
import { useSaveChild } from "./useSaveChild";

const profile = { id: "u1", name: "Parent" };

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient();
  addDependent.mockReset().mockResolvedValue({ success: true, data: { _id: "c1", name: "Riya" } });
  updateDependent
    .mockReset()
    .mockResolvedValue({ success: true, data: { _id: "c1", name: "Riya" } });
  refreshProfile.mockReset().mockResolvedValue(profile);
});

describe("useSaveChild", () => {
  it("adds a child, then re-reads the profile so every reader agrees", async () => {
    const { result } = renderHook(() => useSaveChild(), { wrapper });

    const saved = await act(() => result.current.addChild({ name: "Riya", location: "Delhi" }));

    expect(addDependent).toHaveBeenCalledWith({ name: "Riya", location: "Delhi" });
    expect(saved.child).toMatchObject({ _id: "c1" });
    await expect(saved.refreshed).resolves.toBe(profile);
    expect(refreshProfile).toHaveBeenCalledTimes(1);
  });

  it("updates a child the same way", async () => {
    const { result } = renderHook(() => useSaveChild(), { wrapper });

    const saved = await act(() => result.current.updateChild("c1", { ambition: "fun" }));

    expect(updateDependent).toHaveBeenCalledWith("c1", { ambition: "fun" });
    await expect(saved.refreshed).resolves.toBe(profile);
  });

  it("tells the dashboard its data is stale after every save", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSaveChild(), { wrapper });

    await act(() => result.current.updateChild("c1", { ambition: "fun" }));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.dashboard.all });
  });

  it("does not re-read the profile when the save itself fails", async () => {
    addDependent.mockRejectedValueOnce(new Error("refused"));
    const { result } = renderHook(() => useSaveChild(), { wrapper });

    await expect(result.current.addChild({ name: "Riya" })).rejects.toThrow("refused");

    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it("treats a reply that says it did not succeed as a failure", async () => {
    updateDependent.mockResolvedValueOnce({ success: false, message: "Nope" });
    const { result } = renderHook(() => useSaveChild(), { wrapper });

    await expect(result.current.updateChild("c1", {})).rejects.toThrow("Nope");
    expect(refreshProfile).not.toHaveBeenCalled();
  });

  it("keeps a saved child saved when only the re-read fails", async () => {
    refreshProfile.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useSaveChild(), { wrapper });

    const saved = await act(() => result.current.addChild({ name: "Riya" }));

    expect(saved.child).toMatchObject({ _id: "c1" });
    await expect(saved.refreshed).resolves.toBeNull();
  });
});
