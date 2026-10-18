import type { Metadata } from "next";

import { LegalPageHeader } from "@/modules/shared/components/legal/LegalPageHeader";

import Link from "next/link";

import {
  PartnerTermsToc,
  Scope,
  Definitions,
  Eligibility,
  Verification,
  Listing,
  Delivery,
  ChildSafety,
  Commission,
  Payouts,
  Taxes,
  Cancellations,
  Reviews,
  Circumvention,
  Relationship,
  Data,
  Ip,
  Insurance,
  Termination,
  Grievance,
  Disputes,
  Amendments,
  Contact,
} from "@/modules/legal/components/partner-terms";

export const metadata: Metadata = {
  title: "Partner Terms for Experts & Academies",
  description:
    "Onboarding terms and conditions for Experts and Academies on PowerMySport, including the 15% platform commission, payout timelines, verification, and termination.",
  alternates: {
    canonical: "/partner-terms",
  },
};

export default function PartnerTermsPage() {
  return (
    <div className="bg-paper min-h-screen">
      <LegalPageHeader
        title="Partner Terms for Experts & Academies"
        lastUpdated="August 11, 2026"
        effective="August 11, 2026"
      />

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <PartnerTermsToc />
          <div className="legal-content max-w-[72ch] lg:col-start-2">
            <Scope />
            <Definitions />
            <Eligibility />
            <Verification />
            <Listing />
            <Delivery />
            <ChildSafety />
            <Commission />
            <Payouts />
            <Taxes />
            <Cancellations />
            <Reviews />
            <Circumvention />
            <Relationship />
            <Data />
            <Ip />
            <Insurance />
            <Termination />
            <Grievance />
            <Disputes />
            <Amendments />
            <Contact />
          </div>
        </div>
      </div>
    </div>
  );
}
