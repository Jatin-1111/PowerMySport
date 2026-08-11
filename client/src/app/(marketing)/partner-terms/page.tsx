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
  Baby,
  CalendarX,
  Copyright,
  FileSignature,
  Gavel,
  Handshake,
  HandCoins,
  Landmark,
  Lock,
  Mail,
  Megaphone,
  Percent,
  ReceiptIndianRupee,
  Scale,
  ScrollText,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const PARTNER_TOC: LegalTocItem[] = [
  { id: "scope", label: "Scope & Acceptance", icon: ScrollText },
  { id: "definitions", label: "Who These Terms Cover", icon: Users },
  { id: "eligibility", label: "Eligibility & Onboarding", icon: UserCheck },
  { id: "verification", label: "Verification & Approval", icon: BadgeCheck },
  { id: "listing", label: "Listing & Profile Standards", icon: FileSignature },
  { id: "delivery", label: "Service Delivery Obligations", icon: Handshake },
  { id: "child-safety", label: "Child Safety & Minors", icon: Baby },
  { id: "commission", label: "Commission — 15% of Partner Fee", icon: Percent },
  { id: "payouts", label: "Payouts & Settlement", icon: Wallet },
  { id: "taxes", label: "Taxes, Invoicing & TDS", icon: ReceiptIndianRupee },
  {
    id: "cancellations",
    label: "Cancellations, Refunds & No-Shows",
    icon: CalendarX,
  },
  { id: "reviews", label: "Reviews & Ratings", icon: Star },
  { id: "circumvention", label: "Non-Circumvention", icon: Ban },
  { id: "relationship", label: "Independent Contractor Status", icon: Scale },
  { id: "data", label: "Confidentiality & Data Protection", icon: Lock },
  { id: "ip", label: "Brand, Content & Marketing Licence", icon: Copyright },
  {
    id: "insurance",
    label: "Insurance, Indemnity & Liability",
    icon: ShieldCheck,
  },
  { id: "termination", label: "Suspension, Termination & Exit", icon: XCircle },
  { id: "grievance", label: "Grievance Redressal", icon: Megaphone },
  { id: "disputes", label: "Governing Law & Disputes", icon: Gavel },
  { id: "amendments", label: "Amendments & General", icon: Landmark },
  { id: "contact", label: "Contact Information", icon: Mail },
];

