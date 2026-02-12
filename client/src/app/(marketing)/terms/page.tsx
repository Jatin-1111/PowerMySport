"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { ArrowLeft, FileText, Mail } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
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
                <FileText size={32} className="text-power-orange" />
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  Legal
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                Terms of Service
              </h1>
              <p className="text-slate-200 text-base sm:text-lg max-w-2xl">
                Last updated: February 12, 2026
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
              Agreement to Terms
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Welcome to PowerMySport. By accessing or using our platform, you
              agree to be bound by these Terms of Service ("Terms"). Please read
              these Terms carefully before using our services.
            </p>
            <p className="text-slate-600 leading-relaxed">
              If you do not agree to these Terms, you may not access or use our
              platform. We reserve the right to modify these Terms at any time,
              and such modifications will be effective immediately upon posting.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Description of Services
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              PowerMySport is a hyperlocal platform that connects:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                <strong>Players:</strong> Individuals seeking sports venues and
                coaching services
              </li>
              <li>
                <strong>Venue Listers:</strong> Owners/operators of sports
                facilities
              </li>
              <li>
                <strong>Coaches:</strong> Professional sports trainers and
                instructors
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              We provide the platform and facilitate bookings, but we are not
              directly responsible for the quality of venues or coaching
              services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Account Registration
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              To use certain features of our platform, you must create an
              account. You agree to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Be responsible for all activities under your account</li>
              <li>Not create multiple accounts or share your account</li>
              <li>
                Be at least 18 years old (parents can create dependent profiles
                for minors)
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              User Responsibilities
            </h2>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For All Users
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Comply with all applicable laws and regulations</li>
              <li>Respect other users and maintain professional conduct</li>
              <li>Not engage in fraudulent or deceptive practices</li>
              <li>Not misuse the platform or interfere with its operation</li>
              <li>Maintain accurate profile information</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Players
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Honor confirmed bookings or cancel according to policy</li>
              <li>Arrive on time for scheduled sessions</li>
              <li>Respect venue rules and coach instructions</li>
              <li>Provide honest reviews and feedback</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Venue Listers
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Provide accurate venue information and photos</li>
              <li>Maintain facilities in good condition</li>
              <li>Honor confirmed bookings</li>
              <li>Provide authentic documentation during onboarding</li>
              <li>Update availability and pricing promptly</li>
              <li>Comply with safety standards and regulations</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Coaches
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Provide valid certifications and credentials</li>
              <li>Maintain professional conduct at all times</li>
              <li>Honor confirmed coaching sessions</li>
              <li>Ensure safety during training sessions</li>
              <li>Update availability and rates accurately</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Booking and Payments
            </h2>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Booking Process
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>All bookings are subject to availability</li>
              <li>Bookings are confirmed only after successful payment</li>
              <li>
                You will receive a confirmation email with booking details
              </li>
              <li>
                Split payments (venue + coach) are processed automatically
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Payment Terms
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>All prices are displayed in Indian Rupees (INR)</li>
              <li>Payment must be completed at the time of booking</li>
              <li>
                We accept major credit/debit cards, UPI, and digital wallets
              </li>
              <li>
                Service charges and platform fees are clearly disclosed before
                payment
              </li>
              <li>
                Venue listers and coaches receive payments after booking
                completion
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Cancellation and Refunds
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                Cancellations must be made according to the cancellation policy
                (typically 24-48 hours in advance)
              </li>
              <li>
                Refunds are processed within 5-7 business days of cancellation
                approval
              </li>
              <li>Late cancellations may result in partial or no refund</li>
              <li>No-shows are not eligible for refunds</li>
              <li>
                In case of venue/coach unavailability, full refunds are provided
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Commission and Fees
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              PowerMySport charges a commission on successful bookings:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                Venue listers: Commission percentage is disclosed in your
                agreement
              </li>
              <li>
                Coaches: Commission percentage is disclosed in your agreement
              </li>
              <li>Payment processing fees may apply</li>
              <li>Commission structure may be updated with notice</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Intellectual Property
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              All content on PowerMySport, including but not limited to text,
              graphics, logos, images, and software, is the property of
              PowerMySport or its licensors and is protected by intellectual
              property laws.
            </p>
            <p className="text-slate-600 leading-relaxed">
              You may not copy, reproduce, distribute, or create derivative
              works without our express written permission. When you upload
              content (photos, descriptions), you grant us a license to use,
              display, and distribute that content on our platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Prohibited Activities
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Use the platform for any illegal purpose</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Submit false or misleading information</li>
              <li>Attempt to bypass security features</li>
              <li>Scrape or harvest data from the platform</li>
              <li>Interfere with the proper functioning of the platform</li>
              <li>Impersonate others or misrepresent your affiliation</li>
              <li>Circumvent the platform to make direct bookings</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Disclaimer of Warranties
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT
              WARRANT THAT:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>The platform will be uninterrupted or error-free</li>
              <li>Defects will be corrected</li>
              <li>The platform is free of viruses or harmful components</li>
              <li>
                The accuracy or reliability of information provided by third
                parties
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Limitation of Liability
            </h2>
            <p className="text-slate-600 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, POWERMYSPORT SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
              INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY SHALL NOT
              EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRIOR
              TO THE EVENT GIVING RISE TO LIABILITY.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Indemnification
            </h2>
            <p className="text-slate-600 leading-relaxed">
              You agree to indemnify and hold harmless PowerMySport, its
              officers, directors, employees, and agents from any claims,
              damages, losses, liabilities, and expenses (including legal fees)
              arising out of your use of the platform, violation of these Terms,
              or infringement of any rights of another party.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Dispute Resolution
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In the event of any dispute arising out of or relating to these
              Terms or the use of our platform:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>First, contact our support team to resolve the issue</li>
              <li>
                If unresolved, disputes will be settled through binding
                arbitration
              </li>
              <li>
                The arbitration will be conducted in accordance with the rules
                of the jurisdiction
              </li>
              <li>
                You waive your right to participate in class action lawsuits
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Termination
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We reserve the right to suspend or terminate your account at any
              time for:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li>Violation of these Terms</li>
              <li>Fraudulent or illegal activities</li>
              <li>Non-payment or chargebacks</li>
              <li>Abusive behavior toward other users or staff</li>
              <li>Any other reason at our sole discretion</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              Upon termination, your right to use the platform will immediately
              cease. You may also delete your account at any time through your
              account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Governing Law
            </h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by and construed in accordance with
              the laws of India, without regard to its conflict of law
              provisions. Any legal action or proceeding arising under these
              Terms will be brought exclusively in the courts located in [Your
              City], India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Contact Information
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              For questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-700 flex items-center gap-2 mb-2">
                <Mail size={18} className="text-power-orange" />
                <strong>Email:</strong> legal@powermysport.com
              </p>
              <p className="text-slate-700">
                <strong>Address:</strong> PowerMySport HQ, Sports Complex Road,
                Your City, India
              </p>
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
}
