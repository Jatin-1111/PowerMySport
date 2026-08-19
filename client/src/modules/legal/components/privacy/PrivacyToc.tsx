"use client";

import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/modules/shared/components/legal/LegalTableOfContents";
import {
  Building2,
  Clock,
  Compass,
  Cookie,
  FileText,
  Fingerprint,
  Handshake,
  ListChecks,
  Lock,
  Megaphone,
  ScrollText,
  Settings2,
  Users,
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
  { id: "introduction", label: "Introduction", icon: ScrollText },
  { id: "information-collected", label: "Information We Collect", icon: Fingerprint },
  { id: "how-we-use-information", label: "How We Use Your Information", icon: Settings2 },
  { id: "information-sharing", label: "Information Sharing and Disclosure", icon: Handshake },
  { id: "data-retention", label: "Data Retention", icon: Clock },
  { id: "data-security", label: "Data Security", icon: Lock },
  { id: "your-rights", label: "Your Rights", icon: ListChecks },
  { id: "cookies", label: "Cookies and Tracking", icon: Cookie },
  { id: "international-transfers", label: "International Data Transfers", icon: Compass },
  { id: "childrens-privacy", label: "Children's Privacy", icon: Users },
  { id: "third-party-links", label: "Third-Party Links", icon: Building2 },
  { id: "changes", label: "Changes to This Policy", icon: FileText },
  { id: "grievance-contact", label: "Grievance Officer & Contact", icon: Megaphone },
];

export function PrivacyToc() {
  return <LegalTableOfContents items={ITEMS} />;
}
