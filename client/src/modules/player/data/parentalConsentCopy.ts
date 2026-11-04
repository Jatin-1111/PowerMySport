/**
 * The words a parent sees before the first child is added.
 *
 * DRAFT: wording is pending approval from the owner and counsel. It lives in one
 * file so approved text is a one-file change. Raise `PARENTAL_CONSENT_VERSION` on
 * the server whenever this meaning changes, so parents are asked again.
 */
export const PARENTAL_CONSENT_COPY = {
  title: "Before you add a child",
  intro:
    "A child's profile holds their name, date of birth and the sport details you give us. We use it to suggest sports and tournaments, and to book sessions you choose.",
  sharing:
    "An expert or coach sees a child's profile only for a session you book with them. Guidance that uses AI is sent without the child's name.",
  checkbox: "I am this child's parent or legal guardian, and I agree to the",
  policyLinkLabel: "Parental Consent & Minor Protection Policy",
  policyHref: "/parental-consent",
  agree: "Agree and continue",
  cancel: "Cancel",
} as const;
