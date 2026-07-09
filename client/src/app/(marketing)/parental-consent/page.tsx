"use client";

import { ShieldAlert } from "lucide-react";
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
            <strong>Last Updated:</strong> July 9, 2026 |{" "}
            <strong>Effective Date:</strong> July 9, 2026
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
                Read and accept the Health, Safety &amp; Liability Waiver (see
                separate document) on behalf of the minor
              </li>
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
              4.3 Ongoing Effect of Consent
            </h3>
            <p>
              Your acceptance of the Health, Safety &amp; Liability Waiver on
              behalf of your dependent applies to each booking you make for
              that dependent while these Terms remain in effect. You may
              withdraw your consent at any time by contacting us or removing
              the dependent&apos;s profile; withdrawal takes effect for future
              bookings only and does not affect activities already completed.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Health & Medical Information
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 PowerMySport Does Not Collect Medical Records
            </h3>
            <p>
              The Platform does not currently collect or store structured
              medical or health information about your dependent (such as
              chronic conditions, medications, allergies, or immunization
              records). You are solely responsible for directly informing the
              coach or venue staff, in person or via your own communication
              channel, of any health condition, allergy, medication, or
              physical limitation relevant to your dependent&apos;s safe
              participation, before each session.
            </p>

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
                Coaches are not medical professionals and cannot provide
                medical advice
              </li>
              <li>
                If uncertain about your child&apos;s fitness, you must seek
                physician approval
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
              You must fully disclose relevant health information directly to
              coaches and facility staff before each session. Failure to
              disclose material health information may result in:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Account suspension</li>
              <li>Loss of right to a refund in connection with any resulting injury</li>
              <li>
                Liability for injuries or damages caused by non-disclosure
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.4 Emergency Contact
            </h3>
            <p>
              You must ensure the phone number and email on your account are
              current and reachable, as they are the only emergency contact
              details PowerMySport or a venue/coach can use to reach you.
              PowerMySport does not maintain a separate physician, dentist, or
              insurance record for your dependent; keeping that information
              accessible to yourself and sharing it directly with venue/coach
              staff when relevant is your responsibility.
            </p>
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
              PowerMySport collects only the following personal information
              for a dependent profile:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Name, date of birth, gender</li>
              <li>Sport/activity interests</li>
              <li>Booking history</li>
              <li>Your (the parent/guardian&apos;s) contact information</li>
            </ul>
            <p className="mt-3">
              As noted in Section 5, we do not collect structured medical or
              health data about your dependent.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.2 Data Protection
            </h3>
            <p>We protect minor data by:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Restricting access to authorized personnel only</li>
              <li>
                Not selling data to third parties, and sharing it only as
                described in our Privacy Policy (e.g. with the venue/coach for
                a confirmed booking, or as required by law)
              </li>
              <li>Not using a dependent&apos;s data for marketing, advertising, or behavioural tracking</li>
              <li>
                Aligning our practices with the Digital Personal Data
                Protection Act, 2023 (India) as it comes into force in phases,
                and with the Information Technology Act, 2000 and rules made
                thereunder
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.3 Right to Access & Deletion
            </h3>
            <p>Parents have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Request details of what personal data we hold about their
                child
              </li>
              <li>
                Request deletion of a child&apos;s profile and data (via the
                &quot;Remove Profile&quot; action described in Section 11, or
                by contacting us)
              </li>
              <li>
                Withdraw consent at any time; this takes effect for future
                bookings only
              </li>
              <li>
                Request a copy of the personal data we hold about their child,
                which we will provide within a reasonable time
              </li>
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
              11.2 Turning 18
            </h3>
            <p>
              A dependent&apos;s profile is not automatically removed or
              converted when they turn 18. Once your dependent reaches 18,
              either of you may request that their profile be converted to an
              independent account (which they will then control themselves
              using their own credentials); until that happens, the profile
              remains linked to your account and you remain responsible for
              it as set out in this policy.
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
                  href="mailto:teams@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  teams@powermysport.com
                </a>
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> +91 89685 82443
              </p>
              <p>Response Time: 24 hours (business days)</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300 bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-900 font-bold inline-flex items-start gap-2">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                If you suspect abuse, exploitation, or harm to a minor, please
                contact us immediately at teams@powermysport.com or your local
                law enforcement.
              </span>
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
