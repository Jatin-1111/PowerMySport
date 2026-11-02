/** Where an academy stands in review. Mirrors the server's one provider vocabulary. */
export type AcademyLifecycle =
  "DRAFT" | "SUBMITTED" | "NEEDS_INFO" | "APPROVED" | "REJECTED" | "SUSPENDED";

/** The owner's own academy, from `GET /academies/my`. No bank, tax or document fields. */
export interface OwnAcademy {
  id: string;
  name: string;
  slug: string;
  city?: string;
  sports: string[];
  lifecycle: AcademyLifecycle;
  /** Highest onboarding step already saved, 0 to 7. */
  onboardingStep: number;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  kycVerified: boolean;
  isApproved: boolean;
  isActive: boolean;
  /** Present only while the listing is rejected. */
  rejectionReason?: string;
  venueCount: number;
  coachCount: number;
}

/** The overview block of `GET /academies/my/analytics`. */
export interface AcademyAnalyticsOverview {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  totalStudents: number;
  returningStudents: number;
  retentionRate: number;
  totalVenues: number;
  totalCoaches: number;
}

export interface AcademyAnalyticsSummary {
  overview: AcademyAnalyticsOverview;
}

export interface StatusAction {
  label: string;
  href: string;
}

/** Which list, if any, sits beside the status message. */
export type StatusSteps = "setup" | "review" | null;

/** How the status tag is coloured. Colour is never the only signal: the tag always has text. */
export type StatusTone = "neutral" | "pending" | "live" | "alert";

export interface StatusView {
  tone: StatusTone;
  /** Short word for the tag beside the academy name. */
  tag: string;
  headline: string;
  body: string;
  primary?: StatusAction;
  secondary?: StatusAction;
  steps: StatusSteps;
  /** Earnings and session figures only mean something once the academy has been live. */
  showFigures: boolean;
}
