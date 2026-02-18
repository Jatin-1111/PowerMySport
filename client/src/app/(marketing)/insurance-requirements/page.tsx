"use client";

import { useEffect } from "react";

export default function InsuranceRequirements() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">
            Coach & Venue Insurance Requirements
          </h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Overview</h2>
            <p>
              PowerMySport requires all coaches and venue owners who offer
              services through our platform to maintain adequate insurance
              coverage. This policy outlines mandatory insurance requirements,
              verification processes, and liability frameworks to protect both
              service providers and users.
            </p>
            <p className="mt-4 font-semibold text-red-700">
              ⚠️ Insurance requirements are mandatory. Failure to maintain
              required insurance may result in account suspension or
              termination.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Venue Owner Insurance Requirements
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.1 Mandatory Insurance Types
            </h3>
            <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-3 text-left">
                    Insurance Type
                  </th>
                  <th className="border border-gray-300 p-3 text-left">
                    Minimum Coverage
                  </th>
                  <th className="border border-gray-300 p-3 text-left">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-3">
                    <strong>General Liability</strong>
                  </td>
                  <td className="border border-gray-300 p-3">
                    ₹50-100 lakhs per occurrence
                  </td>
                  <td className="border border-gray-300 p-3">
                    Covers injuries to users caused by facility conditions or
                    negligence
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    <strong>Property Insurance</strong>
                  </td>
                  <td className="border border-gray-300 p-3">
                    ₹10-25 lakhs minimum
                  </td>
                  <td className="border border-gray-300 p-3">
                    Covers damage to facility equipment and building
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">
                    <strong>Employer's Liability</strong>
                  </td>
                  <td className="border border-gray-300 p-3">
                    ₹10-25 lakhs per occurrence
                  </td>
                  <td className="border border-gray-300 p-3">
                    Covers injuries to staff/employees at the facility
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    <strong>Product Liability (if applicable)</strong>
                  </td>
                  <td className="border border-gray-300 p-3">₹10-25 lakhs</td>
                  <td className="border border-gray-300 p-3">
                    If the facility sells drinks, snacks, or other products
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.2 Additional Coverage Considerations
            </h3>
            <p>
              Depending on your facility and offerings, additional coverage may
              be recommended:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Sports Equipment Liability:</strong> If renting
                equipment (rackets, balls, etc.) to users
              </li>
              <li>
                <strong>Cyber Liability:</strong> For data breaches or cyber
                attacks affecting user data
              </li>
              <li>
                <strong>Directors & Officers Insurance:</strong> For business
                owners with LLC/corporate structure
              </li>
              <li>
                <strong>Equipment Breakdown:</strong> For HVAC, lighting, or
                electronic systems critical to operations
              </li>
              <li>
                <strong>Business Interruption:</strong> To cover loss of revenue
                during forced closures
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.3 Insurance Exclusions
            </h3>
            <p>
              Your insurance policy <strong>should not exclude</strong>:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Sports-related activities or injury risks</li>
              <li>Professional coaching activities held at your venue</li>
              <li>High-energy or competitive sports</li>
              <li>
                Children and youth activities (excluding intentional harm)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.4 Insurance Verification
            </h3>
            <p>Venue owners must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Provide a copy of insurance certificate at onboarding</li>
              <li>Update insurance details if coverage changes</li>
              <li>Renew insurance annually and provide updated proof</li>
              <li>
                List PowerMySport as a "Certificate Holder" (optional but
                recommended for tracking)
              </li>
              <li>Maintain continuous coverage with no lapses</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Coach/Trainer Insurance Requirements
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Mandatory Insurance Types
            </h3>
            <table className="w-full border-collapse border border-gray-300 mt-4 mb-4">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 p-3 text-left">
                    Insurance Type
                  </th>
                  <th className="border border-gray-300 p-3 text-left">
                    Minimum Coverage
                  </th>
                  <th className="border border-gray-300 p-3 text-left">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-3">
                    <strong>Professional Liability Insurance</strong>
                  </td>
                  <td className="border border-gray-300 p-3">₹25-50 lakhs</td>
                  <td className="border border-gray-300 p-3">
                    Covers claims of negligence in coaching/training services
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 p-3">
                    <strong>Personal Accident Insurance</strong>
                  </td>
                  <td className="border border-gray-300 p-3">₹10-25 lakhs</td>
                  <td className="border border-gray-300 p-3">
                    Your own injury coverage while conducting coaching
                  </td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">
                    <strong>General Liability (if applicable)</strong>
                  </td>
                  <td className="border border-gray-300 p-3">₹25-50 lakhs</td>
                  <td className="border border-gray-300 p-3">
                    If you rent equipment or use clients' facilities
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Service Models & Insurance
            </h3>
            <p>Different service models have different requirements:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Own Venue Coaches:</strong> Must maintain Professional
                Liability at minimum
              </li>
              <li>
                <strong>Freelance Coaches (player's/venue's location):</strong>{" "}
                Must maintain General Liability as well
              </li>
              <li>
                <strong>Hybrid Coaches:</strong> Must maintain all applicable
                coverage (Professional + General)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Group Coaching & Classes
            </h3>
            <p>If offering group classes or training:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Coverage limits should be sufficient for multiple simultaneous
                injuries
              </li>
              <li>Professional Liability should specify coaching services</li>
              <li>
                General Liability should cover the specific activities offered
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.4 Insurance Verification
            </h3>
            <p>Coaches must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Provide proof of insurance at onboarding (policy document or
                certificate)
              </li>
              <li>
                Verify insurance covers the specific coaching services offered
              </li>
              <li>Update insurance information if coverage changes</li>
              <li>
                Renew insurance annually and provide updated documentation
              </li>
              <li>Maintain continuous coverage with no lapses</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Insurance Verification Process
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.1 Onboarding Verification
            </h3>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                Upload insurance certificate/proof of insurance during account
                setup
              </li>
              <li>
                Certificate should include:
                <ul className="list-disc pl-6 mt-2">
                  <li>Insurance provider name and policy number</li>
                  <li>Coverage dates (from/to)</li>
                  <li>Coverage limits and deductible</li>
                  <li>Services/activities covered</li>
                  <li>Provider's contact information</li>
                </ul>
              </li>
              <li>
                PowerMySport team verifies authenticity by contacting insurance
                provider
              </li>
              <li>Account is approved or flagged for additional information</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.2 Ongoing Verification
            </h3>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>We maintain a schedule for insurance expiration dates</li>
              <li>
                30 days before expiration, providers receive renewal reminders
              </li>
              <li>Insurance must be renewed before expiration (no gaps)</li>
              <li>Updated certificates should be uploaded promptly</li>
              <li>Accounts with lapsed insurance may be suspended</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.3 Verification Failure
            </h3>
            <p>
              If insurance cannot be verified or coverage is found to be
              inadequate:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your account will be flagged for non-compliance</li>
              <li>
                You will be notified and given 7 days to provide proper
                documentation
              </li>
              <li>
                If not resolved, your ability to accept new bookings will be
                suspended
              </li>
              <li>
                If still unresolved after 14 days, your account may be
                terminated
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Third-Party Liability & Insurance Claims
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 PowerMySport's Role
            </h3>
            <p>PowerMySport is not responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Paying claims on behalf of coaches or venues</li>
              <li>Covering gaps in insurance coverage</li>
              <li>Defense costs if you are sued</li>
              <li>Medical expenses or injury compensation</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.2 Liability Hierarchy
            </h3>
            <p>If a user is injured and files a claim:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>
                <strong>Coach/Venue Insurance:</strong> Primary coverage. The
                coach or venue's insurance should cover the claim.
              </li>
              <li>
                <strong>User's Personal Insurance:</strong> If coach/venue
                insurance is insufficient, user's health/personal insurance.
              </li>
              <li>
                <strong>PowerMySport Liability Insurance:</strong> Only if
                neither of the above applies and PowerMySport is directly
                liable.
              </li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.3 Claims Process for Users
            </h3>
            <p>If a user is injured and wants to file a claim:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>
                User should file documentation with PowerMySport (incident
                report, photos, medical records)
              </li>
              <li>We will investigate and determine liability</li>
              <li>
                If the coach/venue is liable, we provide claim information to
                their insurance
              </li>
              <li>
                User should also contact their own health insurance or file with
                small claims court
              </li>
            </ol>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Recommended Insurance Providers & Resources
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.1 Insurance Options in India
            </h3>
            <p>Coaches and venues can obtain insurance through:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>National Insurance Company:</strong> General liability
                and professional insurance for small businesses
              </li>
              <li>
                <strong>ICICI Lombard:</strong> Sports liability and
                professional indemnity policies
              </li>
              <li>
                <strong>New India Assurance:</strong> Sports and fitness
                facility coverage
              </li>
              <li>
                <strong>HDFC Ergo:</strong> Professional liability for coaches
                and trainers
              </li>
              <li>
                <strong>Apollo General Insurance:</strong> Personal accident and
                professional liability
              </li>
              <li>
                <strong>Specialized Brokers:</strong> Sports-specific insurance
                brokers in your city
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.2 Cost Considerations
            </h3>
            <p>Typical annual insurance costs in India:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Coaches:</strong> ₹5,000-20,000 per year for
                professional liability
              </li>
              <li>
                <strong>Venues:</strong> ₹15,000-50,000 per year depending on
                facility size and sports offered
              </li>
              <li>
                Costs vary based on risk profile, claims history, and coverage
                limits
              </li>
              <li>
                PowerMySport does not subsidize or reimburse insurance costs
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.3 Resources for Coaches
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Consult with a local insurance broker specializing in
                fitness/sports
              </li>
              <li>
                Ask your professional sports association (if applicable) for
                insurance recommendations
              </li>
              <li>
                Check if certification bodies (ACSM, ISSA, NASM) offer group
                insurance programs
              </li>
              <li>
                Contact PowerMySport support for referrals to recommended
                providers
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.4 Resources for Venues
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Contact local sports facility associations or chambers of
                commerce
              </li>
              <li>Consult with property insurance brokers in your area</li>
              <li>Request quotes from multiple insurers for comparison</li>
              <li>
                Contact PowerMySport for venue-specific insurance guidance
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Non-Compliance & Consequences
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.1 Failure to Provide Insurance
            </h3>
            <p>If you cannot provide proof of required insurance:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                You will not be approved to offer services on PowerMySport
              </li>
              <li>Your account verification will be incomplete</li>
              <li>You cannot accept bookings or earn revenue</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.2 Lapsed Insurance
            </h3>
            <p>If your insurance lapses or expires:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your account will be flagged as non-compliant</li>
              <li>
                You will be prevented from accepting new bookings (within 24
                hours of expiration discovery)
              </li>
              <li>
                Existing bookings may be canceled (you will be required to
                refund)
              </li>
              <li>
                You have 7 days to provide updated proof before account
                suspension
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.3 Inadequate Coverage
            </h3>
            <p>
              If your insurance coverage is below minimums or inappropriate for
              your service:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>PowerMySport will notify you of specific deficiencies</li>
              <li>You will have 14 days to upgrade coverage</li>
              <li>
                If not resolved, your account will be suspended or terminated
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.4 Fraudulent Insurance
            </h3>
            <p>If you provide falsified or invalid insurance documentation:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Your account will be immediately terminated</li>
              <li>
                All future bookings will be canceled and full refunds issued
              </li>
              <li>You will be reported to law enforcement</li>
              <li>You will be permanently banned from PowerMySport</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Contact & Support
            </h2>
            <p>
              For questions about insurance requirements or to support in
              finding insurance:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Compliance Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:compliance@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  compliance@powermysport.com
                </a>
              </p>
              <p>
                Email (Vendors):{" "}
                <a
                  href="mailto:vendor-support@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  vendor-support@powermysport.com
                </a>
              </p>
              <p>Response Time: 48 hours</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300 bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-red-900 font-bold">
              ‼️ IMPORTANT: This document outlines minimum insurance
              requirements. Depending on your specific services, risk profile,
              and local regulations, you may need additional or higher coverage.
              We recommend consulting with a professional insurance broker to
              determine your specific insurance needs.
            </p>
            <p className="text-sm text-red-900 mt-3">
              PowerMySport's insurance requirements do not guarantee that you
              will be fully protected in case of claims. Your insurance provider
              makes final decisions about coverage and claim amounts.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
