import type { Metadata } from "next";

import { LegalPageHeader } from "@/modules/shared/components/legal/LegalPageHeader";

import {
  PrivacyToc,
  Introduction,
  InformationCollected,
  HowWeUseInformation,
  InformationSharing,
  AiProcessing,
  DataRetention,
  DataSecurity,
  YourRights,
  Cookies,
  InternationalTransfers,
  ChildrensPrivacy,
  ThirdPartyLinks,
  Changes,
  GrievanceContact,
} from "@/modules/legal/components/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How PowerMySport collects, uses, and protects your personal data across guidance, booking, and shop features.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-paper min-h-screen">
      <LegalPageHeader
        title="Privacy Policy"
        lastUpdated="October 25, 2026"
        // TODO(owner + lawyer): decide the effective date of the AI section. Only
        // "last updated" moved with it.
        effective="July 24, 2026"
      />

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <PrivacyToc />
          <div className="legal-content max-w-[72ch] lg:col-start-2">
            <Introduction />
            <InformationCollected />
            <HowWeUseInformation />
            <InformationSharing />
            <AiProcessing />
            <DataRetention />
            <DataSecurity />
            <YourRights />
            <Cookies />
            <InternationalTransfers />
            <ChildrensPrivacy />
            <ThirdPartyLinks />
            <Changes />
            <GrievanceContact />
          </div>
        </div>
      </div>
    </div>
  );
}
