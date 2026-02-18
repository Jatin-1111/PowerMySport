"use client";

import { useEffect } from "react";

export default function ParentalConsent() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">
            Parental Consent & Minor Protection Policy
          </h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Overview</h2>
            <p>
              PowerMySport is committed to protecting the safety and well-being
              of minors (individuals under 18 years old) who use our platform.
              This policy outlines the requirements and protections for parents,
              guardians, and minors participating in sporting activities through
              our marketplace.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Parental/Guardian Account Setup
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.1 Parent/Guardian Eligibility
            </h3>
            <p>To book activities for a minor, you must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Be at least 18 years old</li>
              <li>
                Be the legal parent or court-appointed guardian of the minor
              </li>
              <li>Provide valid identification and proof of guardianship</li>
              <li>Create a PowerMySport account in your full legal name</li>
              <li>Accept all terms, privacy policies, and liability waivers</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.2 Account Verification
            </h3>
            <p>PowerMySport may request:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Government-issued ID verification</li>
              <li>
                Proof of guardianship (birth certificate, adoption papers, court
                order)
              </li>
              <li>Address verification</li>
              <li>Contact information (phone, email)</li>
            </ul>
            <p className="mt-3">
              <strong>Note:</strong> We reserve the right to suspend accounts if
              guardianship cannot be verified.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              2.3 Account Responsibility
            </h3>
            <p>As the account holder, you are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>All activities and bookings made through your account</li>
              <li>All charges and payments associated with your account</li>
              <li>Keeping your login credentials secure</li>
              <li>Monitoring your account for unauthorized access</li>
              <li>Providing accurate and current information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Adding a Minor to Your Account
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Minor Profile Creation
            </h3>
            <p>You can add minors (children) to your account by providing:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Child's full legal name</li>
              <li>Date of birth</li>
              <li>Gender</li>
              <li>Sport/activity interests</li>
              <li>Medical and emergency information (see Section 5)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Number of Minors
            </h3>
            <p>
              You can add an unlimited number of minors to your account. Each
              minor will have their own profile with separate health records and
              booking history.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Profile Verification
            </h3>
            <p>
              PowerMySport may request verification documents for each minor,
              including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Birth certificate</li>
              <li>School enrollment documents</li>
              <li>Medical records (for age-sensitive activities)</li>
              <li>Proof of residence</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Parental Consent & Liability Waiver
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.1 Mandatory Consent
            </h3>
            <p>Before booking any activity for a minor, you must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Read and accept the Health, Safety & Liability Waiver (see
                separate document)
              </li>
              <li>Digitally sign the waiver on behalf of the minor</li>
              <li>Confirm you have the legal authority to bind the child</li>
              <li>Accept all risks associated with the activity</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.2 Scope of Parental Liability
            </h3>
            <p>By consenting on behalf of a minor, you:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Assume full liability for any injuries, damages, or claims
                arising from the minor's participation
              </li>
              <li>
                Release PowerMySport, coaches, and facilities from all liability
              </li>
              <li>
                Agree to indemnify (reimburse) them for any damages the minor
                causes to others
              </li>
              <li>
                Accept responsibility for all medical costs if insurance does
                not cover them
              </li>
              <li>
                Waive the child's right to sue for injuries caused by ordinary
                negligence
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.3 Renewal of Consent
            </h3>
            <p>
              Parental waivers are typically valid for 12 months (or as
              specified by facility). You will be prompted to renew consent
              before booking if the waiver has expired.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Health & Medical Information
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 Health Declaration Requirement
            </h3>
            <p>
              For each minor, you must provide a complete health declaration
              including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Current health status and fitness level</li>
              <li>
                Any chronic medical conditions (asthma, diabetes, hypertension,
                epilepsy, etc.)
              </li>
              <li>Current medications and dosages</li>
              <li>
                Allergies (especially relevant to activities and facilities)
              </li>
              <li>Recent injuries, surgeries, or hospital visits</li>
              <li>Physical limitations or mobility restrictions</li>
              <li>Mental health conditions that may affect participation</li>
              <li>
                Immunization status (especially relevant for group activities)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.2 Medical Professional Consultation
            </h3>
            <p>You acknowledge that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                For children with pre-existing conditions, you should consult
                with their pediatrician before booking activities
              </li>
              <li>
                Coaches are not medical professionals and cannot provide medical
                advice
              </li>
              <li>
                If uncertain about your child's fitness, you must seek physician
                approval
              </li>
              <li>
                You are responsible for determining if your child is healthy
                enough to participate
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.3 Disclosure Obligation
            </h3>
            <p>
              You must fully disclose all health information to coaches and
              facility staff. Failure to disclose material health information
              may result in:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Account suspension</li>
              <li>Loss of right to refund in case of injury</li>
              <li>
                Liability for injuries or damages caused by non-disclosure
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.4 Emergency Medical Information
            </h3>
            <p>You must provide:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Primary emergency contact (you) and backup contact</li>
              <li>Phone numbers and email addresses</li>
              <li>Name and contact of your child's primary physician</li>
              <li>
                Name and contact of your child's dentist (for dental injuries)
              </li>
              <li>Preferred hospital or emergency care facility</li>
              <li>Health insurance details and policy number</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Supervision & Safety Requirements
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.1 Parental Supervision
            </h3>
            <p>Depending on the minor's age and activity type:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Under 8 years:</strong> Adult supervision (parent or
                designated guardian) is mandatory at the facility
              </li>
              <li>
                <strong>8-12 years:</strong> An adult should be present or
                on-call at the facility
              </li>
              <li>
                <strong>13-17 years:</strong> May attend without direct parental
                supervision (but parent responsible for drop-off/pick-up)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.2 Designated Supervisor
            </h3>
            <p>
              If you will not be present at the facility, you must designate an
              alternate responsible adult:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Provide their full name, relationship, and contact information
              </li>
              <li>They must be at least 18 years old</li>
              <li>
                They must be authorized to make emergency decisions if needed
              </li>
              <li>Inform the facility and coach of the designated person</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.3 Drop-off & Pick-up
            </h3>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Dropping off your child on time before the activity begins
              </li>
              <li>Picking up your child immediately after the activity ends</li>
              <li>
                Arranging alternative pick-up if you cannot collect your child
              </li>
              <li>
                Informing the facility of any changes in pick-up arrangements
              </li>
              <li>
                If your child is not picked up within 30 minutes, facility may
                contact authorities
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.4 Communication During Activity
            </h3>
            <p>You must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Provide a phone number where you can be reached during the
                activity
              </li>
              <li>Be reachable in case of emergency</li>
              <li>Check messages and voicemails regularly</li>
              <li>Not rely on the minor to communicate on your behalf</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Age-Restricted Activities
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.1 Low-Risk Activities (All Ages)
            </h3>
            <p>
              Activities such as badminton, cricket (recreational), basketball,
              and basic fitness classes are typically available to minors with
              parental consent.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.2 Medium-Risk Activities (Age 10+)
            </h3>
            <p>
              Activities such as advanced training, competitive sports, or
              high-intensity fitness may have age restrictions. You must:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Verify the minimum age requirement before booking</li>
              <li>Provide additional health certification if requested</li>
              <li>Increase parental supervision and communication</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.3 High-Risk Activities (Age 15+)
            </h3>
            <p>
              Activities such as extreme sports, contact sports, or activities
              with elevated injury risk may only be available to minors age 15+
              with enhanced parental consent and medical clearance.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.4 Age Verification
            </h3>
            <p>
              PowerMySport may request proof of age (birth certificate, school
              ID) before allowing a minor to book age-restricted activities.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Behavioral Expectations
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.1 Code of Conduct
            </h3>
            <p>You agree to ensure your child:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Respects coaches, facility staff, and other participants</li>
              <li>Follows all safety rules and instructions</li>
              <li>Does not engage in violence, bullying, or harassment</li>
              <li>Does not damage facility property</li>
              <li>Maintains appropriate behavior at all times</li>
              <li>Does not bring weapons or dangerous items to facilities</li>
              <li>Does not use profanity or abusive language</li>
              <li>Does not be under the influence of alcohol or drugs</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.2 Violation Consequences
            </h3>
            <p>
              If your child violates the code of conduct, consequences may
              include:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Verbal warning from coach or facility staff</li>
              <li>Suspension from one or more sessions</li>
              <li>Permanent ban from the facility</li>
              <li>Account termination by PowerMySport</li>
              <li>Liability for damages caused by your child</li>
              <li>Potential police involvement in case of criminal behavior</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.3 Parental Responsibility
            </h3>
            <p>You are responsible for:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Teaching your child appropriate behavior</li>
              <li>Enforcing facility rules at home</li>
              <li>Addressing behavioral issues immediately</li>
              <li>
                Accepting liability if your child damages property or harms
                others
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Data & Privacy for Minors
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.1 Limited Data Collection
            </h3>
            <p>
              PowerMySport collects only the minimum personal information
              necessary for minors:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Name, date of birth, gender</li>
              <li>Health and medical information (confidential)</li>
              <li>Booking history</li>
              <li>Parental contact information</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.2 Data Protection
            </h3>
            <p>We protect minor data by:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Encrypting personal information</li>
              <li>Restricting access to authorized staff only</li>
              <li>
                Not selling or sharing data with third parties (except as
                required by law)
              </li>
              <li>Not using data for marketing or advertising</li>
              <li>
                Maintaining COPPA (Children's Online Privacy Protection Act)
                compliance where applicable
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.3 Right to Access & Deletion
            </h3>
            <p>Parents have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Request details of what personal data we hold about their child
              </li>
              <li>Request deletion of a child's profile and data</li>
              <li>
                Withdraw consent at any time (future bookings not allowed)
              </li>
              <li>Request data export for records</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Photo & Video Recording
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.1 Facility Recording
            </h3>
            <p>
              Facilities may use CCTV cameras for security and safety purposes.
              You acknowledge that:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Recording may occur without explicit notice to each minor</li>
              <li>
                Recordings are used for facility management and dispute
                resolution
              </li>
              <li>You consent to CCTV recording by using the facility</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.2 Parent Photos & Videos
            </h3>
            <p>If you want to photograph or video your child:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Inform the coach and facility in advance</li>
              <li>Ask permission before recording other children</li>
              <li>Follow facility policies on photography</li>
              <li>
                Do not photograph or share photos without permission from other
                parents
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.3 Social Media & Sharing
            </h3>
            <p>You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Not post photos of other children on social media without
                parental consent
              </li>
              <li>Not tag your child's location at the facility</li>
              <li>Not share personal information about other children</li>
              <li>Be cautious about privacy implications of photos</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              11. Termination & Account Removal
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              11.1 When to Remove a Minor
            </h3>
            <p>You may remove a minor from your account at any time by:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Logging into your PowerMySport account</li>
              <li>Navigating to the minor's profile</li>
              <li>Selecting "Remove Profile"</li>
              <li>Confirming the removal</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              11.2 Automatic Removal
            </h3>
            <p>
              A minor's profile will be automatically removed when they turn 18
              years old, unless they choose to convert to an adult account.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              11.3 Account Suspension
            </h3>
            <p>PowerMySport may suspend or remove a minor's profile if:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Parental consent verification fails</li>
              <li>Health information is found to be fraudulent</li>
              <li>The minor violates the code of conduct repeatedly</li>
              <li>We detect unsafe activity or abuse</li>
              <li>The parent account is terminated</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              12. Questions & Support
            </h2>
            <p>
              For questions about parental consent, minor protection, or account
              management:
            </p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Family Support Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:family@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  family@powermysport.com
                </a>
              </p>
              <p>
                Email (Urgent):{" "}
                <a
                  href="mailto:safeguarding@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  safeguarding@powermysport.com
                </a>
              </p>
              <p>Response Time: 24 hours (business days)</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300 bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-900 font-bold">
              🛡️ If you suspect abuse, exploitation, or harm to a minor, please
              contact us immediately at safeguarding@powermysport.com or your
              local law enforcement.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
