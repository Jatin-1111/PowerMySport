import axiosInstance from "@/lib/api/axios";
import type { ApiResponse } from "@/types";
import type {
  CoachEnrollment,
  CoachOffering,
  CoachSessionOccurrence,
  CoachOfferingCreateInput,
  EnrollInput,
  CoachEarningsSummary,
} from "@/types/coachPrograms";

/**
 * Recurring coaching programmes — the API a coach uses to run a class, and a
 * parent uses to join one.
 *
 * Mounted at /coach-programmes rather than under /coaches because that router
 * ends in a `/:coachId` catch-all on the server.
 */

const BASE = "/coach-programmes";

export const coachProgramsApi = {
  // ── discovery ─────────────────────────────────────────────────────────────

  /**
   * Browse published programmes.
   *
   * This is the lane that makes online coaches findable at all: coach discovery
   * is a geospatial query over coaches with a base location, and an online-only
   * coach has none.
   */
  browse: async (params: {
    sport?: string;
    deliveryKind?: CoachOffering["deliveryKind"];
    online?: boolean;
  } = {}): Promise<ApiResponse<{ offerings: CoachOffering[] }>> => {
    const search = new URLSearchParams();
    if (params.sport) search.set("sport", params.sport);
    if (params.deliveryKind) search.set("deliveryKind", params.deliveryKind);
    if (params.online) search.set("online", "true");

    const query = search.toString();
    const response = await axiosInstance.get(
      `${BASE}/browse${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  // ── coach: programmes ─────────────────────────────────────────────────────

  listMine: async (): Promise<ApiResponse<{ offerings: CoachOffering[] }>> => {
    const response = await axiosInstance.get(`${BASE}/mine`);
    return response.data;
  },

  create: async (
    payload: CoachOfferingCreateInput,
  ): Promise<ApiResponse<{ offering: CoachOffering }>> => {
    const response = await axiosInstance.post(BASE, payload);
    return response.data;
  },

  activate: async (
    offeringId: string,
  ): Promise<ApiResponse<{ offering: CoachOffering; sessionsCreated: number }>> => {
    const response = await axiosInstance.post(`${BASE}/${offeringId}/activate`);
    return response.data;
  },

  pause: async (
    offeringId: string,
  ): Promise<ApiResponse<{ offering: CoachOffering }>> => {
    const response = await axiosInstance.post(`${BASE}/${offeringId}/pause`);
    return response.data;
  },

  roster: async (
    offeringId: string,
  ): Promise<
    ApiResponse<{
      roster: CoachEnrollment[];
      capacity: number;
      enrolledCount: number;
      seatsLeft: number;
    }>
  > => {
    const response = await axiosInstance.get(`${BASE}/${offeringId}/roster`);
    return response.data;
  },

  setProgramLink: async (
    offeringId: string,
    meetingLink: string,
  ): Promise<ApiResponse<{ offering: CoachOffering }>> => {
    const response = await axiosInstance.put(
      `${BASE}/${offeringId}/meeting-link`,
      { meetingLink },
    );
    return response.data;
  },

  // ── coach: sessions ───────────────────────────────────────────────────────

  mySessions: async (params: { from?: string; to?: string } = {}): Promise<
    ApiResponse<{ sessions: CoachSessionOccurrence[] }>
  > => {
    const search = new URLSearchParams();
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    const query = search.toString();

    const response = await axiosInstance.get(
      `${BASE}/sessions/mine${query ? `?${query}` : ""}`,
    );
    return response.data;
  },

  makeupsOwed: async (): Promise<
    ApiResponse<{ sessions: CoachSessionOccurrence[] }>
  > => {
    const response = await axiosInstance.get(`${BASE}/sessions/makeups-owed`);
    return response.data;
  },

  earnings: async (): Promise<
    ApiResponse<{ summary: CoachEarningsSummary }>
  > => {
    const response = await axiosInstance.get(`${BASE}/sessions/earnings`);
    return response.data;
  },

  completeSession: async (
    occurrenceId: string,
    coachNotes?: string,
  ): Promise<
    ApiResponse<{
      session: CoachSessionOccurrence;
      seatsFunded: number;
      seatsUnfunded: number;
      earnedPaise: number;
    }>
  > => {
    const response = await axiosInstance.post(
      `${BASE}/sessions/${occurrenceId}/complete`,
      coachNotes ? { coachNotes } : {},
    );
    return response.data;
  },

  cancelSession: async (
    occurrenceId: string,
    reason?: string,
  ): Promise<ApiResponse<{ session: CoachSessionOccurrence }>> => {
    const response = await axiosInstance.post(
      `${BASE}/sessions/${occurrenceId}/cancel`,
      reason ? { reason } : {},
    );
    return response.data;
  },

  scheduleMakeup: async (
    occurrenceId: string,
    scheduledAt: string,
    durationMinutes?: number,
  ): Promise<ApiResponse<{ session: CoachSessionOccurrence }>> => {
    const response = await axiosInstance.post(
      `${BASE}/sessions/${occurrenceId}/makeup`,
      { scheduledAt, ...(durationMinutes ? { durationMinutes } : {}) },
    );
    return response.data;
  },

  markAttendance: async (
    occurrenceId: string,
    enrollmentId: string,
    mark: "PENDING" | "PRESENT" | "ABSENT",
  ): Promise<ApiResponse<{ session: CoachSessionOccurrence }>> => {
    const response = await axiosInstance.post(
      `${BASE}/sessions/${occurrenceId}/attendance`,
      { enrollmentId, mark },
    );
    return response.data;
  },

  setSessionLink: async (
    occurrenceId: string,
    meetingLink: string,
  ): Promise<ApiResponse<{ session: CoachSessionOccurrence }>> => {
    const response = await axiosInstance.put(
      `${BASE}/sessions/${occurrenceId}/meeting-link`,
      { meetingLink },
    );
    return response.data;
  },

  // ── student ───────────────────────────────────────────────────────────────

  /**
   * Hold a seat and start checkout.
   *
   * Enrolling does NOT make the student a member — it reserves the seat and
   * hands back a payment redirect. The enrolment goes live only when the
   * payment reconciles, so the caller must send the payer to `redirectUrl`.
   */
  enroll: async (
    offeringId: string,
    payload: EnrollInput,
  ): Promise<
    ApiResponse<{
      enrollmentId: string;
      holdExpiresAt: string;
      redirectUrl: string;
      merchantOrderId: string;
      amountBreakdown: {
        baseAmount: number;
        platformFee: number;
        taxAmount: number;
        total: number;
      };
    }>
  > => {
    const response = await axiosInstance.post(
      `${BASE}/${offeringId}/enroll`,
      payload,
    );
    return response.data;
  },

  /**
   * Renew for another period.
   *
   * There is no payment mandate in this integration, so renewing is the payer
   * completing a payment — the caller must send them to `redirectUrl`, exactly
   * as when they first joined.
   */
  renew: async (
    enrollmentId: string,
  ): Promise<
    ApiResponse<{
      redirectUrl: string;
      merchantOrderId: string;
      amountBreakdown: {
        baseAmount: number;
        platformFee: number;
        taxAmount: number;
        total: number;
      };
    }>
  > => {
    const response = await axiosInstance.post(
      `${BASE}/enrollments/${enrollmentId}/renew`,
    );
    return response.data;
  },

  /**
   * Join the waiting list for a full programme.
   *
   * A freed seat is offered to everyone waiting at once and goes to whoever
   * books first — there is no reserved hold, so the notification is a prompt to
   * be quick, not a guarantee.
   */
  joinWaitlist: async (
    offeringId: string,
    studentName: string,
    playerId?: string,
  ): Promise<ApiResponse<{ entry: { id: string; status: string } }>> => {
    const response = await axiosInstance.post(
      `${BASE}/${offeringId}/waitlist`,
      { studentName, ...(playerId ? { playerId } : {}) },
    );
    return response.data;
  },

  leaveWaitlist: async (entryId: string): Promise<ApiResponse<null>> => {
    const response = await axiosInstance.post(
      `${BASE}/waitlist/${entryId}/leave`,
    );
    return response.data;
  },

  myWaitlist: async (): Promise<
    ApiResponse<{
      entries: Array<{
        id: string;
        studentName: string;
        status: string;
        offeringId: CoachOffering | string;
      }>;
    }>
  > => {
    const response = await axiosInstance.get(`${BASE}/my/waitlist`);
    return response.data;
  },

  myEnrollments: async (): Promise<
    ApiResponse<{ enrollments: CoachEnrollment[] }>
  > => {
    const response = await axiosInstance.get(`${BASE}/my/enrollments`);
    return response.data;
  },

  myUpcomingSessions: async (): Promise<
    ApiResponse<{ sessions: CoachSessionOccurrence[] }>
  > => {
    const response = await axiosInstance.get(`${BASE}/my/sessions`);
    return response.data;
  },

  leave: async (
    enrollmentId: string,
    reason?: string,
  ): Promise<
    ApiResponse<{
      enrollment: CoachEnrollment;
      unusedSessions: number;
      /**
       * The refund is issued as part of leaving — the amount is computed from
       * the ledger, so it needs no approval. A FAILED status means it is frozen
       * and will be retried, not that the money is lost.
       */
      refund: {
        status:
          | "REFUNDED"
          | "NOTHING_OWED"
          | "NO_PAYMENT_FOUND"
          | "FAILED";
        amountPaise: number;
        refundId?: string;
      };
    }>
  > => {
    const response = await axiosInstance.post(
      `${BASE}/enrollments/${enrollmentId}/leave`,
      reason ? { reason } : {},
    );
    return response.data;
  },
};
