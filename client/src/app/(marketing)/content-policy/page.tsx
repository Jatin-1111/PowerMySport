import { LegalPageHeader } from "@/modules/shared/components/legal/LegalPageHeader";

import { Card } from "@/modules/shared/ui/Card";
import { Flag } from "lucide-react";

import type { Metadata } from "next";

import {
  ContentPolicyToc,
  Overview,
  ContentTypes,
  AcceptableContent,
  ProhibitedContent,
  ReviewRules,
  PhotoVideo,
  Messages,
  ModerationProcess,
  Appeals,
  AccountConsequences,
  IpRights,
  ContactSupport,
} from "@/modules/legal/components/content-policy";

export const metadata: Metadata = {
  title: "Content Policy",
  description:
    "PowerMySport's content policy covering community guidelines, prohibited content, and moderation on the PowerMySport platform.",
  alternates: {
    canonical: "/content-policy",
  },
};

export default function ContentPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LegalPageHeader
        icon={Flag}
        title="User Generated Content & Moderation Policy"
        lastUpdated="July 24, 2026"
        effective="July 24, 2026"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <ContentPolicyToc />
          <Card className="legal-content bg-white p-8 prose prose-lg max-w-none lg:col-start-2">
          <Overview />
          <ContentTypes />
          <AcceptableContent />
          <ProhibitedContent />
          <ReviewRules />
          <PhotoVideo />
          <Messages />
          <ModerationProcess />
          <Appeals />
          <AccountConsequences />
          <IpRights />
          <ContactSupport />

          <section className="mt-12 pt-8 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              This Content Policy may be updated at any time. Continued use of
              PowerMySport means you accept the current policy. Major changes
              will be communicated 30 days in advance.
            </p>
          </section>
          </Card>
        </div>
      </div>
    </div>
  );
}
