import {
  ACADEMY_STEPS,
  LAST_ACADEMY_STEP,
  academyStepTitle,
  resumeStepFor,
} from "@/modules/onboarding/utils/academySteps";
import type { OwnAcademy, StatusView } from "../types";

const ONBOARDING = "/academy/onboarding";

/**
 * The setup form finds the academy to resume from the URL or from an id the
 * browser stored when the sign-up began. A signed-in owner on another device
 * has neither, and would get a blank first step that starts a second academy.
 * Passing the id makes the form load the one this account owns.
 */
const setupHref = (academy: OwnAcademy): string => `${ONBOARDING}?resumeId=${academy.id}`;

/**
 * Turns where the academy stands into one message and one next action.
 *
 * Every state names what is true, what happens next, and who has to act. The
 * owner is only ever sent to a page when there is something for them to do
 * there; while we are the ones acting (review, verification), the only action
 * offered is looking at their own details.
 */
export const describeAcademyStatus = (academy: OwnAcademy | null): StatusView => {
  if (!academy || (academy.lifecycle === "DRAFT" && academy.onboardingStep < 1)) {
    return {
      tone: "neutral",
      tag: "Not started",
      headline: "Set up your academy",
      body: `Setup has ${ACADEMY_STEPS.length} steps, from your details to payouts. Each step saves as you go.`,
      primary: { label: "Start setup", href: ONBOARDING },
      steps: "setup",
      showFigures: false,
    };
  }

  switch (academy.lifecycle) {
    case "DRAFT": {
      const next = resumeStepFor(academy.onboardingStep);
      const saved = Math.min(academy.onboardingStep, LAST_ACADEMY_STEP);
      return {
        tone: "neutral",
        tag: "Setup in progress",
        headline: `${saved} of ${LAST_ACADEMY_STEP} steps saved`,
        body: `Next is ${academyStepTitle(next).toLowerCase()}. We start reviewing your academy once every step is done and submitted.`,
        primary: {
          label: `Continue with ${academyStepTitle(next).toLowerCase()}`,
          href: setupHref(academy),
        },
        steps: "setup",
        showFigures: false,
      };
    }

    case "SUBMITTED":
      return {
        tone: "pending",
        tag: "In review",
        headline: "Your academy is in review",
        body: "We check the details and documents you submitted before switching your academy on. This page updates as soon as there is a decision.",
        secondary: { label: "Review your details", href: "/academy/settings" },
        steps: "review",
        showFigures: false,
      };

    case "NEEDS_INFO":
      return {
        tone: "pending",
        tag: "Approved, not live",
        headline: "Approved. One check is left before you go live",
        body: "We are finishing verification for your academy. Bookings open as soon as that is done.",
        secondary: { label: "Review your details", href: "/academy/settings" },
        steps: null,
        showFigures: false,
      };

    case "REJECTED":
      return {
        tone: "alert",
        tag: "Needs changes",
        headline: "Your academy needs changes before it can go live",
        body: academy.rejectionReason
          ? "This is what our team asked you to fix. Update your details, then submit again."
          : "Our team asked for changes. Update your details, then submit again.",
        primary: { label: "Update your details", href: setupHref(academy) },
        steps: null,
        showFigures: false,
      };

    case "SUSPENDED":
      return {
        tone: "alert",
        tag: "Paused",
        headline: "Your academy is paused",
        body: "New bookings are switched off for now. Contact us to find out why and what happens next.",
        primary: { label: "Contact support", href: "/contact" },
        steps: null,
        // A paused academy can still be owed money for sessions it already ran.
        showFigures: true,
      };

    case "APPROVED":
    default:
      return {
        tone: "live",
        tag: "Live",
        headline: "Your academy is live",
        body: "",
        primary: academy.slug
          ? { label: "View public profile", href: `/academies/${academy.slug}` }
          : undefined,
        steps: null,
        showFigures: true,
      };
  }
};

/** Whether an earnings or analytics request is worth making for this academy. */
export const hasFigures = (academy: OwnAcademy | null): boolean =>
  academy ? describeAcademyStatus(academy).showFigures : false;
