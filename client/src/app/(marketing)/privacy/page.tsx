"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowLeft, Mail, Shield } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4 -ml-2">
              <ArrowLeft size={18} className="mr-2" />
              Back to Home
            </Button>
          </Link>

          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <Shield size={32} className="text-power-orange" />
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  Legal
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                Privacy Policy
              </h1>
              <p className="text-slate-200 text-base sm:text-lg max-w-2xl">
                Last updated: February 18, 2026 | Effective: February 18, 2026
              </p>
            </div>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/20 blur-3xl" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-white p-8 prose prose-slate max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Introduction
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Welcome to PowerMySport ("we," "our," or "us"). We are committed
              to protecting your privacy and ensuring the security of your
              personal information. This Privacy Policy explains how we collect,
              use, disclose, and safeguard your information when you use our
              platform.
            </p>
            <p className="text-slate-600 leading-relaxed">
              By using PowerMySport, you agree to the collection and use of
              information in accordance with this policy. If you do not agree
              with the terms of this Privacy Policy, please do not access the
              platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Information We Collect
            </h2>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Personal Information
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Name, email address, and phone number</li>
              <li>Account credentials (username and password)</li>
              <li>
                Payment information (processed securely through our payment
                gateway)
              </li>
              <li>Profile information and preferences</li>
              <li>Dependent information (for parent accounts)</li>
              <li>
                Business documents and certifications (for venue listers and
                coaches)
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Usage Information
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Booking history and preferences</li>
              <li>Search queries and browsing behavior</li>
              <li>
                Device information (IP address, browser type, operating system)
              </li>
              <li>Location data (with your permission)</li>
              <li>Communication preferences and history</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              How We Use Your Information
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We use the collected information for various purposes:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>To provide, maintain, and improve our services</li>
              <li>To process bookings and payments</li>
              <li>To send booking confirmations and updates</li>
              <li>
                To communicate with you about your account or transactions
              </li>
              <li>To provide customer support</li>
              <li>To detect and prevent fraud or unauthorized activities</li>
              <li>To comply with legal obligations</li>
              <li>To send marketing communications (with your consent)</li>
              <li>To analyze usage patterns and improve user experience</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Information Sharing and Disclosure
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We may share your information in the following circumstances:
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              With Service Providers
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              We share information with third-party service providers who
              perform services on our behalf, such as payment processing, data
              analysis, email delivery, and customer service.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              With Venue Owners and Coaches
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              When you make a booking, we share necessary information (name,
              contact details, booking details) with the relevant venue owner or
              coach to fulfill your booking.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Legal Reasons
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              We may disclose your information if required by law or if we
              believe such action is necessary to comply with legal obligations,
              protect our rights, or ensure safety.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Data Security
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We implement appropriate technical and organizational security
              measures to protect your personal information against unauthorized
              access, alteration, disclosure, or destruction. These measures
              include:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Encryption of sensitive data in transit and at rest</li>
              <li>Secure payment processing through certified gateways</li>
              <li>Regular security audits and assessments</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Employee training on data protection practices</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Your Rights
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              You have the following rights regarding your personal information:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                <strong>Access:</strong> You can request access to your personal
                information
              </li>
              <li>
                <strong>Correction:</strong> You can update or correct
                inaccurate information
              </li>
              <li>
                <strong>Deletion:</strong> You can request deletion of your
                account and associated data
              </li>
              <li>
                <strong>Data Portability:</strong> You can request a copy of
                your data in a portable format
              </li>
              <li>
                <strong>Opt-out:</strong> You can opt-out of marketing
                communications at any time
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Cookies and Tracking
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We use cookies and similar tracking technologies to improve your
              experience on our platform. You can control cookie preferences
              through your browser settings. Note that disabling cookies may
              affect some functionality of the platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Children's Privacy
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Our platform is not intended for children under 13 years of age.
              While parents can create dependent profiles for their children, we
              do not knowingly collect personal information directly from
              children under 13 without parental consent.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Changes to This Policy
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by posting the new Privacy Policy on
              this page and updating the "Last updated" date. You are advised to
              review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Contact Us
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us:
            </p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-700 flex items-center gap-2 mb-2">
                <Mail size={18} className="text-power-orange" />
                <strong>Email:</strong> privacy@powermysport.com
              </p>
              <p className="text-slate-700">
                <strong>Address:</strong> PowerMySport HQ, Sports Complex Road,
                Your City, Country
              </p>
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
}
