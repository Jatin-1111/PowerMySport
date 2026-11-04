"use client";

import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/modules/shared/components/legal/LegalTableOfContents";
import {
  AlertTriangle,
  CalendarCheck,
  Gavel,
  HandCoins,
  Mail,
  Scale,
  ScrollText,
  ShieldAlert,
  Wallet,
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
  { id: "overview", label: "Overview", icon: ScrollText },
  { id: "cancellation-windows", label: "Cancellation & Refund Windows", icon: CalendarCheck },
  { id: "refund-processing", label: "Refund Processing", icon: Wallet },
  { id: "disputes-chargebacks", label: "Payment Disputes & Chargebacks", icon: ShieldAlert },
  { id: "special-cases", label: "Special Cases", icon: AlertTriangle },
  { id: "coach-venue-refunds", label: "Coach & Venue Refunds", icon: HandCoins },
  { id: "escalation-appeals", label: "Escalation & Appeals", icon: Gavel },
  { id: "contact-support", label: "Contact & Support", icon: Mail },
  { id: "statutory-rights", label: "Your Statutory Rights", icon: Scale },
];

export function RefundPolicyToc() {
  return <LegalTableOfContents items={ITEMS} />;
}
