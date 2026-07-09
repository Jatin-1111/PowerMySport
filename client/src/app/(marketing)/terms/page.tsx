"use client";

import { Card } from "@/modules/shared/ui/Card";
import { FileText, Mail } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
              academies, and visitors, and supersede all prior agreements,
              representations, and understandings, whether written or oral.
            </p>
          </section>

          <section className="mb-8">
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
                <strong>Experts:</strong> Professionals offering guidance,
                consultation, or advisory services through the Platform
              </li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Academies, Coaches, and Experts may be subject to additional
              onboarding terms specific to their category, which are
              incorporated into these Terms by reference. Parents/guardians
              are fully responsible for all activity conducted through
              dependent profiles they create.
            </p>
            <p className="text-slate-600 leading-relaxed mt-4">
              PowerMySport is strictly an intermediary technology platform. We
              do not own, operate, control, employ, or supervise any venue,
              coach, or academy listed on the Platform, and we are not a party
              to any agreement formed between users. We do not guarantee the
              quality, safety, legality, suitability, availability, or
              accuracy of any listing, service, or user, and we expressly
              disclaim any responsibility for the acts, omissions, or conduct
              of any third party. We reserve the right to modify, suspend,
              restrict, or discontinue any feature of the Platform, in whole
              or in part, at any time and without liability or notice.
            </p>
          </section>

          <section className="mb-8">
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

          <section className="mb-8">
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
              <li>Maintain facilities in safe, good, and legally compliant condition at all times</li>
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
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
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
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Booking and Payments
            </h2>

            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              Booking Process
            </h3>
            <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-6">
              <li>All bookings are subject to availability and are not guaranteed until confirmed</li>
              <li>Bookings are confirmed only after successful payment capture</li>
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
              <li>All prices are displayed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise</li>
              <li>Full payment must be completed at the time of booking; no booking is held without payment</li>
              <li>
                We accept major credit/debit cards, UPI, and digital wallets
                through our authorized payment partners; we are not liable for
                any failure, delay, or error caused by such third-party
                payment providers
              </li>
              <li>Service charges and platform fees are disclosed before payment and are strictly non-negotiable</li>
              <li>
                Venue listers and coaches receive payouts only after booking
                completion and only in accordance with our then-current
                payout schedule, which we may change at our sole discretion
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
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Commission and Fees
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              PowerMySport reserves the right to charge venue listers and
              coaches a commission on successful bookings:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                Where a commission is charged, the applicable rate will be
                disclosed to the affected venue lister or coach in advance
                through the Platform, and may be introduced, revised, or
                removed by us at any time upon notice
              </li>
              <li>
                Academies and coaches may separately offer paid subscription
                or session-package plans directly to players; these are
                distinct products governed by their own listed terms and are
                unrelated to any commission charged on venue or coaching
                bookings
              </li>
              <li>Payment processing fees levied by third-party gateways are non-refundable and may be passed on to you</li>
              <li>
                We reserve the right to withhold, offset, or recover any
                amount owed to us (including commissions, penalties, or
                chargeback costs) from current or future payouts due to a
                venue lister or coach
              </li>
              <li>Commission structure and fee schedules may be updated at our sole discretion with notice via the Platform</li>
            </ul>
          </section>

          <section className="mb-8">
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

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Prohibited Activities
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              You agree not to, and shall not permit any third party to:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>Use the Platform for any illegal, fraudulent, or unauthorized purpose</li>
              <li>Harass, threaten, abuse, defame, or harm any other user</li>
              <li>Submit false, misleading, or manipulated information, reviews, or ratings</li>
              <li>Attempt to bypass, disable, or circumvent any security, verification, or payment feature</li>
              <li>Scrape, harvest, crawl, or extract data from the Platform by automated means</li>
              <li>Introduce viruses, malware, or any harmful code, or interfere with the proper functioning of the Platform</li>
              <li>Impersonate any person or entity, or misrepresent your affiliation with any person or entity</li>
              <li>
                Solicit, arrange, or complete any booking or payment outside
                the Platform to avoid commission or fees (&quot;circumvention&quot;),
                which constitutes a material breach entitling us to
                immediately terminate your account and pursue recovery of
                unpaid commission
              </li>
              <li>Post content that is obscene, defamatory, discriminatory, or infringes any third party&apos;s rights</li>
              <li>Use the Platform to collect or store personal data of other users except as strictly necessary to complete a booking</li>
              <li>Engage in money laundering, tax evasion, or any activity in violation of applicable financial regulations</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              Violation of this section entitles us to immediately suspend or
              terminate your account, withhold pending payouts, and pursue any
              legal remedy available, without prior notice.
            </p>
          </section>

          <section className="mb-8">
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
              <li>The Platform will be uninterrupted, timely, secure, or error-free</li>
              <li>Any defects or errors will be corrected</li>
              <li>The Platform is free of viruses or other harmful components</li>
              <li>Any listing, review, rating, or information provided by any user or third party is accurate, complete, or reliable</li>
              <li>Any booking will be honored, or that any venue, coach, or academy will meet your expectations</li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-4">
              You use the Platform, and engage with any venue, coach, or other
              user, entirely at your own risk.
            </p>
          </section>

          <section className="mb-8">
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
              MISCONDUCT OF ANY VENUE LISTER, COACH, ACADEMY, OR OTHER USER,
              INCLUDING ANY PERSONAL INJURY, PROPERTY DAMAGE, OR FINANCIAL LOSS
              ARISING FROM A BOOKING OR IN-PERSON INTERACTION FACILITATED
              THROUGH THE PLATFORM.
            </p>
            <p className="text-slate-600 leading-relaxed">
              IN ANY EVENT, OUR AGGREGATE LIABILITY ARISING OUT OF OR RELATING
              TO THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE
              LESSER OF (A) THE AMOUNT YOU ACTUALLY PAID TO US IN THE THREE
              (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE
              CLAIM, OR (B) TEN THOUSAND RUPEES (₹10,000).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Indemnification
            </h2>
            <p className="text-slate-600 leading-relaxed">
              You agree to indemnify, defend, and hold harmless PowerMySport,
              its officers, directors, employees, and agents from and against
              any and all claims, demands, losses, liabilities, damages,
              costs, and expenses (including reasonable legal fees) arising
              out of or in any way connected with: (a) your use or misuse of
              the Platform; (b) your violation of these Terms or any
              applicable law; (c) your infringement of any right of a third
              party, including intellectual property or privacy rights; (d)
              any content, listing, or information you submit; or (e) any
              dispute, injury, or damage arising between you and another user.
              This obligation survives termination of your account or these
              Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Dispute Resolution and Arbitration
            </h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              In the event of any dispute, controversy, or claim arising out
              of or relating to these Terms or the use of the Platform:
            </p>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>You must first raise the issue with our support team in writing and allow thirty (30) days for resolution before pursuing any other remedy</li>
              <li>
                If unresolved, the dispute shall be referred to and finally
                resolved by binding arbitration conducted by a sole arbitrator
                appointed by PowerMySport, in accordance with the Arbitration
                and Conciliation Act, 1996 (as amended)
              </li>
              <li>The seat and venue of arbitration shall be Mullanpur, Punjab, India, and the proceedings shall be conducted in English</li>
              <li>Each party shall bear its own costs of arbitration unless the arbitrator directs otherwise</li>
              <li>The arbitration award shall be final and binding on both parties</li>
              <li>
                To the extent permitted by law, you agree not to bring or
                participate in any class, collective, or representative
                action against PowerMySport; this does not affect any
                non-waivable right you have to file a complaint jointly with
                other consumers under Section 35 of the Consumer Protection
                Act, 2019
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

          <section className="mb-8">
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

          <section className="mb-8">
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
              <li>Extended inactivity</li>
              <li>Any other reason, at our sole and absolute discretion</li>
            </ul>
            <p className="text-slate-600 leading-relaxed">
              Upon termination, your right to access the Platform ceases
              immediately, any pending payouts may be withheld pending
              investigation, and no fees already paid will be refunded except
              as strictly required by our Cancellation, Refund &amp; Dispute
              Policy. You may request deletion of your account at any time,
              subject to our right to retain information as required for
              legal, accounting, fraud-prevention, or dispute-resolution
              purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Relationship of Parties
            </h2>
            <p className="text-slate-600 leading-relaxed">
              Nothing in these Terms creates an employment, partnership,
              joint-venture, franchise, or agency relationship between
              PowerMySport and any user. Venue listers, coaches, and academies
              act solely as independent contractors and are exclusively
              responsible for their own tax, statutory, licensing, and legal
              obligations arising from their use of the Platform.
            </p>
          </section>

          <section className="mb-8">
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

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              General Provisions
            </h2>
            <ul className="list-disc pl-6 text-slate-600 space-y-2">
              <li>
                <strong>Severability:</strong> If any provision of these
                Terms is held invalid or unenforceable, the remaining
                provisions shall continue in full force and effect
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
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              Governing Law
            </h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by and construed in accordance
              with the laws of India, without regard to its conflict of law
              provisions. Subject to the arbitration clause above, the courts
              located in Mullanpur, Punjab, India shall have exclusive
              jurisdiction over any matter not subject to arbitration. The
              Platform additionally operates subject to the Consumer
              Protection Act, 2019, the Consumer Protection (E-Commerce)
              Rules, 2020, the Information Technology Act, 2000 and rules
              made thereunder, and the Digital Personal Data Protection Act,
              2023, each as in force and applicable from time to time.
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
                <strong>Email:</strong> teams@powermysport.com
              </p>
              <p className="text-slate-700">
                <strong>Phone:</strong> +91 89685 82443
              </p>
              <p className="text-slate-700">
                <strong>Address:</strong> Mullanpur, Punjab.
              </p>
            </div>
          </section>
        </Card>
      </div>
    </div>
  );
}
