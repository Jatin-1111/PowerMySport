"use client";

import { useEffect } from "react";

export default function ContentPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-16 md:py-24">
        <article className="prose prose-lg max-w-none">
          <h1 className="text-4xl font-bold mb-4">
            User Generated Content & Moderation Policy
          </h1>

          <p className="text-gray-600 text-sm mb-8">
            <strong>Last Updated:</strong> February 18, 2026 |{" "}
            <strong>Effective Date:</strong> February 18, 2026
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">1. Overview</h2>
            <p>
              PowerMySport provides a platform where users can share reviews,
              ratings, photos, videos, and messages. This policy outlines what
              content is acceptable, prohibited, and how we moderate
              user-generated content (UGC) to maintain a safe, respectful
              community.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Types of User-Generated Content
            </h2>
            <p>
              Users can submit the following types of content on PowerMySport:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Reviews & Ratings:</strong> Star ratings and written
                reviews of coaches, venues, and services
              </li>
              <li>
                <strong>Photos & Videos:</strong> Images of facilities,
                activities, achievements, and experiences
              </li>
              <li>
                <strong>Messages:</strong> Private messages to coaches, venue
                owners, and other users
              </li>
              <li>
                <strong>Comments:</strong> Responses to reviews, Q&A sections,
                and community discussions
              </li>
              <li>
                <strong>Testimonials:</strong> Success stories and feedback
                about services
              </li>
              <li>
                <strong>Profile Information:</strong> Bio, achievements,
                certifications, and personal details
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Acceptable Content Guidelines
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.1 Quality & Truthfulness
            </h3>
            <p>Acceptable content:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Is factual and based on genuine personal experience</li>
              <li>Contains relevant feedback about the service or facility</li>
              <li>Is written clearly and respectfully, even if negative</li>
              <li>Includes specific examples or descriptions (not generic)</li>
              <li>Does not contain false, misleading, or exaggerated claims</li>
              <li>Is not submitted by competitors or motivated by malice</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.2 Professional & Courteous Tone
            </h3>
            <p>Acceptable content:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Criticizes services, not individuals</li>
              <li>Avoids personal attacks or character assassination</li>
              <li>Uses appropriate language and grammar</li>
              <li>Respects the privacy and dignity of others</li>
              <li>Constructive even when expressing dissatisfaction</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              3.3 Legal Compliance
            </h3>
            <p>Acceptable content:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Does not violate intellectual property rights</li>
              <li>Does not include copyrighted material without permission</li>
              <li>Does not disclose confidential information</li>
              <li>Does not contain illegal content</li>
              <li>Does not encourage illegal activity</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Prohibited Content
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.1 Abusive & Harassing Content
            </h3>
            <p>The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Harassment, bullying, or intimidation of any individual</li>
              <li>Threats of violence or bodily harm</li>
              <li>
                Hate speech or content promoting discrimination based on race,
                ethnicity, religion, gender, sexual orientation, disability, or
                other protected characteristics
              </li>
              <li>
                Doxxing (sharing private personal information to enable
                harassment)
              </li>
              <li>Cyberstalking or persistent unwanted contact</li>
              <li>Sexual harassment or unwanted sexual content</li>
              <li>Revenge content (sharing intimate images without consent)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.2 Illegal & Dangerous Content
            </h3>
            <p>The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Content promoting, encouraging, or instructing illegal
                activities
              </li>
              <li>Scams, fraud, or deceptive practices</li>
              <li>
                Sale or promotion of illegal drugs or controlled substances
              </li>
              <li>Promotion of weapons, explosives, or dangerous items</li>
              <li>Child sexual abuse material (CSAM) or child exploitation</li>
              <li>Promotion of suicide, self-harm, or eating disorders</li>
              <li>Instructions for creating weapons or explosives</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.3 Misleading & Fraudulent Content
            </h3>
            <p>The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Fake reviews (submitted by friends, competitors, or paid
                reviewers)
              </li>
              <li>
                Astroturfing (coordinated false reviews to manipulate ratings)
              </li>
              <li>Misleading health claims (e.g., "will cure diabetes")</li>
              <li>Investment scams or financial fraud</li>
              <li>Phishing attempts or malware links</li>
              <li>
                Impersonation of another user, coach, venue, or PowerMySport
                staff
              </li>
              <li>Sharing false credentials or certifications</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.4 Inappropriate Media Content
            </h3>
            <p>The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Explicit sexual content or pornography</li>
              <li>Graphic violence or gore</li>
              <li>Nudity (except in legitimate athletic/medical contexts)</li>
              <li>Content sexualizing minors in any way</li>
              <li>Images without consent of all individuals pictured</li>
              <li>
                Copyright-infringing media (unauthorized use of songs, movies,
                photos)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.5 Spam & Commercial Abuse
            </h3>
            <p>The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Spam (repetitive, irrelevant posts)</li>
              <li>Commercial advertising or unsolicited promotions</li>
              <li>Spamming links to external websites or referral links</li>
              <li>Multi-level marketing (MLM) recruitment or pitches</li>
              <li>
                Excessive self-promotion outside of legitimate business context
              </li>
              <li>Collection of contact information for commercial purposes</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              4.6 Privacy Violations
            </h3>
            <p>The following content is strictly prohibited:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Sharing others' personal information (phone numbers, addresses,
                emails) without consent
              </li>
              <li>Sharing photos of people without consent</li>
              <li>
                Publishing private messages or conversations without consent
              </li>
              <li>Revealing minors' information or images</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Review & Rating Specific Rules
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.1 Eligibility to Leave Reviews
            </h3>
            <p>To leave a legitimate review, you must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Have completed a verified booking with the coach or venue</li>
              <li>Be writing from personal, direct experience</li>
              <li>Not be the business owner or employee</li>
              <li>Not be a direct competitor</li>
              <li>
                Not have financial interest in the business (investor,
                shareholder)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.2 Prohibited Reviews
            </h3>
            <p>We remove reviews that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Are unrelated to the service booked</li>
              <li>
                Contain off-topic complaints (e.g., about app, not the service)
              </li>
              <li>
                Are primarily complaints about price without explaining specific
                value concerns
              </li>
              <li>Appear to be submitted by a friend or competitor</li>
              <li>Contain legal threats or demands</li>
              <li>Request removal in exchange for money or positive reviews</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              5.3 Response Policy
            </h3>
            <p>Coaches and venues can respond to reviews to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Provide their perspective on the feedback</li>
              <li>Offer solutions (e.g., refund, make-good booking)</li>
              <li>Thank reviewers for feedback</li>
            </ul>
            <p className="mt-3">
              Responses that are abusive, threatening, or violate these policies
              will be removed.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Photo & Video Guidelines
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.1 Ownership & Consent Requirements
            </h3>
            <p>When uploading photos or videos, you must:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Be the original creator or have permission from the copyright
                holder
              </li>
              <li>
                Have consent from all individuals visible in the photo/video
              </li>
              <li>Have parental consent for any minors in the photo/video</li>
              <li>
                Not include identifying information of minors in captions or
                descriptions
              </li>
              <li>Confirm you own all rights to the content</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.2 Appropriate Content
            </h3>
            <p>Photos and videos should:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Relate to the activity or venue</li>
              <li>Show participants in appropriate athletic wear or attire</li>
              <li>Not contain nudity, sexual content, or graphic violence</li>
              <li>Not contain copyrighted music or other protected content</li>
              <li>Be original or properly attributed if sourced</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              6.3 Prohibited Images
            </h3>
            <p>We remove images that:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Show nudity, sexual content, or violence</li>
              <li>Feature minors in any potentially exploitative way</li>
              <li>Contain hate symbols or offensive content</li>
              <li>Are not actually related to the activity</li>
              <li>Violate others' privacy or are shared without consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Private Messages & Communication
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.1 Acceptable Messaging
            </h3>
            <p>Messages should be:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Related to bookings, services, or legitimate inquiries</li>
              <li>Respectful and professional in tone</li>
              <li>Focused on resolving issues or coordinating activities</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.2 Prohibited Messaging
            </h3>
            <p>Messages cannot contain:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Harassment, threats, or abusive language</li>
              <li>Sexual content or unwanted sexual advances</li>
              <li>
                Requests for personal contact information outside the platform
              </li>
              <li>Phishing attempts or malware links</li>
              <li>Spam or commercial solicitation</li>
              <li>
                Attempts to move conversations off-platform to avoid detection
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              7.3 Message Monitoring
            </h3>
            <p>PowerMySport may:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Monitor messages for safety, fraud, and policy violations</li>
              <li>
                Automatically flag concerning messages using AI/automated tools
              </li>
              <li>Review messages if a user files a complaint</li>
              <li>
                Share relevant information with law enforcement if illegal
                activity is detected
              </li>
              <li>Preserve message records for dispute resolution</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Content Moderation Process
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.1 How Content is Reviewed
            </h3>
            <p>We review content through:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Automated Detection:</strong> AI filters scan for
                prohibited content (hate speech, explicit images, etc.)
              </li>
              <li>
                <strong>User Reports:</strong> Community members can report
                content that violates this policy
              </li>
              <li>
                <strong>Manual Review:</strong> Our moderation team reviews
                flagged content for context and accuracy
              </li>
              <li>
                <strong>Legal Requests:</strong> Law enforcement or court orders
                may trigger content review
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.2 Reporting Content
            </h3>
            <p>To report prohibited content:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Click the "Report" or "Flag" button on the content</li>
              <li>Select the violation category (abuse, fraud, spam, etc.)</li>
              <li>
                Provide specific details explaining why it violates this policy
              </li>
              <li>Attach supporting evidence if applicable</li>
              <li>Submit the report</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.3 Review Timeline
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Severe violations (threats, CSAM, fraud):</strong>{" "}
                Reviewed within 24 hours, content removed immediately
              </li>
              <li>
                <strong>
                  High priority violations (harassment, hate speech):
                </strong>{" "}
                Reviewed within 48 hours
              </li>
              <li>
                <strong>
                  Standard violations (spam, inappropriate content):
                </strong>{" "}
                Reviewed within 5-7 business days
              </li>
              <li>
                <strong>
                  Low priority violations (quality or tone issues):
                </strong>{" "}
                Reviewed within 10 business days
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              8.4 Moderation Decisions
            </h3>
            <p>After review, we may:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>Keep Content:</strong> No violation found; content
                remains visible
              </li>
              <li>
                <strong>Remove Content:</strong> Content is deleted for
                violating this policy
              </li>
              <li>
                <strong>Restrict Visibility:</strong> Content is hidden from
                general view but visible to the author
              </li>
              <li>
                <strong>Add Warning Label:</strong> Content remains but is
                labeled as potentially sensitive or disputed
              </li>
              <li>
                <strong>Request Edit:</strong> Author is asked to modify content
                without removing
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Appeals & Disputes
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.1 Appealing a Decision
            </h3>
            <p>
              If you believe your content was removed or restricted in error:
            </p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Log in to your PowerMySport account</li>
              <li>Navigate to the removed/restricted content</li>
              <li>Click "Appeal Moderation Decision"</li>
              <li>Explain why you believe the decision was wrong</li>
              <li>Provide additional context or evidence</li>
              <li>Submit the appeal</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.2 Appeal Timeline
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Appeals are reviewed within 5-10 business days</li>
              <li>A different moderator reviews the appeal for objectivity</li>
              <li>You will receive a decision and explanation via email</li>
              <li>
                If still unsatisfied, you can escalate to management (final
                decision)
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              9.3 Disagreements About Reviews
            </h3>
            <p>If you disagree with a review posted about you:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>You can respond publicly with your perspective</li>
              <li>
                You can flag the review if it violates this policy (false
                claims, harassment, etc.)
              </li>
              <li>You can contact our support team for disputed reviews</li>
              <li>
                We will not remove reviews simply because you disagree with the
                rating or opinion
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Account Consequences
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">10.1 Warning</h3>
            <p>
              For minor or first-time violations, you may receive a warning. The
              warning explains the policy violated and requests compliance going
              forward.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.2 Content Restrictions
            </h3>
            <p>
              For repeated minor violations or serious violations, you may be:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Temporarily prevented from posting new content (24 hours - 30
                days)
              </li>
              <li>Required to review policy before posting</li>
              <li>Prevented from uploading photos/videos for a period</li>
              <li>Prevented from leaving reviews</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.3 Account Suspension
            </h3>
            <p>
              For severe, repeated, or illegal violations, your account may be
              suspended for 30-90 days. During suspension:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>You cannot log in or access your account</li>
              <li>Your bookings and reviews remain visible</li>
              <li>You cannot make new bookings</li>
              <li>We may allow viewing past bookings after suspension ends</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.4 Permanent Account Termination
            </h3>
            <p>Your account will be permanently terminated if:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>You engage in illegal activity through the platform</li>
              <li>You distribute child exploitation material</li>
              <li>You repeatedly harass or threaten users</li>
              <li>You commit fraud or scams</li>
              <li>You violate policies after multiple suspensions</li>
              <li>You engage in coordinated fake reviews or manipulation</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              10.5 Law Enforcement
            </h3>
            <p>For illegal content or activity, we will:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Preserve evidence and maintain records</li>
              <li>Report to law enforcement if required by law</li>
              <li>Cooperate with legal investigations</li>
              <li>Provide user information when legally required</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              11. Intellectual Property Rights
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              11.1 Your Rights Over Your Content
            </h3>
            <p>By submitting content to PowerMySport, you:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Retain ownership of your content</li>
              <li>
                Grant PowerMySport a license to use, distribute, and display
                your content on the platform
              </li>
              <li>
                Grant PowerMySport permission to use your content for marketing
                (reviews, testimonials, screenshots)
              </li>
              <li>
                Confirm you own or have permission for all rights to the content
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              11.2 Copyright Infringement
            </h3>
            <p>If you believe your copyright has been infringed:</p>
            <ol className="list-decimal pl-6 space-y-2 mt-3">
              <li>Click "Report" on the infringing content</li>
              <li>Select "Copyright Infringement"</li>
              <li>
                Provide your name, description of the original work, and proof
                of ownership
              </li>
              <li>Submit the complaint</li>
            </ol>
            <p className="mt-3">
              We will investigate and remove content that infringes valid
              copyrights.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              11.3 Trademark & Brand Rights
            </h3>
            <p>Users must not:</p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                Impersonate PowerMySport or use our branding without permission
              </li>
              <li>
                Use another person's or company's trademark or brand without
                permission
              </li>
              <li>Imply endorsement by PowerMySport without authorization</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              12. Contact & Support
            </h2>
            <p>For moderation inquiries, appeals, or to report content:</p>
            <div className="bg-gray-100 p-6 rounded-lg mt-4">
              <p>
                <strong>PowerMySport Content Moderation Team</strong>
              </p>
              <p>
                Email:{" "}
                <a
                  href="mailto:moderation@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  moderation@powermysport.com
                </a>
              </p>
              <p>
                Email (Urgent/Safety):{" "}
                <a
                  href="mailto:safety@powermysport.com"
                  className="text-blue-600 hover:underline"
                >
                  safety@powermysport.com
                </a>
              </p>
              <p>Response Time: 24-48 hours</p>
            </div>
          </section>

          <section className="mt-12 pt-8 border-t border-gray-300">
            <p className="text-sm text-gray-600">
              This Content Policy may be updated at any time. Continued use of
              PowerMySport means you accept the current policy. Major changes
              will be communicated 30 days in advance.
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
