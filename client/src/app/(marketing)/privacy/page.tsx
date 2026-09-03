import type { Metadata } from "next";

import { LegalPageHeader } from "@/modules/shared/components/legal/LegalPageHeader";

import { Card } from "@/modules/shared/ui/Card";
import { Shield } from "lucide-react";

import {
  PrivacyToc,
  Introduction,
  InformationCollected,
  HowWeUseInformation,
  InformationSharing,
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
    <div className="min-h-screen bg-slate-50">
      <LegalPageHeader
        icon={Shield}
        title="Privacy Policy"
        lastUpdated="July 24, 2026"
        effective="July 24, 2026"
      />

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <PrivacyToc />
          <Card className="legal-content prose prose-slate max-w-none bg-white p-8 lg:col-start-2">
            <Introduction />
            <InformationCollected />
            <HowWeUseInformation />
            <InformationSharing />
            <DataRetention />
            <DataSecurity />
            <YourRights />
            <Cookies />
            <InternationalTransfers />
            <ChildrensPrivacy />
            <ThirdPartyLinks />
            <Changes />
            <GrievanceContact />
          </Card>
        </div>
      </div>
    </div>
  );
}
