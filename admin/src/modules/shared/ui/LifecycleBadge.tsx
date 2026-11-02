import { StatusBadge, type StatusTone } from "@/modules/shared/ui/StatusBadge";

/**
 * One set of status words for coaches, experts, venues and academies, the same
 * as the server's `lifecycle` field. Every admin list and detail view uses this
 * badge, so "Approved" means the same thing wherever an admin sees it.
 */
export type ProviderKind = "coach" | "expert" | "venue" | "academy";

const LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  NEEDS_INFO: "Needs information",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const TONE: Record<string, StatusTone> = {
  DRAFT: "slate",
  SUBMITTED: "amber",
  NEEDS_INFO: "blue",
  APPROVED: "green",
  REJECTED: "red",
  SUSPENDED: "slate",
};

/** What the badge can read: the server's `lifecycle`, or the older fields as a fallback. */
export interface LifecycleSource {
  lifecycle?: string | null;
  verificationStatus?: string | null;
  approvalStatus?: string | null;
  isActive?: boolean | null;
  isApproved?: boolean | null;
  kycVerified?: boolean | null;
  rejectionReason?: string | null;
}

/** The older fields mapped the way the server maps them, for records without `lifecycle`. */
export const lifecycleOf = (kind: ProviderKind, source: LifecycleSource): string => {
  if (source.lifecycle && LABEL[source.lifecycle]) return source.lifecycle;

  switch (kind) {
    case "coach":
      return (
        {
          VERIFIED: "APPROVED",
          PENDING: "SUBMITTED",
          REVIEW: "NEEDS_INFO",
          REJECTED: "REJECTED",
        }[source.verificationStatus ?? ""] ?? "DRAFT"
      );
    case "expert":
      if (source.verificationStatus === "APPROVED") {
        return source.isActive === false ? "SUSPENDED" : "APPROVED";
      }
      return (
        { PENDING: "SUBMITTED", REJECTED: "REJECTED" }[source.verificationStatus ?? ""] ?? "DRAFT"
      );
    case "venue":
      return (
        { APPROVED: "APPROVED", REVIEW: "NEEDS_INFO", REJECTED: "REJECTED" }[
          source.approvalStatus ?? ""
        ] ?? "SUBMITTED"
      );
    case "academy":
      if (source.isApproved) {
        if (source.isActive) return "APPROVED";
        return source.kycVerified ? "SUSPENDED" : "NEEDS_INFO";
      }
      return source.rejectionReason?.trim() ? "REJECTED" : "SUBMITTED";
  }
};

export function LifecycleBadge({
  kind,
  source,
  size,
}: {
  kind: ProviderKind;
  source: LifecycleSource;
  size?: "sm" | "md";
}) {
  const lifecycle = lifecycleOf(kind, source);
  return <StatusBadge status={LABEL[lifecycle]} tone={TONE[lifecycle]} size={size ?? "md"} />;
}
