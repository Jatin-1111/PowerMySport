// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/auth/hooks/useSessionExpiry", () => ({ useSessionExpiry: () => undefined }));

import { useAuthStore } from "@/modules/auth/store/authStore";
import { HydrationBoundary } from "./HydrationBoundary";

const saveUser = (user: unknown) => localStorage.setItem("user", JSON.stringify(user));

const mount = () =>
  render(
    <HydrationBoundary>
      <div />
    </HydrationBoundary>
  );

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, token: null, hydrated: false });
});

describe("restoring the signed-in user from the browser", () => {
  it("restores a user whose children are in the current, flat shape", () => {
    saveUser({
      id: "u1",
      name: "Parent",
      dependents: [{ _id: "c1", name: "Riya", chosenSport: "Tennis", quiz: { heightCm: 140 } }],
    });
    mount();

    const user = useAuthStore.getState().user;
    expect(user?.dependents).toHaveLength(1);
    expect(user?.dependents?.[0].chosenSport).toBe("Tennis");
  });

  it("drops children saved in the old grouped shape, so no screen shows them half-empty", () => {
    saveUser({
      id: "u1",
      name: "Parent",
      dependents: [{ _id: "c1", name: "Riya", sport: { chosenSport: "Tennis" }, physical: {} }],
    });
    mount();

    const user = useAuthStore.getState().user;
    expect(user?.id).toBe("u1");
    expect(user?.dependents).toBeUndefined();
  });

  it("recognises the old shape from any one of its groups", () => {
    for (const group of ["sport", "physical", "practical", "standing"]) {
      localStorage.clear();
      saveUser({ id: "u1", dependents: [{ _id: "c1", name: "Riya", [group]: {} }] });
      useAuthStore.setState({ user: null, hydrated: false });
      mount();

      expect(useAuthStore.getState().user?.dependents, group).toBeUndefined();
    }
  });

  it("keeps everything else about the user", () => {
    saveUser({
      id: "u1",
      name: "Parent",
      email: "p@example.com",
      dependents: [{ _id: "c1", name: "Riya", sport: {} }],
    });
    mount();

    expect(useAuthStore.getState().user).toMatchObject({ id: "u1", name: "Parent" });
  });

  it("marks the store hydrated even when there is no saved user", () => {
    mount();

    expect(useAuthStore.getState().hydrated).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("recovers from a saved user that is not valid JSON", () => {
    localStorage.setItem("user", "{not json");
    mount();

    expect(localStorage.getItem("user")).toBeNull();
    expect(useAuthStore.getState().hydrated).toBe(true);
  });
});
