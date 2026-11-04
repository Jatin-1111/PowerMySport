"use client";

import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/modules/shared/components/legal/LegalTableOfContents";
import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CloudLightning,
  Copyright,
  Gavel,
  HandCoins,
  Handshake,
  Landmark,
  Layers,
  ListChecks,
  ListOrdered,
  Mail,
  Megaphone,
  MessageSquarePlus,
  Percent,
  Scale,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldOff,
  UserPlus,
  Video,
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
  { id: "agreement", label: "Agreement to Terms", icon: ScrollText },
  { id: "services", label: "Description of Services", icon: Layers },
  { id: "account", label: "Account Registration", icon: UserPlus },
  {
    id: "fraud-prevention",
    label: "Fraud Prevention & Account Security",
    icon: ShieldAlert,
  },
  { id: "responsibilities", label: "User Responsibilities", icon: ListChecks },
  {
    id: "expert-verification",
    label: "Expert Verification & Onboarding",
    icon: BadgeCheck,
  },
  { id: "booking", label: "Booking and Payments", icon: CalendarCheck },
  { id: "expert-sessions", label: "Expert Sessions", icon: Video },
  {
    id: "ranking",
    label: "Search Results, Rankings & Recommendations",
    icon: ListOrdered,
  },
  { id: "commission", label: "Commission and Fees", icon: Percent },
  { id: "ip", label: "Intellectual Property", icon: Copyright },
  {
    id: "feedback",
    label: "Feedback and Suggestions",
    icon: MessageSquarePlus,
  },
  { id: "prohibited", label: "Prohibited Activities", icon: Ban },
  { id: "warranties", label: "Disclaimer of Warranties", icon: ShieldOff },
  { id: "liability", label: "Limitation of Liability", icon: Scale },
  { id: "indemnification", label: "Indemnification", icon: HandCoins },
  { id: "dispute", label: "Dispute Resolution and Arbitration", icon: Gavel },
  { id: "grievance", label: "Grievance Redressal", icon: Megaphone },
  { id: "termination", label: "Termination", icon: XCircle },
  { id: "relationship", label: "Relationship of Parties", icon: Handshake },
  { id: "force-majeure", label: "Force Majeure", icon: CloudLightning },
  { id: "general", label: "General Provisions", icon: Settings2 },
  { id: "governing-law", label: "Governing Law", icon: Landmark },
  { id: "contact", label: "Contact Information", icon: Mail },
];

export function TermsToc() {
  return <LegalTableOfContents items={ITEMS} />;
}
