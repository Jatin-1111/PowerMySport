// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMyProfile = vi.fn();
const fetchProfile = vi.fn();

vi.mock("../src/modules/coach/services/coach", () => ({
  coachApi: {
    getMyProfile: (...a: unknown[]) => getMyProfile(...a),
    updateProfile: vi.fn(),
    updateMyAvailability: vi.fn(),
  },
}));
vi.mock("../src/modules/auth/hooks/useProfile", () => ({
  useFetchProfile:
    () =>
    (...a: unknown[]) =>
      fetchProfile(...a),
}));
vi.mock("../src/modules/auth/services/auth", () => ({
  authApi: { updateProfile: vi.fn(), logout: vi.fn() },
}));
vi.mock("../src/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../src/modules/shared/components/ProfilePictureUpload", () => ({
  default: () => <div data-testid="photo-upload" />,
}));
vi.mock("../src/modules/sports/components/SportsMultiSelect", () => ({
  default: () => <div data-testid="sports-select" />,
}));

import { AboutCard } from "../src/modules/coach/components/profile/AboutCard";
import { ContactDetailsCard } from "../src/modules/coach/components/profile/ContactDetailsCard";
import { ProfileHeaderCard } from "../src/modules/coach/components/profile/ProfileHeaderCard";
import { TaxDetailsCard } from "../src/modules/coach/components/profile/TaxDetailsCard";
import { VerificationSection } from "../src/modules/coach/components/profile/VerificationSection";
import { useCoachProfileFlow } from "../src/modules/coach/hooks/useCoachProfileFlow";
import type { Coach, CoachVerificationDocument, User } from "../src/types";

const user = {
  id: "u1",
  name: "Rohan Deshmukh",
  email: "rohan@example.test",
  phone: "9100000004",
} as User;
const coach = (over: Record<string, unknown> = {}) =>
  ({
    id: "coach-1",
    bio: "Tennis coach",
    sports: ["Tennis"],
    hourlyRate: 1000,
    serviceMode: "FREELANCE",
    availability: [],
    verificationStatus: "VERIFIED",
    ...over,
  }) as unknown as Coach;

afterEach(cleanup);

describe("profile hook", () => {
  beforeEach(() => {
    getMyProfile.mockReset();
    fetchProfile.mockReset();
  });

  it("puts the fetched user into state, so the name and contact details show", async () => {
    fetchProfile.mockResolvedValue(user);
    getMyProfile.mockResolvedValue({ success: true, data: coach() });

    const { result } = renderHook(() => useCoachProfileFlow());
    await waitFor(() => expect(result.current.user?.name).toBe("Rohan Deshmukh"));
    expect(result.current.user?.email).toBe("rohan@example.test");
    expect(result.current.loading).toBe(false);
  });

  it("keeps the page usable when the user cannot be loaded", async () => {
    fetchProfile.mockRejectedValue(new Error("offline"));
    getMyProfile.mockResolvedValue({ success: true, data: coach() });

    const { result } = renderHook(() => useCoachProfileFlow());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.coachProfile?.id).toBe("coach-1");
  });
});

describe("ProfileHeaderCard", () => {
  it("shows the name, contact line and status, and links the public profile when verified", () => {
    render(
      <ProfileHeaderCard
        user={user}
        setUser={vi.fn()}
        coachProfile={coach()}
        view={{ tone: "live", tag: "Verified" }}
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: "Rohan Deshmukh" })).toBeTruthy();
    expect(screen.getByText("rohan@example.test, 9100000004")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View public profile/ }).getAttribute("href")).toBe(
      "/coaches/coach-1"
    );
  });

  it("does not offer a public profile while in review, and falls back when the name is missing", () => {
    render(
      <ProfileHeaderCard
        user={null}
        setUser={vi.fn()}
        coachProfile={coach()}
        view={{ tone: "pending", tag: "In review" }}
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: "Your profile" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /View public profile/ })).toBeNull();
  });
});

