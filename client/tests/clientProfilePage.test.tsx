// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sixth and last of the plan's 6 largest client/src/app pages (773 lines,
// the smallest of the six). No extracted hook/sub-components, so this
// renders the whole page directly, same as the other five in this track.

const backMock = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ clientId: "client-1" }),
  useRouter: () => ({ back: backMock }),
}));

const getClientDetails = vi.fn();
const addClientNote = vi.fn();
const deleteClientNote = vi.fn();
vi.mock("@/modules/coach/services/coach", () => ({
  coachApi: {
    getClientDetails: (...args: unknown[]) => getClientDetails(...args),
    addClientNote: (...args: unknown[]) => addClientNote(...args),
    deleteClientNote: (...args: unknown[]) => deleteClientNote(...args),
  },
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("@/lib/toast", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

import ClientProfilePage from "../src/app/(booking)/coach/clients/[clientId]/page";
import type { Booking, ClientDetails, ClientNote } from "../src/types";

const baseClient: ClientDetails = {
  clientId: "client-1",
  name: "Alex Player",
  email: "alex@example.com",
  sports: ["Tennis"],
  totalSessions: 5,
  completedSessions: 3,
  pendingSessions: 2,
  firstSessionDate: "2026-01-01T00:00:00.000Z",
  lastSessionDate: "2026-02-01T00:00:00.000Z",
  isActive: true,
  bookings: [],
  notes: [],
};

const noteFixture = (overrides: Partial<ClientNote> = {}): ClientNote => ({
  _id: "note-1",
  coachId: "coach-1",
  clientId: "client-1",
  note: "Great progress this week.",
  noteType: "PROGRESS",
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

const bookingFixture = (overrides: Partial<Booking> = {}): Booking =>
  ({
    id: "booking-1",
    userId: "client-1",
    sport: "Tennis",
    date: "2026-02-01",
    startTime: "09:00",
    endTime: "10:00",
    totalAmount: 1000,
    status: "CONFIRMED",
    bookingType: "INDIVIDUAL",
    organizerId: "client-1",
    ...overrides,
  }) as Booking;

const mockLoadsWith = (overrides: Partial<ClientDetails> = {}) => {
  getClientDetails.mockResolvedValue({
    success: true,
    data: { ...baseClient, ...overrides },
  });
};

beforeEach(() => {
  backMock.mockReset();
  getClientDetails.mockReset();
  addClientNote.mockReset();
  deleteClientNote.mockReset();
  toastError.mockReset();
  toastSuccess.mockReset();
});

describe("ClientProfilePage — loading and error states", () => {
  it("shows the client once loaded", async () => {
    mockLoadsWith();
    render(<ClientProfilePage />);

    expect(await screen.findByText("Alex Player")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the error state and message when the API call fails", async () => {
    getClientDetails.mockResolvedValue({ success: false, message: "Client not found." });
    render(<ClientProfilePage />);

    expect(await screen.findByText("Could not load client")).toBeInTheDocument();
    expect(screen.getByText("Client not found.")).toBeInTheDocument();
  });

  it("goes back on click in the error state", async () => {
    getClientDetails.mockResolvedValue({ success: false, message: "Client not found." });
    render(<ClientProfilePage />);
    await screen.findByText("Could not load client");

    fireEvent.click(screen.getByRole("button", { name: /Go Back/i }));

    expect(backMock).toHaveBeenCalled();
  });

  it("shows the error state when the request throws", async () => {
    getClientDetails.mockRejectedValue(new Error("network down"));
    render(<ClientProfilePage />);

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });
});

describe("ClientProfilePage — stats and sports", () => {
  it("renders the session stats and sport tags", async () => {
    mockLoadsWith();
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Tennis")).toBeInTheDocument();
  });

  it("shows Inactive for an inactive client", async () => {
    mockLoadsWith({ isActive: false });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});

describe("ClientProfilePage — session notes", () => {
  it("shows the empty state when there are no notes", async () => {
    mockLoadsWith({ notes: [] });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByText("No notes yet")).toBeInTheDocument();
  });

  it("renders an existing note with its type badge", async () => {
    mockLoadsWith({ notes: [noteFixture()] });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByText("Great progress this week.")).toBeInTheDocument();
    expect(screen.getByText("Progress")).toBeInTheDocument();
  });

  it("blocks saving an empty note", async () => {
    mockLoadsWith();
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

    expect(toastError).toHaveBeenCalledWith("Note text is required.");
    expect(addClientNote).not.toHaveBeenCalled();
  });

  it("saves a note and refetches the client", async () => {
    // The add-note form is wrapped in AnimatePresence, whose exit animation
    // leaves the outgoing node (with its last props, including the just-typed
    // text) lingering in jsdom rather than actually unmounting — so this
    // checks the real save behavior (API payload, toast, refetch) rather than
    // DOM removal, which framer-motion's exit animation never completes here.
    mockLoadsWith();
    addClientNote.mockResolvedValue({ success: true, data: {} });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
    fireEvent.change(screen.getByPlaceholderText("Write your note here..."), {
      target: { value: "Worked on serve technique." },
    });
    fireEvent.change(screen.getByDisplayValue("General"), { target: { value: "SESSION" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() => {
      expect(addClientNote).toHaveBeenCalledWith("client-1", {
        note: "Worked on serve technique.",
        noteType: "SESSION",
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith("Note added.");
    expect(getClientDetails).toHaveBeenCalledTimes(2);
  });

  it("includes an optional session date when provided", async () => {
    mockLoadsWith();
    addClientNote.mockResolvedValue({ success: true, data: {} });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
    fireEvent.change(screen.getByPlaceholderText("Write your note here..."), {
      target: { value: "Session recap." },
    });
    // The "Session Date" label has no `for`/`aria-labelledby` pointing at
    // the input, so it can't be reached via getByLabelText.
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() => {
      expect(addClientNote).toHaveBeenCalledWith(
        "client-1",
        expect.objectContaining({ sessionDate: "2026-03-01" })
      );
    });
  });

  it("shows an error toast and keeps the form open when saving fails", async () => {
    mockLoadsWith();
    addClientNote.mockResolvedValue({ success: false, message: "Server rejected the note." });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
    fireEvent.change(screen.getByPlaceholderText("Write your note here..."), {
      target: { value: "Some note." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Note" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Server rejected the note.");
    });
    expect(screen.getByPlaceholderText("Write your note here...")).toBeInTheDocument();
  });

  it("cancels the form without saving", async () => {
    mockLoadsWith();
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Add Note" }));
    fireEvent.change(screen.getByPlaceholderText("Write your note here..."), {
      target: { value: "Draft that should be discarded." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(addClientNote).not.toHaveBeenCalled();
  });

  it("deletes a note only after confirming", async () => {
    mockLoadsWith({ notes: [noteFixture()] });
    deleteClientNote.mockResolvedValue({ success: true, data: null });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    expect(deleteClientNote).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteClientNote).toHaveBeenCalledWith("client-1", "note-1");
    });
    expect(toastSuccess).toHaveBeenCalledWith("Note deleted.");
  });

  it("does not delete when the confirmation is cancelled", async () => {
    mockLoadsWith({ notes: [noteFixture()] });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    fireEvent.click(screen.getByRole("button", { name: "Delete note" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteClientNote).not.toHaveBeenCalled();
  });
});

describe("ClientProfilePage — session history", () => {
  it("shows the empty state when there are no bookings", async () => {
    mockLoadsWith({ bookings: [] });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("renders a booking with a humanized status label", async () => {
    mockLoadsWith({ bookings: [bookingFixture({ status: "NO_SHOW" })] });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByText("No Show")).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
  });

  it("sorts bookings newest first", async () => {
    mockLoadsWith({
      // The header's own "Last Session" stat card also renders a date
      // ending in the same year, so it's cleared here to keep this test's
      // date query scoped to just the booking rows.
      lastSessionDate: null,
      bookings: [
        bookingFixture({ id: "b-old", date: "2026-01-01" }),
        bookingFixture({ id: "b-new", date: "2026-03-01" }),
      ],
    });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    const dates = screen.getAllByText(/2026$/, { exact: false }).map((el) => el.textContent);
    expect(dates[0]).toContain("01 Mar");
  });

  it("paginates bookings beyond the first page and loads more on click", async () => {
    const bookings = Array.from({ length: 12 }, (_, i) =>
      bookingFixture({ id: `booking-${i}`, date: `2026-01-${String(i + 1).padStart(2, "0")}` })
    );
    mockLoadsWith({ bookings });
    render(<ClientProfilePage />);
    await screen.findByText("Alex Player");

    expect(screen.getByRole("button", { name: /Load more \(2 more\)/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Load more/ }));

    expect(screen.queryByRole("button", { name: /Load more/ })).not.toBeInTheDocument();
  });
});
