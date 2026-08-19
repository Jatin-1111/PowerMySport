"use client";

import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/modules/shared/components/legal/LegalTableOfContents";
import {
  Ban,
  Camera,
  Copyright,
  Gavel,
  Layers,
  ListChecks,
  Mail,
  MessageCircle,
  MessageSquarePlus,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
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
  { id: "content-types", label: "Types of User-Generated Content", icon: Layers },
  { id: "acceptable-content", label: "Acceptable Content Guidelines", icon: ListChecks },
  { id: "prohibited-content", label: "Prohibited Content", icon: Ban },
  { id: "review-rules", label: "Review & Rating Specific Rules", icon: MessageSquarePlus },
  { id: "photo-video", label: "Photo & Video Guidelines", icon: Camera },
  { id: "messages", label: "Private Messages & Communication", icon: MessageCircle },
  { id: "moderation-process", label: "Content Moderation Process", icon: ShieldCheck },
  { id: "appeals", label: "Appeals & Disputes", icon: Gavel },
  { id: "account-consequences", label: "Account Consequences", icon: ShieldAlert },
  { id: "ip-rights", label: "Intellectual Property Rights", icon: Copyright },
  { id: "contact-support", label: "Contact & Support", icon: Mail },
];

export function ContentPolicyToc() {
  return <LegalTableOfContents items={ITEMS} />;
}