describe("AboutCard", () => {
  const props = {
    bio: "Tennis coach",
    isSaving: false,
    aboutForm: { bio: "Tennis coach" },
    setAboutForm: vi.fn(),
    onEditClick: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it("reads the bio and offers one Edit link", () => {
    render(<AboutCard {...props} isEditing={false} />);
    expect(screen.getByText("Tennis coach")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit about" }));
    expect(props.onEditClick).toHaveBeenCalled();
  });

  it("says what to add when there is no bio", () => {
    render(<AboutCard {...props} bio="" isEditing={false} />);
    expect(screen.getByText(/No bio yet/)).toBeTruthy();
  });

  it("edits with a labelled field, Save and Cancel", () => {
    render(<AboutCard {...props} isEditing />);
    fireEvent.change(screen.getByLabelText("Your bio"), { target: { value: "New bio" } });
    expect(props.setAboutForm).toHaveBeenCalledWith({ bio: "New bio" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Edit about" })).toBeNull();
  });
});

describe("TaxDetailsCard", () => {
  const props = {
    isSaving: false,
    taxForm: { gstNumber: "" },
    setTaxForm: vi.fn(),
    onEditClick: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it("shows the GST number, or says there is none", () => {
    const { rerender } = render(
      <TaxDetailsCard {...props} gstNumber="22AAAAA0000A1Z5" isEditing={false} />
    );
    expect(screen.getByText("22AAAAA0000A1Z5")).toBeTruthy();
    rerender(<TaxDetailsCard {...props} isEditing={false} />);
    expect(screen.getByText("No GST number added.")).toBeTruthy();
  });

  it("upper-cases what is typed", () => {
    render(<TaxDetailsCard {...props} isEditing />);
    fireEvent.change(screen.getByLabelText("GST number (optional)"), {
      target: { value: "22aaaaa" },
    });
    expect(props.setTaxForm).toHaveBeenCalledWith({ gstNumber: "22AAAAA" });
  });
});

describe("ContactDetailsCard", () => {
  const props = {
    isSaving: false,
    profileForm: { name: "Rohan Deshmukh", email: "rohan@example.test", phone: "9100000004" },
    setProfileForm: vi.fn(),
    onEditClick: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  };

  it("lists name, email and phone, and no longer shows a Role row", () => {
    render(<ContactDetailsCard {...props} user={user} isEditing={false} />);
    expect(screen.getByText("rohan@example.test")).toBeTruthy();
    expect(screen.getByText("9100000004")).toBeTruthy();
    expect(screen.queryByText("Role")).toBeNull();
  });

  it("says Not provided for missing details", () => {
    render(<ContactDetailsCard {...props} user={{ id: "u" } as User} isEditing={false} />);
    expect(screen.getAllByText("Not provided")).toHaveLength(3);
  });

  it("edits three labelled fields", () => {
    render(<ContactDetailsCard {...props} user={user} isEditing />);
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Phone number")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "9000000000" } });
    expect(props.setProfileForm).toHaveBeenCalled();
  });
});

describe("VerificationSection", () => {
  const docs = [
    { type: "ID_PROOF", fileName: "aadhaar.pdf" },
    { type: "CERTIFICATION", fileName: "itf-level-1.pdf" },
  ] as unknown as CoachVerificationDocument[];

  it("gives the status in words with the guidance and the documents on file", () => {
    render(
      <VerificationSection
        view={{ tone: "live", tag: "Verified" }}
        guidance="You are approved and your profile is visible to players."
        documents={docs}
      />
    );
    expect(screen.getByText("Verified")).toBeTruthy();
    expect(screen.getByText(/visible to players/)).toBeTruthy();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("id proof")).toBeTruthy();
  });

  it("shows our team's notes only when there are some, and no list with no documents", () => {
    const { rerender } = render(
      <VerificationSection
        view={{ tone: "pending", tag: "In review" }}
        guidance="In review."
        documents={[]}
      />
    );
    expect(screen.queryByText("Notes from our team")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    rerender(
      <VerificationSection
        view={{ tone: "pending", tag: "In review" }}
        guidance="In review."
        documents={[]}
        notes="Certificate is unreadable."
      />
    );
    expect(screen.getByText("Certificate is unreadable.")).toBeTruthy();
  });

  it("never uses an em dash in its copy", () => {
    const { container } = render(
      <VerificationSection
        view={{ tone: "live", tag: "Verified" }}
        guidance="Approved."
        documents={docs}
      />
    );
    expect(container.textContent).not.toMatch(/[—–]/);
  });
});

describe("hook state on edit", () => {
  it("does not hand back check-in or logout, which moved out of the profile", async () => {
    fetchProfile.mockResolvedValue(user);
    getMyProfile.mockResolvedValue({ success: true, data: coach() });
    const { result } = renderHook(() => useCoachProfileFlow());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect("handleCoachCheckIn" in result.current).toBe(false);
    expect("handleLogout" in result.current).toBe(false);
    act(() => result.current.handleEditAboutClick());
    expect(result.current.isEditingAbout).toBe(true);
  });
});
