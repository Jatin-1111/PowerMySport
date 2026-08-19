"use client";

import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/modules/shared/components/legal/LegalTableOfContents";
import {
  BadgeCheck,
  Ban,
  Baby,
  CalendarX,
  Copyright,
  FileSignature,
  Gavel,
  Handshake,
  Landmark,
  Lock,
  Mail,
  Megaphone,
  Percent,
  ReceiptIndianRupee,
  Scale,
  ScrollText,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

/**
 * The document's table of contents, declared in the same client module that
 * renders it.
 *
 * It used to live in the route and be passed to `LegalTableOfContents` as a
 * prop, which meant handing lucide icon components across the server/client
 * boundary. React rejects that and Next falls back to client-rendering the whole
 * page -- on a document that is meant to be indexed. Keeping the array here
 * keeps the icons inside the client graph, and keeps the route to composition.
 */
const ITEMS: LegalTocItem[] = [
  { id: "scope", label: "Scope & Acceptance", icon: ScrollText },
  { id: "definitions", label: "Who These Terms Cover", icon: Users },
  { id: "eligibility", label: "Eligibility & Onboarding", icon: UserCheck },
  { id: "verification", label: "Verification & Approval", icon: BadgeCheck },
  { id: "listing", label: "Listing & Profile Standards", icon: FileSignature },
  { id: "delivery", label: "Service Delivery Obligations", icon: Handshake },
  { id: "child-safety", label: "Child Safety & Minors", icon: Baby },
  { id: "commission", label: "Commission — 15% of Partner Fee", icon: Percent },
  { id: "payouts", label: "Payouts & Settlement", icon: Wallet },
  { id: "taxes", label: "Taxes, Invoicing & TDS", icon: ReceiptIndianRupee },
  {
    id: "cancellations",
    label: "Cancellations, Refunds & No-Shows",
    icon: CalendarX,
  },
  { id: "reviews", label: "Reviews & Ratings", icon: Star },
  { id: "circumvention", label: "Non-Circumvention", icon: Ban },
  { id: "relationship", label: "Independent Contractor Status", icon: Scale },
  { id: "data", label: "Confidentiality & Data Protection", icon: Lock },
  { id: "ip", label: "Brand, Content & Marketing Licence", icon: Copyright },
  {
    id: "insurance",
    label: "Insurance, Indemnity & Liability",
    icon: ShieldCheck,
  },
  { id: "termination", label: "Suspension, Termination & Exit", icon: XCircle },
  { id: "grievance", label: "Grievance Redressal", icon: Megaphone },
  { id: "disputes", label: "Governing Law & Disputes", icon: Gavel },
  { id: "amendments", label: "Amendments & General", icon: Landmark },
  { id: "contact", label: "Contact Information", icon: Mail },
];

export function PartnerTermsToc() {
  return <LegalTableOfContents items={ITEMS} />;
}
