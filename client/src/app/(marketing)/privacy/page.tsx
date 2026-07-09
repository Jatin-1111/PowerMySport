"use client";

import { Card } from "@/modules/shared/ui/Card";
import { Mail, Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                Last updated: July 9, 2026 | Effective: July 9, 2026
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
              Welcome to PowerMySport (&quot;we,&quot; &quot;our,&quot; or
              &quot;us&quot;), operated by Powermysport Pvt. Ltd. This Privacy
              Policy explains how we collect, use, disclose, retain, and
              safeguard information when you use our platform (the
              &quot;Platform&quot;). It forms part of, and is incorporated by
              reference into, our Terms of Service.
            </p>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using the Platform, you consent to the
              collection, use, and disclosure of your information as
              described in this Policy. If you do not agree with any part of
              this Policy, you must not access or use the Platform. We may
              revise this Policy at any time, at our sole discretion, by
              posting the updated version with a new &quot;Last updated&quot;
              date; continued use of the Platform after such posting
              constitutes your acceptance of the revised Policy. We are not
              obligated to notify you individually of non-material changes.
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
              We collect information that you provide directly to us,
              including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Name, email address, and phone number</li>
              <li>Account credentials (username and password)</li>
              <li>
                Payment information (processed securely through our payment
                gateway; we do not store full card details)
              </li>
              <li>Profile information and preferences</li>
              <li>Dependent information (for parent/guardian accounts)</li>
              <li>
                Business documents, government identifiers, bank/payout
                details, and certifications (for venue listers and coaches)
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Usage Information
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Booking history and preferences</li>
              <li>Search queries and browsing behavior</li>
              <li>
                Device and technical information (IP address, browser type,
                operating system, device identifiers)
              </li>
              <li>Location data (with your permission)</li>
              <li>Communication preferences and history</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              You are solely responsible for ensuring that any information you
              provide, including about a dependent or on behalf of a business,
              is accurate and that you are legally authorized to provide it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              How We Use Your Information
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We use the collected information for purposes including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>To provide, maintain, and improve our services</li>
              <li>To process bookings and payments</li>
              <li>To send booking confirmations and updates</li>
              <li>
                To communicate with you about your account or transactions
              </li>
              <li>To provide customer support</li>
              <li>
                To detect, investigate, and prevent fraud, abuse, or
                unauthorized activity, including sharing information with
                fraud-prevention and law-enforcement bodies where necessary
              </li>
              <li>To comply with legal, regulatory, and tax obligations</li>
              <li>To send marketing communications (you may opt out at any time)</li>
              <li>To analyze usage patterns and improve user experience</li>
              <li>To enforce our Terms of Service and this Policy</li>
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
              perform services on our behalf, such as payment processing,
              hosting, data analysis, email delivery, and customer support. We
              require these providers to protect your information, but we are
              not responsible for their independent privacy or security
              practices.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              With Venue Owners and Coaches
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              When you make a booking, we share necessary information (name,
              contact details, booking details) with the relevant venue owner
              or coach solely to fulfill your booking. Once shared, that
              party&apos;s use of your information is governed by their own
              practices, for which PowerMySport bears no responsibility. You
              are responsible for exercising discretion in any direct
              communication with them.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Legal and Safety Reasons
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              We may disclose your information, without further notice to
              you, where we believe in good faith that disclosure is necessary
              to comply with a legal obligation, court order, or governmental
              request, to enforce our Terms, to protect our rights, property,
              or safety, or the rights, property, or safety of any user or
              third party, or in connection with a fraud or security
              investigation.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Business Transfers
            </h3>
            <p className="text-slate-600 leading-relaxed">
              In the event of a merger, acquisition, restructuring, or sale of
              assets, your information may be transferred to the successor
              entity, which will continue to be bound by the terms of this
              Policy or a materially similar one.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Data Retention
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We retain personal information for as long as your account
              remains active and thereafter for as long as reasonably
              necessary to fulfil the purposes described in this Policy,
              including to comply with our legal, accounting, and tax
              obligations (which may require retention of financial and
              transaction records for up to eight years), resolve disputes,
              enforce our agreements, and prevent fraud. We may retain
              anonymized or aggregated data indefinitely.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Data Security
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We implement technical and organizational security measures,
              consistent with the reasonable security practices standard under
              the Information Technology Act, 2000 and the rules made
              thereunder, designed to protect your personal information
              against unauthorized access, alteration, disclosure, or
              destruction, including:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li>Encryption of sensitive data in transit, and at rest where we have implemented it for that data category</li>
              <li>Secure payment processing through certified gateways</li>
              <li>Periodic security review of our systems</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Personnel training on data protection practices</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mb-4">
              We are working to extend at-rest encryption to additional
              categories of sensitive information (such as bank account and
              payout details) not yet covered by it.
            </p>
            <p className="text-slate-600 leading-relaxed">
              No method of transmission over the internet or electronic
              storage is completely secure. While we take commercially
              reasonable steps to protect your information, we cannot and do
              not guarantee its absolute security, and you provide information
              to us at your own risk. You are responsible for keeping your
              account credentials confidential.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Your Rights
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Subject to applicable law and verification of your identity, you
              may exercise the following rights by writing to our Grievance
              Officer at the contact details below. We will endeavor to
              respond within thirty (30) days:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                <strong>Access:</strong> Request access to the personal
                information we hold about you
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate
                information
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your account
                and associated personal data
              </li>
              <li>
                <strong>Data Portability:</strong> Request a copy of the data
                we hold about you, which we will provide within a reasonable
                time in a commonly used electronic format
              </li>
              <li>
                <strong>Opt-out:</strong> Opt out of marketing communications
                at any time
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              We may decline or limit a request where retention or disclosure
              is required or permitted by law, to protect against fraud, to
              resolve an active dispute or booking, or to enforce our
              agreements. We reserve the right to charge a reasonable fee for
              manifestly unfounded, repetitive, or excessive requests.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Cookies and Tracking
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We use essential and functional cookies to keep you signed in,
              maintain session security, and support core platform features.
              We do not currently use third-party advertising cookies. You can
              control or disable cookies through your browser settings, but
              doing so may impair or disable login, booking, and other core
              functionality, for which PowerMySport bears no responsibility.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              International Data Transfers
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Your information may be stored and processed on servers located
              within or outside India, including by third-party service
              providers. By using the Platform, you consent to such transfer,
              storage, and processing, which will remain subject to this
              Policy regardless of location. Once the relevant provisions of
              the Digital Personal Data Protection Act, 2023 come into force,
              we will not transfer personal data to any country or territory
              restricted by the Central Government of India.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Children&apos;s Privacy
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Under Indian law, a &quot;child&quot; is anyone under 18 years
              of age. The Platform is not intended for direct self-registration
              by children; a child may only be represented on the Platform
              through a dependent profile created and controlled by a parent
              or legal guardian, who provides consent on the child&apos;s
              behalf as described in our Parental Consent &amp; Minor
              Protection Policy. We do not knowingly collect personal
              information directly from a child outside of that parent-managed
              flow.
            </p>
            <p className="text-slate-600 leading-relaxed">
              We do not use a dependent profile&apos;s data for behavioural
              tracking, profiling, or targeted advertising. Parents and
              guardians are solely responsible for the accuracy of the
              information provided for a dependent and for supervising the
              minor&apos;s participation in any booked activity. We reserve
              the right to terminate any account found to violate this
              section.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Third-Party Links
            </h2>
            <p className="text-slate-600 leading-relaxed">
              The Platform may contain links to third-party websites or
              services not operated by us. We are not responsible for the
              privacy practices or content of any third party, and this
              Policy does not apply to them. Access any linked site at your
              own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Changes to This Policy
            </h2>
            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy at any time, at our sole
              discretion. Updates are effective immediately upon posting to
              this page with a revised &quot;Last updated&quot; date. Your
              continued use of the Platform after any update constitutes your
              binding acceptance of the revised Policy. You are responsible
              for reviewing this Policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Grievance Officer &amp; Contact
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In accordance with the Information Technology (Intermediary
              Guidelines and Digital Media Ethics Code) Rules, 2021 and the
              Consumer Protection (E-Commerce) Rules, 2020, the Grievance
              Officer for privacy, data, and platform-related complaints can
              be reached at the details below. We will acknowledge your
              complaint within 24 hours and endeavor to redress it within 15
              days (or, for e-commerce/booking-related complaints, within one
              month) of receipt.
            </p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-700 flex items-center gap-2 mb-2">
                <Mail size={18} className="text-power-orange" />
                <strong>Grievance Officer Email:</strong> teams@powermysport.com
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> +91 89685 82443
              </p>
              <p className="text-slate-700">
                <strong>Address:</strong> Mullanpur, Punjab.
              </p>
            </div>
            <p className="text-slate-600 leading-relaxed mt-4">
              If you are not satisfied with our resolution, you may, once the
              relevant provisions of the Digital Personal Data Protection Act,
              2023 come into force, escalate a personal-data complaint to the
              Data Protection Board of India after first raising it with us.
            </p>
          </section>
        </Card>
      </div>
    </div>
  );
}
