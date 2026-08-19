import { LegalPageHeader } from "@/modules/shared/components/legal/LegalPageHeader";

import { Card } from "@/modules/shared/ui/Card";
import { Wallet } from "lucide-react";

import type { Metadata } from "next";

import {
  RefundPolicyToc,
  Overview,
  CancellationWindows,
  RefundProcessing,
  DisputesChargebacks,
  SpecialCases,
  CoachVenueRefunds,
  EscalationAppeals,
  ContactSupport,
  StatutoryRights,
} from "@/modules/legal/components/refund-policy";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "PowerMySport's refund and cancellation policy for bookings, sessions, subscriptions, and shop orders.",
  alternates: {
    canonical: "/refund-policy",
  },
};

export default function RefundPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LegalPageHeader
        icon={Wallet}
        title="Cancellation, Refund & Dispute Policy"
        lastUpdated="July 24, 2026"
        effective="July 24, 2026"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <RefundPolicyToc />
          <Card className="legal-content bg-white p-8 prose prose-lg max-w-none lg:col-start-2">
          <Overview />
          <CancellationWindows />
          <RefundProcessing />
          <DisputesChargebacks />
          <SpecialCases />
          <CoachVenueRefunds />
          <EscalationAppeals />
          <ContactSupport />
          <StatutoryRights />

          <section className="mt-12 pt-8 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              This policy may be amended by PowerMySport at any time and at
              its sole discretion. Changes take effect immediately upon
              posting; continued use of the Platform or submission of a
              booking after posting constitutes acceptance of the revised
              policy. This policy, along with the Terms of Service and Privacy
              Policy, is the entire and exclusive statement of PowerMySport&apos;s
              obligations regarding cancellations, refunds, and disputes,
              subject always to Section 9 above.
            </p>
          </section>
          </Card>
        </div>
      </div>
    </div>
  );
}