export default function PartnerTermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <LegalPageHeader
        icon={HandCoins}
        title="Partner Terms — Experts & Academies"
        lastUpdated="August 11, 2026"
        effective="August 11, 2026"
      />

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[280px_1fr] lg:gap-10">
          <LegalTableOfContents items={PARTNER_TOC} />
          <Card className="legal-content bg-white p-8 prose prose-slate max-w-none lg:col-start-2">
            <section id="scope" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Scope &amp; Acceptance
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                These Partner Terms &amp; Conditions (&quot;Partner Terms&quot;)
                govern the onboarding and continued participation of Experts and
                Academies (each a &quot;Partner,&quot; &quot;you,&quot; or
                &quot;your&quot;) on the PowerMySport platform, operated by
                Powermysport Private Limited (&quot;PowerMySport,&quot;
                &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
              </p>
              <div className="bg-orange-50 border-l-4 border-power-orange p-4 mb-4 rounded-r-lg not-prose">
                <p className="text-slate-700 text-sm font-medium">
                  By submitting an onboarding application, ticking the agreement
                  checkbox, or accepting your first booking on the Platform, you
                  confirm that you have read, understood, and agree to be bound
                  by these Partner Terms. If you do not agree, do not submit an
                  application and do not accept bookings.
                </p>
              </div>
              <p className="text-slate-600 leading-relaxed mb-4">
                These Partner Terms are supplemental to, and are read together
                with, our{" "}
                <Link href="/terms" className="text-orange-600 hover:underline">
                  Terms of Service
                </Link>
                ,{" "}
                <Link
                  href="/privacy"
                  className="text-orange-600 hover:underline"
                >
                  Privacy Policy
                </Link>
                ,{" "}
                <Link
                  href="/refund-policy"
                  className="text-orange-600 hover:underline"
                >
                  Cancellation, Refund &amp; Dispute Policy
                </Link>
                , and{" "}
                <Link
                  href="/content-policy"
                  className="text-orange-600 hover:underline"
                >
                  Content Policy
                </Link>
                , each of which is incorporated here by reference.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Where these Partner Terms conflict with the general Terms of
                Service on a matter specific to Partners — commission, payouts,
                verification, listing standards, or exit — these Partner Terms
                control. On all other matters, the Terms of Service control.
              </p>
            </section>

            <section id="definitions" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Who These Terms Cover
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  <strong>Experts:</strong> Individual professionals — including
                  ex-professional players, certified coaches, analysts, and
                  mentors — who offer paid one-on-one guidance, mentorship,
                  career advice, or advisory sessions through the Platform, in
                  online or in-person format.
                </li>
                <li>
                  <strong>Academies:</strong> Registered organisations, clubs,
                  or training centres that list structured coaching programmes,
                  batches, subscription plans, packages, or trial classes on the
                  Platform.
                </li>
                <li>
                  <strong>Partner Fee:</strong> The base price you set for your
                  session, batch, programme, package, or subscription, exclusive
                  of GST and of any charge levied by PowerMySport.
                </li>
                <li>
                  <strong>Transaction:</strong> Any booking, session, trial
                  class, package purchase, or subscription payment made by a
                  client through the Platform for your services.
                </li>
                <li>
                  <strong>Completed Transaction:</strong> A Transaction that has
                  reached COMPLETED status on the Platform and is not subject to
                  a pending refund, dispute, or chargeback.
                </li>
              </ul>
            </section>

            <section id="eligibility" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Eligibility &amp; Onboarding
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                To onboard as a Partner you represent and warrant that you meet
                all of the following at the time of application and continuously
                thereafter:
              </p>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                For Experts
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  You are at least 18 years of age and legally competent to
                  contract in India
                </li>
                <li>
                  You hold genuine, verifiable credentials, certifications,
                  playing records, or professional experience in the sports and
                  expertise areas you list
                </li>
                <li>
                  You can furnish government-issued photo identity proof, PAN,
                  and supporting credential documents on request
                </li>
                <li>
                  You maintain at least one valid payout method (bank account or
                  UPI) in your own name
                </li>
                <li>
                  You are not subject to any ban, suspension, or disciplinary
                  action by a recognised sports federation, and you have no
                  conviction for an offence involving violence, sexual
                  misconduct, fraud, or an offence against a child
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                For Academies
              </h3>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  You are a validly constituted entity (proprietorship,
                  partnership, LLP, company, society, or trust) or an individual
                  operating a coaching set-up, and the person completing
                  onboarding is authorised to bind the entity
                </li>
                <li>
                  You can furnish entity registration proof, PAN, GSTIN (where
                  registered), address proof of each training location, and,
                  where applicable, municipal or local body permissions to
                  operate
                </li>
                <li>
                  Every coach you deploy holds the qualifications you represent
                  on the Platform, and you have verified their antecedents
                </li>
                <li>
                  Your training facilities are safe, hygienic, and compliant
                  with applicable safety, zoning, fire, and licensing norms, and
                  you hold the insurance required to operate them
                </li>
                <li>
                  You maintain at least one valid payout method in the name of
                  the entity or proprietor
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Accuracy of Submissions
              </h3>
              <p className="text-slate-600 leading-relaxed">
                All information and documents submitted during onboarding must
                be true, current, and complete. Submitting forged, altered, or
                misleading documents is a material breach entitling us to reject
                the application, terminate the account, withhold pending payouts
                pending investigation, and report the matter to the appropriate
                authorities. You must update the Platform promptly whenever
                submitted information changes — for example if a certification
                lapses, a facility closes, or a payout account is replaced.
              </p>
            </section>

            <section id="verification" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Verification &amp; Approval
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                No Partner profile goes live automatically. Every application is
                reviewed by the PowerMySport team before it becomes visible to
                clients.
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  <strong>UNVERIFIED:</strong> The account exists but the
                  profile is hidden and cannot receive bookings. You must
                  complete the onboarding wizard and submit for review.
                </li>
                <li>
                  <strong>PENDING:</strong> The application is under review. We
                  aim to complete review within 5–7 business days, though it may
                  take longer where documents require third-party verification.
                  You are notified of the outcome by email and in-platform
                  notification.
                </li>
                <li>
                  <strong>APPROVED:</strong> The profile is live, discoverable,
                  and eligible to receive bookings.
                </li>
                <li>
                  <strong>REJECTED:</strong> The application did not meet our
                  requirements. You will receive a reason and may resubmit after
                  addressing it. Repeated misrepresentation may result in a
                  permanent bar from the Partner programme.
                </li>
              </ul>
              <p className="text-slate-600 leading-relaxed mb-4">
                We may conduct background checks, reference checks, credential
                verification, facility inspection, or third-party verification
                at any time, including after approval. You agree to cooperate
                with such checks and to provide documents within seven (7) days
                of a request.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Approval is not an endorsement, certification, or guarantee by
                PowerMySport of your competence, safety, or results. We may
                revoke APPROVED status at any time where information is found to
                be false, where conduct falls below expected standards, or where
                continued listing poses a risk to clients.
              </p>
            </section>

            <section id="listing" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Listing &amp; Profile Standards
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  <strong>Truthful representation:</strong> Bio, achievements,
                  qualifications, coaching staff, facilities, batch sizes, and
                  programme outcomes must accurately reflect reality.
                  Unverifiable superlatives and guaranteed-selection or
                  guaranteed-result claims are prohibited and may be removed
                  without notice.
                </li>
                <li>
                  <strong>Photographs:</strong> Expert profile photos must be a
                  clear, recent image of the Expert. Academy images must be of
                  your own facilities. Stock imagery, third-party photographs,
                  or images you do not have the right to use are prohibited.
                </li>
                <li>
                  <strong>Pricing integrity:</strong> Set the Partner Fee in
                  good faith to reflect the service actually delivered.
                  Inflating the listed fee while privately offering a discount
                  off-Platform is circumvention (see below).
                </li>
                <li>
                  <strong>Availability accuracy:</strong> Keep schedules, batch
                  timings, seat availability, and blackout dates current.
                  Conflicts arising from stale availability are treated as
                  Partner-side cancellations.
                </li>
                <li>
                  <strong>Contact details:</strong> Do not publish phone
                  numbers, email addresses, social handles, payment QR codes, or
                  external booking links in profile text, images, or messages.
                </li>
                <li>
                  <strong>Discovery ranking:</strong> Listing order is
                  determined by verification status, ratings, review volume,
                  proximity, and recency of activity. We do not currently sell
                  placement; if we introduce paid placement, it will be labelled
                  as such.
                </li>
              </ul>
            </section>

            <section id="delivery" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Service Delivery Obligations
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  <strong>Respond promptly:</strong> Experts must accept or
                  decline a booking request within 24 hours of notification.
                  Academies must confirm trial-class and enrolment requests
                  within the response window shown in their dashboard.
                </li>
                <li>
                  <strong>Honour confirmed bookings:</strong> Once a Transaction
                  is confirmed you must deliver the service as described, at the
                  time, place, and mode agreed. Cancelling a confirmed booking
                  entitles the client to a full refund and may result in payout
                  forfeiture for that Transaction and account action.
                </li>
                <li>
                  <strong>Cancellation notice:</strong> Where cancellation is
                  unavoidable, notify the client and PowerMySport as early as
                  possible and in any case no later than 24 hours before the
                  scheduled start. Late cancellations and no-shows are breaches
                  of these Partner Terms.
                </li>
                <li>
                  <strong>Online sessions:</strong> Provide a valid, working
                  meeting link on the Platform at least 2 hours before the
                  scheduled start. Failure to do so is treated as a Partner-side
                  cancellation.
                </li>
                <li>
                  <strong>In-person sessions and batches:</strong> The address
                  you provide must be accurate, accessible, and safe. You are
                  solely responsible for the suitability, safety, supervision,
                  and legal compliance of the venue. Do not change a confirmed
                  location without the client&apos;s consent and notice to
                  PowerMySport.
                </li>
                <li>
                  <strong>Qualified delivery:</strong> Services must be
                  delivered by the Expert whose profile was booked, or — for
                  Academies — by coaching staff of at least the qualification
                  level represented in your listing. Undisclosed substitution is
                  a breach.
                </li>
                <li>
                  <strong>Professional conduct:</strong> Be punctual,
                  respectful, and non-discriminatory. Do not use sessions to
                  solicit unrelated business, promote third-party products, or
                  collect payments outside the Platform.
                </li>
                <li>
                  <strong>Safety:</strong> Maintain first-aid provision
                  appropriate to the activity, screen for disclosed medical
                  conditions before physical training, and stop any activity
                  that becomes unsafe.
                </li>
              </ul>
            </section>

            <section id="child-safety" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Child Safety &amp; Minors
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                A large share of clients on PowerMySport are minors booked by a
                parent or guardian. Partners who train minors accept the
                following additional obligations, which we treat as
                non-negotiable:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  Comply with the Protection of Children from Sexual Offences
                  Act, 2012 (POCSO), the Juvenile Justice (Care and Protection
                  of Children) Act, 2015, and all other laws protecting children
                </li>
                <li>
                  Ensure that every coach, assistant, or staff member who has
                  contact with minors has been antecedent-verified by you, and
                  immediately remove from child-facing duty any person against
                  whom a credible allegation is made
                </li>
                <li>
                  Do not conduct one-on-one sessions with a minor in a private
                  or unobserved setting; a parent, guardian, or second adult
                  must be able to observe
                </li>
                <li>
                  Do not contact a minor privately on personal phone numbers or
                  social media; all communication must run through the Platform
                  or the parent/guardian
                </li>
                <li>
                  Do not photograph or publish images of a minor without the
                  documented consent of the parent or guardian
                </li>
                <li>
                  Report any safeguarding incident to the parent/guardian, to
                  PowerMySport at teams@powermysport.com, and to the appropriate
                  authority, immediately
                </li>
              </ul>
              <p className="text-slate-600 leading-relaxed mt-4">
                Breach of this section results in immediate delisting and
                permanent termination, without the reconsideration process
                described below.
              </p>
            </section>

            <section id="commission" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Commission — 15% of Partner Fee
              </h2>
              <div className="bg-orange-50 border-l-4 border-power-orange p-4 mb-5 rounded-r-lg not-prose">
                <p className="text-slate-800 text-sm font-semibold">
                  PowerMySport charges a platform commission of 15% (fifteen
                  percent) of the Partner Fee on every Completed Transaction
                  booked through the Platform. The commission is deducted from
                  the amount collected from the client before your payout is
                  released.
                </p>
              </div>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
                <li>
                  The 15% commission applies uniformly to Expert sessions,
                  academy trial classes, batch enrolments, packages, and
                  subscription plans transacted through the Platform
                </li>
                <li>
                  Commission is calculated on the Partner Fee{" "}
                  <strong>excluding</strong> GST and excluding any convenience
                  or service charge shown separately to the client
                </li>
                <li>
                  GST is charged on the commission at the rate then in force
                  (currently 18%) and is recovered along with the commission. A
                  tax invoice for the commission and GST is issued to you
                </li>
                <li>
                  Payment gateway charges levied by our payment partners are
                  non-refundable and, where they are not already borne by
                  PowerMySport, may be recovered from settlement. Any such
                  charge is itemised in your earnings statement
                </li>
                <li>
                  No commission is charged on a Transaction that is cancelled
                  and fully refunded to the client. Where a partial refund is
                  issued, commission is recomputed on the retained amount and
                  the difference is adjusted in your next settlement
                </li>
                <li>
                  There is no joining fee, listing fee, or monthly subscription
                  charge for onboarding as a Partner. Commission is the only
                  standing charge
                </li>
              </ul>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Worked Example
              </h3>
              <div className="bg-slate-50 p-4 rounded-lg not-prose mb-6">
                <p className="text-slate-700 text-sm mb-3">
                  For a session or programme with a Partner Fee of{" "}
                  <strong>&#8377;1,000</strong>:
                </p>
                <ul className="text-slate-700 text-sm space-y-1.5">
                  <li>Partner Fee (base): &#8377;1,000.00</li>
                  <li>Platform commission @ 15%: &#8722; &#8377;150.00</li>
                  <li>GST @ 18% on commission: &#8722; &#8377;27.00</li>
                  <li className="font-semibold pt-1.5 border-t border-slate-200">
                    Net payable to Partner: &#8377;823.00
                  </li>
                </ul>
                <p className="text-slate-500 text-xs mt-3">
                  Illustrative only. TDS, if applicable, is deducted from the
                  net amount, and any GST payable by you on your own services is
                  handled per the Taxes section below. Actual figures for each
                  Transaction are shown in your earnings dashboard before
                  payout.
                </p>
              </div>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Changes to the Commission Rate
              </h3>
              <p className="text-slate-600 leading-relaxed mb-4">
                We may revise the commission rate. Any increase takes effect no
                earlier than thirty (30) days after we notify you by email and
                in-platform notice, and applies only to Transactions booked on
                or after the effective date — bookings already confirmed at the
                old rate are settled at the old rate. If you do not accept a
                revised rate, you may terminate under the Exit section, subject
                to honouring your confirmed bookings.
              </p>
              <p className="text-slate-600 leading-relaxed">
                We may run promotional or introductory periods at a reduced or
                zero commission rate for specific Partners, sports, or cities.
                Such concessions are discretionary, time-bound, communicated in
                writing, and revert to the standard 15% on expiry.
              </p>
            </section>

            <section id="payouts" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Payouts &amp; Settlement
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>
                  <strong>Collection:</strong> Client payments are collected by
                  PowerMySport through authorised payment partners. You have no
                  right to collect payment directly for a Transaction initiated
                  on the Platform
                </li>
                <li>
                  <strong>Expert sessions:</strong> Payout is released 24 hours
                  after the session reaches COMPLETED status. This window allows
                  post-session disputes and refund requests to be raised before
                  funds are disbursed
                </li>
                <li>
                  <strong>Academy programmes:</strong> Payouts are settled on
                  the cycle shown in your earnings dashboard, calculated on
                  Transactions that completed within the cycle. For multi-month
                  subscriptions, settlement follows the collection schedule, not
                  the full programme value upfront
                </li>
                <li>
                  <strong>Payout method:</strong> Funds are credited to the
                  default bank account or UPI handle on file at the time of
                  release. We are not liable for failed or misdirected payouts
                  caused by incorrect or outdated details you provided
                </li>
                <li>
                  <strong>Statements:</strong> A per-Transaction breakdown —
                  gross amount, 15% commission, GST, any gateway charge, TDS,
                  and net payout — is available in your dashboard
                </li>
                <li>
                  <strong>Withholding and offset:</strong> We may withhold or
                  set off any payout where (a) the Transaction is under dispute
                  or chargeback; (b) a refund is pending; (c) you owe us
                  commission, penalties, or recovery amounts; (d) the
                  Transaction was cancelled by you; or (e) we have reasonable
                  grounds to suspect fraud or policy violation. Withheld amounts
                  are released once the matter is resolved in your favour
                </li>
                <li>
                  <strong>Disputed statements:</strong> Raise any payout
                  discrepancy in writing within thirty (30) days of the
                  statement date. Statements not disputed within that period are
                  deemed accepted
                </li>
              </ul>
            </section>

            <section id="taxes" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Taxes, Invoicing &amp; TDS
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  You are solely responsible for determining, charging,
                  reporting, and remitting all taxes applicable to your
                  services, including GST and income tax
                </li>
                <li>
                  You must provide a valid PAN, and a GSTIN if you are
                  registered under GST. Failure to provide a PAN attracts TDS at
                  the higher rate prescribed by law
                </li>
                <li>
                  PowerMySport deducts tax at source where required — including
                  under Section 194-O of the Income-tax Act, 1961 for e-commerce
                  participants — and issues the corresponding statutory
                  certificate. TCS/TDS under GST law is applied where applicable
                </li>
                <li>
                  We issue you a tax invoice for the commission and GST charged
                  on it. Where you are GST-registered, you are responsible for
                  raising your own invoices to clients as required by law
                </li>
                <li>
                  Nothing in these Partner Terms is tax advice. You should take
                  your own professional advice on your obligations
                </li>
              </ul>
            </section>

            <section id="cancellations" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Cancellations, Refunds &amp; No-Shows
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Client-facing cancellation and refund entitlements are governed
                by our{" "}
                <Link
                  href="/refund-policy"
                  className="text-orange-600 hover:underline"
                >
                  Cancellation, Refund &amp; Dispute Policy
                </Link>
                . As between you and PowerMySport:
              </p>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  Where you cancel a confirmed Transaction, the client is
                  refunded in full and no payout is due to you for that
                  Transaction
                </li>
                <li>
                  Where the client cancels, refund treatment follows the
                  published policy; you are paid on any amount properly
                  retained, less the 15% commission on that retained amount
                </li>
                <li>
                  Where a client raises a service-quality complaint, we may
                  investigate and, acting reasonably, issue a full or partial
                  refund and recover the corresponding amount from your payout.
                  You will be given an opportunity to respond before recovery
                  except where the facts are undisputed
                </li>
                <li>
                  Repeated Partner-side cancellations, no-shows, or upheld
                  quality complaints may result in reduced ranking, suspension,
                  or termination
                </li>
                <li>
                  Chargebacks raised by clients are investigated case by case.
                  If a chargeback is upheld against a Transaction you delivered,
                  the disputed amount and any associated bank charge may be
                  recovered from your settlements
                </li>
              </ul>
            </section>

            <section id="reviews" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Reviews &amp; Ratings
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  Clients may rate and review you after a Completed Transaction.
                  Reviews appear publicly on your profile and contribute to your
                  average rating and discovery ranking
                </li>
                <li>
                  Ratings are computed on verified completed Transactions only
                </li>
                <li>
                  We do not edit review content. We may hide or remove reviews
                  that breach our Content Policy. You may flag a review as
                  inappropriate for admin review
                </li>
                <li>
                  Soliciting, incentivising, purchasing, or coercing reviews,
                  and pressuring a client to withdraw a genuine negative review,
                  are prohibited and are grounds for termination
                </li>
              </ul>
            </section>

            <section id="circumvention" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Non-Circumvention
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                You must not solicit, arrange, or complete any session,
                programme, enrolment, or payment off-Platform with a client you
                were introduced to through PowerMySport, for the purpose of
                avoiding commission. This includes sharing personal contact or
                payment details before a booking is confirmed, offering an
                off-Platform discount, or asking a client to cancel and rebook
                directly.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                This obligation applies for the duration of your participation
                on the Platform and for twelve (12) months after your account is
                closed, in respect of clients first introduced through the
                Platform. It does not apply to clients you can demonstrate you
                were already serving before the introduction.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Circumvention is a material breach. We may terminate your
                account immediately, withhold pending payouts, and recover the
                commission that would have been payable on the circumvented
                Transactions, together with our costs of recovery.
              </p>
            </section>

            <section id="relationship" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Independent Contractor Status
              </h2>
              <p className="text-slate-600 leading-relaxed">
                You are an independent service provider. Nothing in these
                Partner Terms creates an employment, partnership, joint-venture,
                franchise, or agency relationship between you and PowerMySport,
                and you must not represent otherwise. You control the manner,
                method, curriculum, and personnel used to deliver your services;
                you bear your own costs, equipment, staff, statutory
                obligations, and taxes. PowerMySport is an intermediary
                technology platform that facilitates discovery, booking, and
                payment collection, and is not a party to the service contract
                formed between you and the client.
              </p>
            </section>

            <section id="data" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Confidentiality &amp; Data Protection
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  Client personal data disclosed to you through the Platform —
                  names, contact details, addresses, age, assessment results,
                  medical disclosures, session content — may be used only to
                  deliver the booked service, and for no other purpose
                </li>
                <li>
                  You must not sell, rent, publish, or transfer client data to
                  any third party, or add clients to marketing lists, without
                  their explicit consent
                </li>
                <li>
                  You must comply with the Digital Personal Data Protection Act,
                  2023 and apply reasonable security safeguards to any client
                  data you hold. Notify us at teams@powermysport.com within 24
                  hours of becoming aware of any breach affecting client data
                </li>
                <li>
                  Do not disclose the identity, session content, or
                  communications of any client to a third party without the
                  client&apos;s prior written consent, except where required by
                  law or where disclosure is necessary to protect a child or
                  prevent serious harm
                </li>
                <li>
                  Commercial terms, pricing structures, product roadmaps, and
                  other non-public information shared with you by PowerMySport
                  are confidential and survive termination
                </li>
              </ul>
            </section>

            <section id="ip" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Brand, Content &amp; Marketing Licence
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                You grant PowerMySport a non-exclusive, worldwide, royalty-free,
                sublicensable licence to use, reproduce, display, and adapt your
                name, trading name, logo, profile photographs, facility images,
                listing content, and completed-session statistics for the
                purposes of operating, promoting, and marketing the Platform and
                your listing on it. This licence continues for material already
                published for a reasonable period after termination, after which
                we will remove your listing content from active surfaces.
              </p>
              <p className="text-slate-600 leading-relaxed mb-4">
                You warrant that you own or are licensed to use all content you
                upload and that it infringes no third-party right.
              </p>
              <p className="text-slate-600 leading-relaxed">
                The PowerMySport name, logo, and platform content remain our
                exclusive property. You may state that you are listed on
                PowerMySport, but you may not use our marks in a manner
                suggesting employment, endorsement, accreditation, or joint
                venture, and you must stop all use on termination.
              </p>
            </section>

            <section id="insurance" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Insurance, Indemnity &amp; Liability
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>
                  You are responsible for maintaining adequate public liability
                  and (for Academies) premises insurance appropriate to the
                  activities you deliver, and must produce proof on request
                </li>
                <li>
                  PowerMySport bears no responsibility for injury, illness,
                  loss, or damage arising during or from any session, batch, or
                  programme you deliver, whether online or in person
                </li>
                <li>
                  You will indemnify, defend, and hold harmless PowerMySport,
                  its officers, directors, employees, and agents against all
                  claims, losses, liabilities, damages, costs, and legal fees
                  arising from (a) your services or the conduct of your staff;
                  (b) breach of these Partner Terms or any law; (c)
                  misrepresentation of your credentials or facilities; (d)
                  injury or harm to a client; or (e) any tax, statutory, or
                  employment claim relating to you or your personnel. This
                  obligation survives termination
                </li>
                <li>
                  Our aggregate liability to you arising out of or relating to
                  these Partner Terms shall not exceed the total commission
                  actually retained by us from your Transactions in the three
                  (3) months immediately preceding the event giving rise to the
                  claim
                </li>
                <li>
                  We are not liable for indirect, incidental, special, or
                  consequential loss, or for loss of profit, revenue, goodwill,
                  or anticipated bookings, howsoever arising
                </li>
              </ul>
            </section>

            <section id="termination" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Suspension, Termination &amp; Exit
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-4">
                <li>
                  <strong>Voluntary exit:</strong> You may leave the Platform by
                  giving us thirty (30) days&apos; written notice at
                  teams@powermysport.com. You must honour every booking already
                  confirmed for a date within the notice period, or fund the
                  refund of any you cannot honour
                </li>
                <li>
                  <strong>Suspension:</strong> We may suspend your listing
                  immediately, pending investigation, where there is a credible
                  safety complaint, suspected fraud, a payment or documentation
                  irregularity, or repeated client complaints
                </li>
                <li>
                  <strong>Termination for breach:</strong> We may terminate
                  immediately for material breach, including misrepresentation
                  during verification, circumvention, breach of the child safety
                  section, repeated cancellations or no-shows, review
                  manipulation, or failure to maintain required documents or a
                  valid payout method
                </li>
                <li>
                  <strong>Settlement on exit:</strong> Amounts properly due for
                  Transactions completed before termination are settled in the
                  normal cycle, less commission, recoveries, and any amount
                  withheld pending an open dispute
                </li>
                <li>
                  <strong>Reconsideration:</strong> Except for terminations
                  under the Child Safety section, you may request
                  reconsideration in writing within fifteen (15) days of the
                  action, explaining why it should be reversed. Requesting
                  reconsideration does not suspend the action, and our decision
                  on it is final
                </li>
              </ul>
              <p className="text-slate-600 leading-relaxed">
                The Non-Circumvention, Confidentiality, Indemnity, Liability,
                and Dispute Resolution sections survive termination.
              </p>
            </section>

            <section id="grievance" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Grievance Redressal
              </h2>
              <p className="text-slate-600 leading-relaxed">
                Complaints about payouts, commission, listing treatment, account
                action, or client conduct may be raised with our Grievance
                Officer at the contact details in our Privacy Policy, or by
                writing to teams@powermysport.com. In line with the Information
                Technology (Intermediary Guidelines and Digital Media Ethics
                Code) Rules, 2021 and the Consumer Protection (E-Commerce)
                Rules, 2020, we will acknowledge your complaint within 24 hours
                and endeavour to resolve it within 15 days of receipt.
              </p>
            </section>

            <section id="disputes" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Governing Law &amp; Disputes
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                These Partner Terms are governed by the laws of India. Any
                dispute must first be raised in writing with our support team,
                and thirty (30) days allowed for resolution. If unresolved, the
                dispute shall be referred to and finally resolved by binding
                arbitration by a sole arbitrator under the Arbitration and
                Conciliation Act, 1996. The seat and venue of arbitration shall
                be Mullanpur, Punjab, India, and the proceedings shall be in
                English. Subject to arbitration, the courts at Mullanpur,
                Punjab, India have exclusive jurisdiction.
              </p>
              <p className="text-slate-600 leading-relaxed">
                Nothing here removes any non-waivable statutory right you hold
                under Indian law.
              </p>
            </section>

            <section id="amendments" className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Amendments &amp; General
              </h2>
              <ul className="list-disc pl-6 text-slate-600 space-y-2">
                <li>
                  <strong>Amendments:</strong> We may amend these Partner Terms.
                  Changes that materially affect your commercial position —
                  including commission, payout timing, or exit terms — take
                  effect no earlier than thirty (30) days after notice to you.
                  Other changes take effect on posting. Continued use after the
                  effective date is acceptance
                </li>
                <li>
                  <strong>Severability:</strong> If any provision is held
                  invalid, the remainder continues in full force
                </li>
                <li>
                  <strong>No waiver:</strong> Failure to enforce a provision is
                  not a waiver of it
                </li>
                <li>
                  <strong>Assignment:</strong> You may not assign these Partner
                  Terms without our written consent; we may assign them as part
                  of a corporate reorganisation or transfer of business
                </li>
                <li>
                  <strong>Electronic communications:</strong> You consent to
                  receiving notices electronically, and agree they satisfy any
                  requirement that a notice be in writing
                </li>
                <li>
                  <strong>Entire agreement:</strong> These Partner Terms,
                  together with the documents referenced in the Scope section
                  and any signed commercial addendum, form the entire agreement
                  between us regarding your participation as a Partner
                </li>
              </ul>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Contact Information
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                For questions about these Partner Terms, commission, or
                onboarding, please contact us:
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
