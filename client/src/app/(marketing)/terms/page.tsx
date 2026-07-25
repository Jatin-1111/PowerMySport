"use client";

import { LegalPageHeader } from "@/components/legal/LegalPageHeader";
import {
  LegalTableOfContents,
  type LegalTocItem,
} from "@/components/legal/LegalTableOfContents";
import { Card } from "@/modules/shared/ui/Card";
import {
  BadgeCheck,
  Ban,
  CalendarCheck,
  CloudLightning,
  Copyright,
  FileText,
  Gavel,
  HandCoins,
  Handshake,
  Landmark,
  Layers,
  ListChecks,
  ListOrdered,
  Mail,
  Megaphone,
  MessageSquarePlus,
  Percent,
  Scale,
  ScrollText,
  Settings2,
  ShieldAlert,
  ShieldOff,
  UserPlus,
  Video,
  XCircle,
} from "lucide-react";

const TERMS_TOC: LegalTocItem[] = [
  { id: "agreement", label: "Agreement to Terms", icon: ScrollText },
  { id: "services", label: "Description of Services", icon: Layers },
  { id: "account", label: "Account Registration", icon: UserPlus },
  {
    id: "fraud-prevention",
    label: "Fraud Prevention & Account Security",
    icon: ShieldAlert,
  },
  { id: "responsibilities", label: "User Responsibilities", icon: ListChecks },
  {
    id: "expert-verification",
    label: "Expert Verification & Onboarding",
    icon: BadgeCheck,
  },
  { id: "booking", label: "Booking and Payments", icon: CalendarCheck },
  { id: "expert-sessions", label: "Expert Sessions", icon: Video },
  {
    id: "ranking",
    label: "Search Results, Rankings & Recommendations",
    icon: ListOrdered,
  },
  { id: "commission", label: "Commission and Fees", icon: Percent },
  { id: "ip", label: "Intellectual Property", icon: Copyright },
  { id: "feedback", label: "Feedback and Suggestions", icon: MessageSquarePlus },
  { id: "prohibited", label: "Prohibited Activities", icon: Ban },
  { id: "warranties", label: "Disclaimer of Warranties", icon: ShieldOff },
  { id: "liability", label: "Limitation of Liability", icon: Scale },
  { id: "indemnification", label: "Indemnification", icon: HandCoins },
  { id: "dispute", label: "Dispute Resolution and Arbitration", icon: Gavel },
  { id: "grievance", label: "Grievance Redressal", icon: Megaphone },
  { id: "termination", label: "Termination", icon: XCircle },
  { id: "relationship", label: "Relationship of Parties", icon: Handshake },
  { id: "force-majeure", label: "Force Majeure", icon: CloudLightning },
  { id: "general", label: "General Provisions", icon: Settings2 },
  { id: "governing-law", label: "Governing Law", icon: Landmark },
  { id: "contact", label: "Contact Information", icon: Mail },
];

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
          <LegalTableOfContents items={TERMS_TOC} />
          <Card className="legal-content bg-white p-8 prose prose-slate max-w-none lg:col-start-2">

          <section id="agreement" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Agreement to Terms
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              These Terms of Service (&quot;Terms&quot;) constitute a legally
              binding agreement between you and Powermysport Pvt. Ltd.
              (&quot;PowerMySport,&quot; &quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;). By accessing, browsing, registering on, or
              otherwise using our platform (website, mobile applications, and
              related services, collectively the &quot;Platform&quot;), you
              acknowledge that you have read, understood, and agree to be
              irrevocably bound by these Terms and our Privacy Policy and
              Cancellation, Refund &amp; Dispute Policy, which are incorporated
              herein by reference.
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              If you do not agree to every provision of these Terms, you must
              immediately stop using the Platform. We reserve the right, at
              our sole discretion, to modify, amend, or replace any part of
              these Terms at any time without prior individual notice. Revised
              Terms take effect immediately upon posting to the Platform. Your
              continued access or use of the Platform after any such change
              constitutes conclusive acceptance of the revised Terms. It is
              your sole responsibility to review these Terms periodically.
            </p>
            <p className="text-slate-600 leading-relaxed">
              These Terms apply to all users of the Platform, including
              without limitation players, guardians, venue listers, coaches,
              academies, experts, and visitors, and supersede all prior
              agreements, representations, and understandings, whether written
              or oral.
            </p>
          </section>

          <section id="services" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Description of Services
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              PowerMySport operates a hyperlocal marketplace platform that
              connects:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                <strong>Players:</strong> Individuals seeking sports venues
                and coaching services
              </li>
              <li>
                <strong>Parents/Guardians:</strong> Adults who register a
                dependent (minor) profile and act on that profile&apos;s
                behalf for all bookings, payments, and communications
              </li>
              <li>
                <strong>Venue Listers:</strong> Owners/operators of sports
                facilities
              </li>
              <li>
                <strong>Coaches:</strong> Professional sports trainers and
                instructors
              </li>
              <li>
                <strong>Academies:</strong> Organizations offering structured
                training programs, subscription plans, and packages to
                players
              </li>
              <li>
                <strong>Experts:</strong> Elite or experienced sports
                professionals — including ex-professional players, certified
                analysts, and senior-level coaches — who offer paid,
                one-on-one guidance, mentorship, career advice, and advisory
                sessions to clients through the Platform, in online or
                in-person format. Expert profiles are subject to verification
                and approval by PowerMySport before going live
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Academies, Coaches, and Experts are subject to additional
              onboarding, verification, and role-specific terms incorporated
              into these Terms by reference. Parents/guardians are fully
              responsible for all activity conducted through dependent profiles
              they create.
            </p>
            <p className="text-slate-600 leading-relaxed mt-4">
              PowerMySport is strictly an intermediary technology platform. We
              do not own, operate, control, employ, or supervise any venue,
              coach, expert, or academy listed on the Platform, and we are not
              a party to any agreement formed between users. We do not
              guarantee the quality, safety, legality, suitability,
              availability, or accuracy of any listing, service, or user, and
              we expressly disclaim any responsibility for the acts, omissions,
              or conduct of any third party. We reserve the right to modify,
              suspend, restrict, or discontinue any feature of the Platform,
              in whole or in part, at any time and without liability or notice.
            </p>
          </section>

          <section id="account" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Account Registration
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              To use certain features of the Platform, you must register for
              an account. You agree and warrant that you will:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>
                Promptly correct or update your information whenever it
                changes
              </li>
              <li>
                Maintain the confidentiality and security of your account
                credentials at all times
              </li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>
                Assume full responsibility for all activities conducted
                through your account, whether or not authorized by you
              </li>
              <li>Not create multiple accounts or share your account</li>
              <li>Not register on behalf of, or impersonate, any third party</li>
              <li>
                Be at least 18 years old (parents/guardians may create and
                remain solely responsible for dependent profiles for minors)
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              We reserve the right, at our sole and absolute discretion, to
              refuse registration, require additional identity or document
              verification, suspend an account pending verification, or
              terminate any account without notice or liability, for any
              reason, including suspected fraud, misrepresentation, or breach
              of these Terms.
            </p>
          </section>

          <section id="fraud-prevention" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Fraud Prevention &amp; Account Security
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              PowerMySport, its employees, and its representatives will never
              call, message, or email you asking for your account password,
              one-time password (OTP), card CVV, full card number, or any
              other credential, and will never ask you to transfer money to a
              personal or individual bank account. Legitimate payments to
              PowerMySport only ever happen through the in-app checkout flow
              to our authorized payment partners.
            </p>
            <p className="text-slate-600 leading-relaxed">
              If you receive a call, message, or email claiming to be from
              PowerMySport that asks for any of this information, do not
              share it — report it immediately to teams@powermysport.com. We
              are not liable for any loss you incur by sharing your password,
              OTP, CVV, or other account credentials with any third party,
              including someone impersonating PowerMySport.
            </p>
          </section>

          <section id="responsibilities" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              User Responsibilities
            </h2>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For All Users
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Comply strictly with all applicable laws and regulations</li>
              <li>Respect other users and maintain professional conduct</li>
              <li>Not engage in fraudulent, deceptive, or misleading practices</li>
              <li>Not misuse the Platform or interfere with its operation</li>
              <li>Maintain accurate and truthful profile information at all times</li>
              <li>
                Bear sole responsibility for any equipment, insurance, medical
                fitness, or safety precautions necessary for participation in
                any activity booked through the Platform
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Parents/Guardians
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                Be at least 18 years old and have the legal authority to act
                on behalf of the minor whose dependent profile you create
              </li>
              <li>
                Provide accurate information about the dependent, including
                date of birth, and keep it up to date
              </li>
              <li>
                Assume full and sole responsibility for all bookings,
                payments, cancellations, and conduct associated with the
                dependent profile, as if they were your own
              </li>
              <li>
                Directly supervise the dependent&apos;s safety during any
                booked session; PowerMySport bears no responsibility for
                supervision of minors
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Players
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                Honor confirmed bookings; cancellations are governed
                exclusively by our Cancellation, Refund &amp; Dispute Policy
              </li>
              <li>Arrive on time for scheduled sessions</li>
              <li>Strictly respect venue rules and coach instructions</li>
              <li>Provide only honest, factual reviews and feedback</li>
              <li>
                Assume all risk of injury inherent in physical/sporting
                activity; PowerMySport bears no responsibility for injuries
                sustained during a booked session
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Venue Listers
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>Provide accurate, current venue information and photographs</li>
              <li>
                Maintain facilities in safe, good, and legally compliant
                condition at all times
              </li>
              <li>Honor every confirmed booking without exception</li>
              <li>
                Provide authentic, verifiable documentation during onboarding
                and upon request thereafter
              </li>
              <li>Update availability and pricing promptly and accurately</li>
              <li>
                Comply with all applicable safety, zoning, licensing, and
                regulatory standards, and indemnify PowerMySport for any
                failure to do so
              </li>
              <li>
                Hold valid insurance and statutory permits required to operate
                the listed facility
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Coaches
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                Provide valid, verifiable certifications and credentials, and
                promptly furnish proof upon request
              </li>
              <li>Maintain professional conduct at all times</li>
              <li>Honor every confirmed coaching session without exception</li>
              <li>
                Ensure the safety of participants during training sessions and
                maintain adequate liability coverage
              </li>
              <li>Update availability and rates promptly and accurately</li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              For Experts
            </h3>
            <div className="bg-orange-50 border-l-4 border-power-orange p-4 mb-5 rounded-r-lg not-prose">
              <p className="text-slate-700 text-sm font-medium">
                These obligations apply specifically to users registered as an
                Expert. Experts are independently contracted service providers,
                not employees of PowerMySport.
              </p>
            </div>
            <ul className="list-disc pl-6 text-slate-600 space-y-3">
              <li>
                <strong>Accurate profile:</strong> Maintain a truthful, current,
                and complete profile at all times, including bio, sports,
                expertise areas, achievements, qualifications, session fee,
                session mode (online / in-person / both), session duration,
                languages, city, and weekly availability schedule.
                Misleading profile information is grounds for immediate
                suspension
              </li>
              <li>
                <strong>Credentials:</strong> Provide only verifiable, authentic
                credentials, qualifications, and achievement claims. Furnish
                documentary proof upon request by PowerMySport or, where
                required, to clients. Misrepresentation of credentials
                constitutes a material breach entitling us to immediately
                terminate your Expert account
              </li>
              <li>
                <strong>Booking acceptance:</strong> Respond to new booking
                requests (accept or decline) within 24 hours of notification.
                Failure to respond may be treated as automatic acceptance or
                system-driven cancellation at PowerMySport&apos;s sole
                discretion. Repeated non-responses may result in account
                suspension
              </li>
              <li>
                <strong>Honor accepted sessions:</strong> Once you accept a
                booking and it reaches SCHEDULED status you must conduct the
                session as agreed. Cancelling an accepted session entitles the
                client to a full refund and may result in payout forfeiture,
                account warnings, or suspension
              </li>
              <li>
                <strong>Cancellation notice:</strong> If you must cancel an
                accepted session, notify both the client and PowerMySport as
                early as possible and in any case no less than 24 hours before
                the scheduled start time. Late cancellations (under 24 hours)
                or no-shows are treated as breaches and may result in payout
                forfeiture and/or account action
              </li>
              <li>
                <strong>Online sessions — meeting link:</strong> For online
                sessions you must provide a valid, working meeting link in the
                Platform at least 2 hours before the scheduled start time.
                Failure to do so may entitle the client to a full refund and
                will be treated as a cancellation by you
              </li>
              <li>
                <strong>In-person sessions — location accuracy:</strong> The
                in-person address you provide must be accurate, accessible,
                safe, and compliant with all applicable local laws. You are
                solely responsible for the suitability and safety of any
                in-person session venue. The address is shared only with
                clients who have a confirmed booking; you must not alter it
                after confirmation without the client&apos;s express agreement
                and notification to PowerMySport
              </li>
              <li>
                <strong>Availability &amp; blackout dates:</strong> Keep your
                weekly availability schedule and blackout dates accurate and
                up to date. You are solely responsible for conflicts arising
                from inaccurate availability settings; double-booking or
                failing to honor sessions due to inaccurate settings will be
                treated as an expert-side cancellation
              </li>
              <li>
                <strong>Session conduct:</strong> Conduct every session
                professionally, punctually, and within the scope of sports
                guidance, mentorship, or advisory services represented in
                your profile. Sessions must be lawful, respectful, and
                appropriate at all times
              </li>
              <li>
                <strong>Client confidentiality:</strong> Do not disclose the
                identity, session content, personal details, or communications
                of any client to any third party without the client&apos;s
                prior written consent, except where required by law
              </li>
              <li>
                <strong>No circumvention:</strong> Do not solicit, arrange, or
                complete any session or payment with a client you met through
                the Platform outside the Platform to avoid commission or fees.
                Circumvention constitutes a material breach entitling us to
                immediately terminate your account and recover unpaid commission
              </li>
              <li>
                <strong>Payout methods:</strong> Maintain at least one valid,
                verified payout method (bank transfer or UPI) on the Platform.
                PowerMySport is not liable for payout failures arising from
                incorrect or outdated payout details you provide
              </li>
              <li>
                <strong>Tax compliance:</strong> You are solely responsible for
                reporting and remitting all taxes (including GST, income tax,
                and TDS, as applicable) on income earned through the Platform.
                PowerMySport may deduct TDS as required by applicable Indian
                law and will issue the relevant statutory certificate
              </li>
              <li>
                <strong>Insurance and liability:</strong> For in-person
                sessions, you are solely responsible for maintaining adequate
                personal liability insurance. PowerMySport bears no
                responsibility for any injury, loss, or damage occurring during
                or arising from any session you conduct
              </li>
              <li>
                <strong>Regulatory compliance:</strong> Comply with all
                applicable laws, including the Consumer Protection Act, 2019,
                the Digital Personal Data Protection Act, 2023, and any
                sector-specific regulations governing your area of expertise
              </li>
            </ul>
          </section>

          <section id="expert-verification" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Expert Verification &amp; Onboarding
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              All Expert accounts are subject to a mandatory verification
              process before going live on the Platform. By applying to become
              an Expert, you agree to the following:
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Verification Stages
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                <strong>UNVERIFIED:</strong> Your account is created but your
                profile is not visible to clients and you cannot receive
                bookings. You must complete the onboarding wizard and submit
                for review
              </li>
              <li>
                <strong>PENDING:</strong> Your application has been submitted
                and is under review by the PowerMySport team. We aim to complete
                the review within 5–7 business days, though this may take
                longer. You will be notified of the outcome via email and
                in-platform notification
              </li>
              <li>
                <strong>APPROVED:</strong> Your profile is live and visible to
                clients; you can receive and accept booking requests
              </li>
              <li>
                <strong>REJECTED:</strong> Your application did not meet our
                requirements. You will receive a reason for rejection and may
                resubmit after addressing the identified issues. Repeated
                misrepresentation during verification may result in a permanent
                ban from the Expert programme
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Verification Obligations
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                You must provide honest, accurate, and complete information
                during onboarding, including government-issued identity proof,
                sports credentials, certifications, achievements, and any
                other documents we reasonably request
              </li>
              <li>
                You must promptly update your profile if any submitted
                information changes after approval (e.g., if certifications
                lapse or credentials are revoked)
              </li>
              <li>
                PowerMySport may conduct background checks, reference checks,
                or credential verification through third-party services at
                any time, including after initial approval
              </li>
              <li>
                PowerMySport reserves the right to revoke Expert APPROVED
                status at any time if submitted information is found to be
                false, if conduct falls below expected standards, or for any
                other reason at our sole discretion
              </li>
              <li>
                Admin-provisioned Expert accounts (created directly by
                PowerMySport staff) bypass the self-registration verification
                flow but remain subject to all Expert obligations in these Terms
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Profile Standards
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                Expert profile photos must be a clear, professional image of
                yourself. Use of stock photos, logos, or images of other
                persons is prohibited and grounds for rejection or removal
              </li>
              <li>
                Bio and expertise descriptions must accurately represent your
                actual qualifications and experience. Superlative or
                unverifiable claims without supporting evidence may be removed
                at our discretion
              </li>
              <li>
                Session fees must be set in good faith and reflect the actual
                service offered. Artificially inflating fees and privately
                offering discounts outside the Platform constitutes
                circumvention
              </li>
            </ul>
          </section>

          <section id="booking" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Booking and Payments
            </h2>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Booking Process
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                All bookings are subject to availability and are not guaranteed
                until confirmed
              </li>
              <li>
                Bookings are confirmed only after successful payment capture
              </li>
              <li>
                You will receive a confirmation email with booking details;
                you are solely responsible for verifying its accuracy
                immediately
              </li>
              <li>
                For group bookings, the total cost may be split among
                participating players (equally or by a custom amount); this
                split applies only to what players owe each other and does
                not alter how venues or coaches are paid
              </li>
              <li>
                We reserve the right to cancel or refuse any booking suspected
                of fraud, error, or abuse, at our sole discretion
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Payment Terms
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                All prices are displayed in Indian Rupees (INR) and are
                inclusive of applicable taxes unless stated otherwise
              </li>
              <li>
                Full payment must be completed at the time of booking; no
                booking is held without payment
              </li>
              <li>
                We accept major credit/debit cards, UPI, and digital wallets
                through our authorized payment partners; we are not liable for
                any failure, delay, or error caused by such third-party
                payment providers
              </li>
              <li>
                Service charges and platform fees are disclosed before payment
                and are strictly non-negotiable
              </li>
              <li>
                Venue listers, coaches, and experts receive payouts only after
                booking/session completion and only in accordance with our
                then-current payout schedule, which we may change at our sole
                discretion
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Cancellation and Refunds
            </h3>
            <p className="text-slate-600 leading-relaxed mb-4">
              All cancellations, refunds, no-shows, and payment disputes are
              governed exclusively and in their entirety by our Cancellation,
              Refund &amp; Dispute Policy, which is incorporated into these
              Terms by reference and controls in the event of any conflict
              with this section. We reserve the right to amend that policy at
              any time. Refunds, where owed, are issued solely at our
              discretion in accordance with that policy and are never
              guaranteed as a matter of right.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Right to Refuse Service
            </h3>
            <p className="text-slate-600 leading-relaxed">
              A venue lister, coach, or expert may decline to provide a
              service to a specific player for reasons including safety,
              capacity, or behavioral concerns, or any other good-faith
              reason not prohibited by applicable law. Where a confirmed
              booking is declined at the point of service for such a reason,
              refund treatment is governed by our Cancellation, Refund &amp;
              Dispute Policy in the same way as any other provider-initiated
              cancellation. PowerMySport is not liable for a venue
              lister&apos;s, coach&apos;s, or expert&apos;s decision to
              decline service to a specific player.
            </p>
          </section>

          <section id="expert-sessions" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Expert Sessions
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              Expert sessions are paid one-on-one sessions booked by clients
              directly with an Expert through the Platform. The following terms
              govern the expert session lifecycle in addition to the general
              booking and payment terms above.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Session Lifecycle
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                <strong>PENDING_PAYMENT:</strong> A client initiates a booking
                and a slot hold is placed on the Expert&apos;s calendar while
                payment is in progress. The hold expires if payment is not
                completed within the prescribed window, automatically freeing
                the slot
              </li>
              <li>
                <strong>SCHEDULED:</strong> Payment has been successfully
                captured and the Expert has accepted the booking. The session
                is confirmed for both parties
              </li>
              <li>
                <strong>COMPLETED:</strong> The session has concluded.
                Completion may be triggered automatically once the scheduled
                end time passes or manually by an admin. Clients may submit a
                rating and review after completion
              </li>
              <li>
                <strong>CANCELLED:</strong> The session was cancelled by the
                client, the Expert, an admin, or the system (e.g., payment
                hold expired or Expert declined). Refund eligibility depends
                on who cancelled and when, as set out in our Cancellation,
                Refund &amp; Dispute Policy
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Expert Acceptance
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                Upon a client completing payment, the Expert receives a booking
                notification and must accept or decline within 24 hours
              </li>
              <li>
                If the Expert declines, the client receives a full refund.
                Repeated declines without valid reason may result in account
                action
              </li>
              <li>
                Silence beyond 24 hours may be treated as acceptance or as a
                system-driven cancellation with refund, at PowerMySport&apos;s
                sole discretion
              </li>
              <li>
                Once a booking is accepted (SCHEDULED), the Expert may not
                unilaterally alter the session time or mode without the
                client&apos;s prior consent and PowerMySport&apos;s approval
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Expert Payouts
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                Expert payouts are released 24 hours after a session reaches
                COMPLETED status (whether by auto-completion or admin action).
                This window allows for post-session disputes or refund requests
                to be raised before funds are disbursed
              </li>
              <li>
                Payouts are credited to the Expert&apos;s default payout
                method (bank transfer or UPI) on file at the time of release.
                PowerMySport is not responsible for failed payouts due to
                incorrect or outdated payout details
              </li>
              <li>
                The applicable platform commission is deducted from the session
                fee before payout. The net payout amount is visible to the
                Expert in their dashboard so that they may price their services
                accordingly
              </li>
              <li>
                PowerMySport may withhold or offset any payout if: (a) the
                session is under dispute; (b) the Expert has outstanding amounts
                owed to us; (c) the session was cancelled by the Expert; or
                (d) we have reason to suspect fraud or policy violation
              </li>
              <li>
                TDS (Tax Deducted at Source) will be applied to Expert payouts
                as required by applicable Indian tax law. The Expert is
                responsible for their own tax filings and compliance obligations
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Reviews and Ratings
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>
                Clients may submit a rating (1–5 stars) and a written review
                within a specified window after a session is marked COMPLETED.
                Reviews are displayed publicly on the Expert&apos;s profile
              </li>
              <li>
                Clients may choose to submit reviews anonymously; the
                reviewer&apos;s identity will not be disclosed to the Expert
                or other users
              </li>
              <li>
                PowerMySport reserves the right to hide or remove reviews that
                violate our content policies, but does not edit review content.
                Experts may flag a review as inappropriate; flagged reviews are
                subject to admin discretion
              </li>
              <li>
                Experts must not solicit fake, paid, or coerced reviews, or
                request removal of genuine negative reviews. Doing so is a
                prohibited activity and grounds for account termination
              </li>
              <li>
                An Expert&apos;s average rating and review count are calculated
                on verified completed sessions only
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Session Reminders and Notifications
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                PowerMySport will send automated reminder notifications to both
                parties before scheduled sessions. Experts are responsible for
                monitoring their notifications and ensuring session readiness
              </li>
              <li>
                For online sessions, Experts will receive a nudge to add a
                meeting link if one has not been provided close to the session
                start time. Failure to act on this nudge is the Expert&apos;s
                sole responsibility
              </li>
              <li>
                Both parties will receive a &quot;session starting soon&quot;
                reminder containing the meeting link (online sessions) or the
                confirmed in-person address (in-person sessions)
              </li>
            </ul>
          </section>

          <section id="ranking" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Search Results, Rankings &amp; Recommendations
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              When you search for or browse venues, coaches, or experts on
              the Platform, the order in which listings appear is determined
              by factors that include: verification or approval status (only
              verified venues, verified coaches, and APPROVED experts are
              shown at all), average rating, number of reviews, proximity to
              your selected location where relevant, and how recently a
              listing has been active or updated. These factors may change
              from time to time as we improve the Platform.
            </p>
            <p className="text-slate-600 leading-relaxed">
              PowerMySport does not currently offer any paid or sponsored
              placement that would move a listing higher in search results
              independent of the factors above. If we introduce paid or
              sponsored placement in the future, any such listing will be
              clearly and separately labeled as sponsored or promoted.
            </p>
          </section>

          <section id="commission" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Commission and Fees
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              PowerMySport reserves the right to charge venue listers, coaches,
              and experts a commission on successful bookings and completed
              sessions:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                Where a commission is charged, the applicable rate will be
                disclosed to the affected venue lister, coach, or expert in
                advance through the Platform, and may be introduced, revised,
                or removed by us at any time upon notice
              </li>
              <li>
                For Expert sessions specifically, the platform commission is
                deducted from the session fee before the 24-hour
                post-completion payout is released. The net payout amount is
                displayed in the Expert&apos;s dashboard
              </li>
              <li>
                Academies and coaches may separately offer paid subscription
                or session-package plans directly to players; these are
                distinct products governed by their own listed terms and are
                unrelated to any commission charged on venue or coaching
                bookings
              </li>
              <li>
                Payment processing fees levied by third-party gateways are
                non-refundable and may be passed on to you
              </li>
              <li>
                We reserve the right to withhold, offset, or recover any
                amount owed to us (including commissions, penalties, or
                chargeback costs) from current or future payouts due to a
                venue lister, coach, or expert
              </li>
              <li>
                Commission structure and fee schedules may be updated at our
                sole discretion with notice via the Platform
              </li>
            </ul>
          </section>

          <section id="ip" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Intellectual Property
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              All content on PowerMySport, including but not limited to text,
              graphics, logos, icons, images, software, and the compilation
              thereof, is the exclusive property of PowerMySport or its
              licensors and is protected by Indian and international
              intellectual property laws. Except for the limited,
              non-exclusive, non-transferable, revocable license to access and
              use the Platform for its intended purpose, no right, title, or
              interest is transferred to you.
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              You may not copy, reproduce, republish, distribute, modify,
              reverse engineer, decompile, scrape, or create derivative works
              from any part of the Platform without our express prior written
              permission. Any unauthorized use immediately and automatically
              terminates your license to use the Platform.
            </p>
            <p className="text-slate-600 leading-relaxed">
              By uploading any content (photos, descriptions, reviews, or
              otherwise) to the Platform, you grant PowerMySport a perpetual,
              irrevocable, worldwide, royalty-free, sublicensable license to
              use, reproduce, display, distribute, and create derivative works
              of that content for any purpose connected with operating,
              promoting, or improving the Platform, and you represent and
              warrant that you own or have the necessary rights to grant this
              license.
            </p>
          </section>

          <section id="feedback" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Feedback and Suggestions
            </h2>
            <p className="text-slate-600 leading-relaxed">
              If you send PowerMySport any feedback, ideas, or suggestions
              about the Platform or its features (&quot;Feedback&quot;), you
              agree that: (a) Feedback is given voluntarily and we are under
              no obligation of confidentiality with respect to it; (b) we may
              already be considering, or may independently develop, something
              similar; and (c) we may use, modify, and implement your
              Feedback for any purpose, without payment or attribution to
              you, and you waive any claim that a feature we build or ship is
              based on your Feedback.
            </p>
          </section>

          <section id="prohibited" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Prohibited Activities
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              You agree not to, and shall not permit any third party to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                Use the Platform for any illegal, fraudulent, or unauthorized
                purpose
              </li>
              <li>
                Harass, threaten, abuse, defame, or harm any other user
              </li>
              <li>
                Submit false, misleading, or manipulated information, reviews,
                or ratings
              </li>
              <li>
                Attempt to bypass, disable, or circumvent any security,
                verification, or payment feature
              </li>
              <li>
                Scrape, harvest, crawl, or extract data from the Platform by
                automated means
              </li>
              <li>
                Introduce viruses, malware, or any harmful code, or interfere
                with the proper functioning of the Platform
              </li>
              <li>
                Impersonate any person or entity, or misrepresent your
                affiliation with any person or entity
              </li>
              <li>
                Solicit, arrange, or complete any booking or payment outside
                the Platform to avoid commission or fees
                (&quot;circumvention&quot;), which constitutes a material
                breach entitling us to immediately terminate your account and
                pursue recovery of unpaid commission
              </li>
              <li>
                Post content that is obscene, defamatory, discriminatory, or
                infringes any third party&apos;s rights
              </li>
              <li>
                Use the Platform to collect or store personal data of other
                users except as strictly necessary to complete a booking
              </li>
              <li>
                Engage in money laundering, tax evasion, or any activity in
                violation of applicable financial regulations
              </li>
              <li>
                As an Expert, conduct or facilitate sessions outside the scope
                of lawful sports guidance, mentorship, or advisory services,
                or engage in any conduct during a session that is illegal,
                abusive, sexually inappropriate, or otherwise harmful to the
                client
              </li>
              <li>
                Solicit, encourage, or offer incentives for fake, paid, or
                coerced reviews or ratings on the Platform
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Violation of this section entitles us to immediately suspend or
              terminate your account, withhold pending payouts, and pursue any
              legal remedy available, without prior notice.
            </p>
          </section>

          <section id="warranties" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Disclaimer of Warranties
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              THE PLATFORM AND ALL CONTENT, LISTINGS, AND SERVICES ARE
              PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT
              WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
              INCLUDING WITHOUT LIMITATION WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WITHOUT
              LIMITING THE FOREGOING, WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                The Platform will be uninterrupted, timely, secure, or
                error-free
              </li>
              <li>Any defects or errors will be corrected</li>
              <li>
                The Platform is free of viruses or other harmful components
              </li>
              <li>
                Any listing, review, rating, or information provided by any
                user or third party is accurate, complete, or reliable
              </li>
              <li>
                Any booking or expert session will be honored, or that any
                venue, coach, expert, or academy will meet your expectations
              </li>
              <li>
                Any Expert&apos;s credentials, qualifications, or expertise
                claims are accurate, current, or sufficient for your
                particular needs
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              You use the Platform, and engage with any venue, coach, expert,
              or other user, entirely at your own risk.
            </p>
          </section>

          <section id="liability" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Limitation of Liability
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, POWERMYSPORT,
              ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS,
              REVENUE, DATA, GOODWILL, OR OPPORTUNITY, WHETHER ARISING FROM
              CONTRACT, TORT, NEGLIGENCE, OR OTHERWISE, AND WHETHER OR NOT WE
              HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p className="text-slate-600 leading-relaxed mb-4">
              WE ARE NOT LIABLE FOR THE ACTS, OMISSIONS, NEGLIGENCE, OR
              MISCONDUCT OF ANY VENUE LISTER, COACH, EXPERT, ACADEMY, OR OTHER
              USER, INCLUDING ANY PERSONAL INJURY, PROPERTY DAMAGE, OR
              FINANCIAL LOSS ARISING FROM A BOOKING, EXPERT SESSION, OR
              IN-PERSON INTERACTION FACILITATED THROUGH THE PLATFORM. THIS
              INCLUDES, WITHOUT LIMITATION, ANY CLAIM ARISING FROM THE QUALITY,
              ACCURACY, OR OUTCOME OF ADVICE OR GUIDANCE PROVIDED BY AN EXPERT
              DURING A SESSION.
            </p>
            <p className="text-slate-600 leading-relaxed">
              IN ANY EVENT, OUR AGGREGATE LIABILITY ARISING OUT OF OR RELATING
              TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE
              LESSER OF (A) THE AMOUNT YOU ACTUALLY PAID TO US IN THE THREE
              (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE
              CLAIM, OR (B) TEN THOUSAND RUPEES (&#8377;10,000).
            </p>
          </section>

          <section id="indemnification" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Indemnification
            </h2>
            <p className="text-slate-600 leading-relaxed">
              You agree to indemnify, defend, and hold harmless PowerMySport,
              its officers, directors, employees, and agents from and against
              any and all claims, demands, losses, liabilities, damages, costs,
              and expenses (including reasonable legal fees) arising out of or
              in any way connected with: (a) your use or misuse of the
              Platform; (b) your violation of these Terms or any applicable
              law; (c) your infringement of any right of a third party,
              including intellectual property or privacy rights; (d) any
              content, listing, or information you submit; (e) any dispute,
              injury, or damage arising between you and another user; or (f)
              for Experts specifically, any advice, guidance, or service
              provided during a session and any claim by a client arising
              therefrom, including any claim based on the Expert&apos;s
              credentials, representations, or conduct. This obligation
              survives termination of your account or these Terms.
            </p>
          </section>

          <section id="dispute" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Dispute Resolution and Arbitration
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In the event of any dispute, controversy, or claim arising out
              of or relating to these Terms or the use of the Platform:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                You must first raise the issue with our support team in writing
                and allow thirty (30) days for resolution before pursuing any
                other remedy
              </li>
              <li>
                If unresolved, the dispute shall be referred to and finally
                resolved by binding arbitration conducted by a sole arbitrator
                appointed by PowerMySport, in accordance with the Arbitration
                and Conciliation Act, 1996 (as amended)
              </li>
              <li>
                The seat and venue of arbitration shall be Mullanpur, Punjab,
                India, and the proceedings shall be conducted in English
              </li>
              <li>
                Each party shall bear its own costs of arbitration unless the
                arbitrator directs otherwise
              </li>
              <li>The arbitration award shall be final and binding on both parties</li>
              <li>
                To the extent permitted by law, you agree not to bring or
                participate in any class, collective, or representative action
                against PowerMySport; this does not affect any non-waivable
                right you have to file a complaint jointly with other consumers
                under Section 35 of the Consumer Protection Act, 2019
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Nothing in this arbitration clause is intended to, or shall be
              construed to, deprive you of any right you have as a
              &quot;consumer&quot; to approach the appropriate District, State,
              or National Consumer Disputes Redressal Commission under the
              Consumer Protection Act, 2019, to the extent such right cannot
              be excluded by agreement under applicable Indian law.
            </p>
          </section>

          <section id="grievance" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Grievance Redressal
            </h2>
            <p className="text-slate-600 leading-relaxed">
              In accordance with the Information Technology (Intermediary
              Guidelines and Digital Media Ethics Code) Rules, 2021 and the
              Consumer Protection (E-Commerce) Rules, 2020, complaints
              regarding content, listings, transactions, or user conduct on
              the Platform may be directed to our Grievance Officer at the
              contact details in our Privacy Policy. We will acknowledge your
              complaint within 24 hours and endeavor to redress it within 15
              days (or, for e-commerce/booking-related complaints, within one
              month) of receipt.
            </p>
          </section>

          <section id="termination" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Termination
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              We reserve the right, at our sole discretion and without prior
              notice or liability, to suspend, restrict, or permanently
              terminate your account and access to the Platform for:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
              <li>Any actual or suspected violation of these Terms</li>
              <li>Fraudulent, deceptive, or illegal activity</li>
              <li>Non-payment, repeated failed payments, or chargebacks</li>
              <li>Abusive behavior toward other users or staff</li>
              <li>
                For Experts specifically: misrepresentation during verification,
                repeated session cancellations or no-shows, soliciting reviews
                or payments outside the Platform, breach of client
                confidentiality, or failure to maintain a valid payout method
              </li>
              <li>Extended inactivity</li>
              <li>Any other reason, at our sole and absolute discretion</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              Upon termination, your right to access the Platform ceases
              immediately, any pending payouts may be withheld pending
              investigation, and no fees already paid will be refunded except
              as strictly required by our Cancellation, Refund &amp; Dispute
              Policy. You may request deletion of your account at any time,
              subject to our right to retain information as required for legal,
              accounting, fraud-prevention, or dispute-resolution purposes.
            </p>
            <p className="text-slate-600 leading-relaxed mt-4">
              A venue lister, coach, or expert whose account is suspended or
              terminated may request reconsideration by writing to
              teams@powermysport.com within fifteen (15) days of the action,
              explaining why the action should be reversed. We will review
              the request and respond within a reasonable time. Requesting
              reconsideration does not suspend the original action, and our
              decision on reconsideration is final.
            </p>
          </section>

          <section id="relationship" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Relationship of Parties
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Nothing in these Terms creates an employment, partnership,
              joint-venture, franchise, or agency relationship between
              PowerMySport and any user. Venue listers, coaches, experts, and
              academies act solely as independent contractors and are
              exclusively responsible for their own tax, statutory, licensing,
              and legal obligations arising from their use of the Platform.
              PowerMySport exercises no control over the manner, means, or
              outcome of any session conducted by an Expert; the Expert is the
              sole service provider and bears all responsibility for the
              quality, safety, and legality of the services they deliver.
            </p>
          </section>

          <section id="force-majeure" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Force Majeure
            </h2>
            <p className="text-slate-600 leading-relaxed">
              PowerMySport shall not be liable for any failure or delay in
              performance resulting from causes beyond its reasonable control,
              including natural disasters, government action, pandemics,
              internet or telecommunications failures, power outages, or
              failures of third-party payment or infrastructure providers.
            </p>
          </section>

          <section id="general" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              General Provisions
            </h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                <strong>Severability:</strong> If any provision of these Terms
                is held invalid or unenforceable, the remaining provisions
                shall continue in full force and effect
              </li>
              <li>
                <strong>No Waiver:</strong> Our failure to enforce any
                provision shall not be construed as a waiver of that or any
                other provision
              </li>
              <li>
                <strong>Assignment:</strong> We may assign or transfer these
                Terms and our rights hereunder at our sole discretion; you may
                not assign or transfer your rights or obligations without our
                prior written consent
              </li>
              <li>
                <strong>Electronic Communications:</strong> You consent to
                receive communications from us electronically, and agree that
                such communications satisfy any legal requirement that they be
                in writing
              </li>
              <li>
                <strong>Entire Agreement:</strong> These Terms, together with
                our Privacy Policy and Cancellation, Refund &amp; Dispute
                Policy, constitute the entire agreement between you and
                PowerMySport regarding the Platform
              </li>
              <li>
                <strong>Time to Bring Claims:</strong> Any claim or cause of
                action you may have against PowerMySport arising out of or
                relating to these Terms or the Platform must be commenced
                within one (1) year after the claim or cause of action
                arises, or it is permanently barred, regardless of any longer
                statutory limitation period that would otherwise apply,
                except where such a time limit cannot lawfully be shortened
                under applicable Indian law
              </li>
            </ul>
          </section>

          <section id="governing-law" className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Governing Law
            </h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by and construed in accordance
              with the laws of India, without regard to its conflict of law
              provisions. Subject to the arbitration clause above, the courts
              located in Mullanpur, Punjab, India shall have exclusive
              jurisdiction over any matter not subject to arbitration. The
              Platform additionally operates subject to the Consumer Protection
              Act, 2019, the Consumer Protection (E-Commerce) Rules, 2020, the
              Information Technology Act, 2000 and rules made thereunder, and
              the Digital Personal Data Protection Act, 2023, each as in force
              and applicable from time to time.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Contact Information
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              For questions about these Terms of Service, please contact us:
            </p>
            <div className="bg-slate-50 p-4 rounded-lg not-prose">
              <p className="text-slate-700 mb-2">
                <strong>Legal Entity:</strong> Powermysport Private Limited
              </p>
              <p className="text-slate-700 mb-2">
                <strong>CIN:</strong> U93120PB2026PTC067587
              </p>
              <p className="text-slate-700 flex items-center gap-2 mb-2">
                <Mail size={18} className="text-power-orange" />
                <strong>Email:</strong> teams@powermysport.com
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> +91 89685 82443
              </p>
              <p className="text-slate-700">
                <strong>Registered Office:</strong> Mullanpur, Punjab.
              </p>
            </div>
          </section>
          </Card>
        </div>
      </div>
    </div>
  );
}
