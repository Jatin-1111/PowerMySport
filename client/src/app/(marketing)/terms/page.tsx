import type { Metadata } from "next";

import { LegalPageHeader } from "@/modules/shared/components/legal/LegalPageHeader";

import { Card } from "@/modules/shared/ui/Card";
import { FileText } from "lucide-react";

import {
  TermsToc,
  Agreement,
  Services,
  Account,
  FraudPrevention,
  Responsibilities,
  ExpertVerification,
  Booking,
  ExpertSessions,
  Ranking,
  Commission,
  Ip,
  Feedback,
  Prohibited,
  Warranties,
  Liability,
  Indemnification,
  Dispute,
  Grievance,
  Termination,
  Relationship,
  ForceMajeure,
  General,
  GoverningLaw,
  Contact,
} from "@/modules/legal/components/terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms and conditions governing use of PowerMySport's guidance, booking, expert sessions, and shop services.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LegalPageHeader
        icon={FileText}
        title="Terms of Service"
        lastUpdated="July 24, 2026"
        effective="July 24, 2026"
      />

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <TermsToc />
          <Card className="legal-content bg-white p-8 prose prose-slate max-w-none lg:col-start-2">
            <Agreement />
            <Services />
            <Account />
            <FraudPrevention />
            <Responsibilities />
            <ExpertVerification />
            <Booking />
            <ExpertSessions />
            <Ranking />
            <Commission />
            <Ip />
            <Feedback />
            <Prohibited />
            <Warranties />
            <Liability />
            <Indemnification />
            <Dispute />
            <Grievance />
            <Termination />
            <Relationship />
            <ForceMajeure />
            <General />
            <GoverningLaw />
            <Contact />
          </Card>
        </div>
      </div>
    </div>
  );
}
