"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { ChevronDown, HelpCircle, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const faqs = [
  {
    category: "General & Getting Started",
    questions: [
      {
        question: "What is PowerMySport?",
        answer:
          "PowerMySport is a hyperlocal sports venue and coach booking platform that connects players with premium sports facilities and professional coaches. We make it easy to discover, book, and pay for sports activities in your area.",
      },
      {
        question: "How do I create an account?",
        answer:
          'Click on the "Sign Up" button in the top right corner and choose your account type (Player, Venue Lister, or Coach). Fill in your details and verify your email to get started.',
      },
      {
        question: "Is PowerMySport free to use?",
        answer:
          "Creating an account and browsing venues/coaches is completely free. You only pay when you book a session or service. Venue listers and coaches pay a small commission on successful bookings.",
      },
    ],
  },
  {
    category: "Booking & Payments",
    questions: [
      {
        question: "How do I book a venue or coach?",
        answer:
          "Browse available venues or coaches, select your preferred date and time slot, choose your sport, and confirm your booking. You'll be directed to payment, and once completed, you'll receive a confirmation with all details.",
      },
      {
        question: "What payment methods are accepted?",
        answer:
          "We accept all major credit/debit cards, UPI, net banking, and digital wallets. All payments are processed securely through our payment gateway.",
      },
      {
        question: "Can I cancel or reschedule my booking?",
        answer:
          "Yes, you can cancel bookings according to the cancellation policy (usually 24-48 hours before the session). To cancel, go to 'My Bookings' in your dashboard and select the booking you wish to cancel. Refunds are processed within 5-7 business days.",
      },
      {
        question: "Do I need to pay separately for venue and coach?",
        answer:
          "If you book a venue with a coach, the system automatically calculates split payments. You'll see the breakdown before confirming, and payments are distributed automatically to the venue owner and coach.",
      },
    ],
  },
  {
    category: "For Players",
    questions: [
      {
        question: "Can I book for multiple people?",
        answer:
          "Yes! You can add dependents (like children) to your account and book sessions for them. This is especially useful for parents booking for their kids.",
      },
      {
        question: "How do I find venues near me?",
        answer:
          "Use the search feature on the venues page to search by sport. The platform shows venues based on their location and availability. You can filter by sport, price, and amenities.",
      },
      {
        question: "What if I arrive and the venue is closed?",
        answer:
          "Contact our support team immediately. We'll help resolve the issue and ensure you get a refund or alternative booking. Venue listers are held accountable for no-shows.",
      },
    ],
  },
  {
    category: "For Venue Listers",
    questions: [
      {
        question: "How do I list my venue?",
        answer:
          "Sign up as a Venue Lister, complete the 4-step onboarding process including venue details, location, pricing, and documentation. Once approved by our admin team, your venue will be live on the platform.",
      },
      {
        question: "What documents do I need to provide?",
        answer:
          "You'll need ownership proof, business registration, tax documents, insurance, and any relevant sports facility certifications. All documents are reviewed for authenticity.",
      },
      {
        question: "How do I receive payments?",
        answer:
          "Payments are automatically deposited to your registered bank account after each booking is completed. You can track all earnings in your vendor dashboard.",
      },
      {
        question: "Can I set different prices for different sports?",
        answer:
          "Yes! You can set sport-specific pricing. For example, a cricket pitch might be priced differently than a badminton court.",
      },
    ],
  },
  {
    category: "For Coaches",
    questions: [
      {
        question: "How do I become a coach on the platform?",
        answer:
          "Sign up as a Coach, provide your certifications, sports expertise, and choose your service mode (own venue, freelance, or hybrid). You can start receiving bookings once your profile is complete.",
      },
      {
        question: "What are the different service modes?",
        answer:
          "OWN_VENUE: You have your own training facility. FREELANCE: You travel to different venues. HYBRID: You offer both options. Choose based on how you prefer to operate.",
      },
      {
        question: "How do I set my availability?",
        answer:
          "You can manage your schedule in the coach dashboard. Block out times when you're unavailable, and the system will only show your available slots to players.",
      },
      {
        question: "Do coaches need insurance?",
        answer:
          "Yes. All coaches must maintain active Professional Liability Insurance (₹25-50 lakh) to operate on PowerMySport. This protects you and your players. We verify insurance at onboarding and throughout the year. Coaches without valid insurance cannot accept bookings.",
      },
    ],
  },
  {
    category: "Payment & Refunds",
    questions: [
      {
        question: "What is your cancellation and refund policy?",
        answer:
          "We offer a tiered refund system based on cancellation timing:\n• More than 48 hours before: 100% refund\n• 24-48 hours before: 50% refund\n• Less than 24 hours before: No refund\nFor complex cases or emergencies, contact support@powermysport.com with documentation.",
      },
      {
        question: "What if I need to cancel due to an emergency?",
        answer:
          "We understand emergencies happen. Please contact our support team immediately at support@powermysport.com with proof of the emergency (medical certificate, etc.). We will review your case and may approve an emergency refund exception on a case-by-case basis.",
      },
      {
        question: "How do I request a refund?",
        answer:
          "Log into your PowerMySport account, go to My Bookings, select the booking you want to cancel, and click 'Request Cancellation.' The refund will be processed according to our refund windows and returned to your original payment method within 5-7 business days.",
      },
      {
        question: "What if the coach or venue cancels on me?",
        answer:
          "If the coach, venue, or PowerMySport cancels, you're entitled to a 100% refund. Additionally, you can open a dispute ticket in your account or file a complaint at support@powermysport.com.",
      },
    ],
  },
  {
    category: "Payment Disputes & Resolution",
    questions: [
      {
        question: "How do I file a dispute?",
        answer:
          "You can file a dispute through your PowerMySport account: go to My Bookings, select the booking, and click 'File Dispute.' You'll receive a unique Dispute Ticket ID (format: DISP-YYYY-XXXXXX) to track your case. You can also email disputes@powermysport.com with booking details.",
      },
      {
        question: "How long does dispute resolution take?",
        answer:
          "Our dispute resolution timeline:\n• 24 hours: We acknowledge receipt and assign to an investigator\n• 3-5 business days: Initial investigation and information gathering\n• 7-10 business days: Final decision and resolution\nComplex cases with external verification may take additional time.",
      },
      {
        question: "What types of disputes can I file?",
        answer:
          "You can file disputes for: (1) Payment issues - unauthorized charges, duplicate transactions, billing errors; (2) Service issues - coach didn't show, quality below expectations; (3) Refund issues - refund not processed or delayed; (4) Booking issues - booking not fulfilled as promised; (5) Other issues - safety concerns, discrimination, etc.",
      },
      {
        question: "Can I appeal a dispute decision?",
        answer:
          "Yes. If you disagree with our decision, you can appeal within 5 days of receiving the resolution notice. Your appeal must include new evidence that wasn't available during the initial investigation. We will conduct a fresh review with a different investigator.",
      },
    ],
  },
  {
    category: "Health & Safety",
    questions: [
      {
        question: "What is the Health & Safety Waiver?",
        answer:
          "The waiver is a legal document where you acknowledge the risks of sports activities (sprains, fractures, head trauma, etc.) and accept responsibility for your health and safety. By accepting, you release PowerMySport, coaches, and venues from liability for injuries during normal activity.",
      },
      {
        question: "When do I need to accept the waiver?",
        answer:
          "You must accept the waiver:\n• During your first booking as a player\n• On behalf of any dependent minor at their first booking\n• When renewing an expired waiver (see below)\nYou cannot book without a current waiver.",
      },
      {
        question: "How long is my waiver valid?",
        answer:
          "Waivers are valid for 12 months from the acceptance date. We'll send you an email reminder 30 days before expiry. You must renew your waiver online before it expires to continue booking. Renewing takes 1 minute - simply re-accept the updated waiver.",
      },
      {
        question: "What if my waiver expires?",
        answer:
          "If your waiver expires, you cannot book new sessions until you renew it. Go to your account settings, find the expired waiver, and click 'Renew Waiver.' You'll see the current waiver version and can accept to renew immediately.",
      },
    ],
  },
  {
    category: "Parental Consent & Minors",
    questions: [
      {
        question: "Can my child book on PowerMySport?",
        answer:
          "Children under 18 cannot create their own accounts. A parent or legal guardian (18+) must create a parent account and then add the child as a dependent. The parent is fully responsible for all bookings and assumes all liability.",
      },
      {
        question: "How do I add a minor as a dependent?",
        answer:
          "After creating your parent account and verifying your identity, go to Family & Dependents section. Click 'Add Dependent' and provide: the child's full name, date of birth, relationship, and medical/emergency contact information. You can add unlimited dependents.",
      },
      {
        question: "What's the parental consent process?",
        answer:
          "When booking sports activities for your child, you must:\n• Accept our Parental Consent agreement\n• Accept the Health & Safety Waiver on behalf of your child\n• Declare any medical conditions or health concerns\n• Authorize us to contact you in emergencies\nYou cannot book without completing all consent requirements.",
      },
      {
        question: "What are the supervision requirements for minors?",
        answer:
          "Supervision requirements by age:\n• Under 8 years: Parent/guardian MUST be present on-site\n• 8-12 years: Parent/guardian must be on-call and reachable within 15 minutes\n• 13-17 years: Parent/guardian on-call, but direct on-site presence not required\nVenues and coaches must enforce these requirements.",
      },
    ],
  },
  {
    category: "Content Policy & Community",
    questions: [
      {
        question: "Can I post reviews and photos on PowerMySport?",
        answer:
          "Yes! You can post reviews after completing a booking with a coach or venue. You can also share photos from your sessions. However, all content must follow our Content Policy - no abusive, misleading, or inappropriate content.",
      },
      {
        question: "What content is not allowed?",
        answer:
          "Prohibited content includes: abusive or threatening language, false/misleading information, inappropriate images/videos, spam or promoting external services, privacy violations (doxxing), fake reviews or paid reviews, illegal content, and content violating others' intellectual property rights.",
      },
      {
        question: "Why was my review removed?",
        answer:
          "Your review was likely removed for violating our Content Policy. Common reasons: contains abusive language, includes false claims, includes inappropriate media, or appears to be a paid/fake review. You'll receive an email with the specific reason. You can appeal the decision via the link in that email.",
      },
      {
        question: "How long does content moderation take?",
        answer:
          "Our moderation timeline:\n• Severe violations (abuse, illegal content): Removed within 24 hours\n• High priority (misleading, spam): Removed within 48 hours\n• Standard violations: Removed within 5-7 business days\nWe manually review all appeals - this may take additional time.",
      },
    ],
  },
  {
    category: "Insurance & Venue Requirements",
    questions: [
      {
        question: "Do coaches and venues need insurance?",
        answer:
          "Yes. All coaches and venue owners on PowerMySport must maintain active insurance coverage. This protects you if an incident occurs. We verify insurance at onboarding and throughout the year.",
      },
      {
        question: "What are the minimum insurance requirements?",
        answer:
          "Coaches must have: Professional Liability Insurance (₹25-50 lakh). Venues must have: General Liability (₹50-100 lakh), Property Insurance (₹10-25 lakh), and Employer's Liability (₹10-25 lakh if they have staff). See our Insurance Requirements page for details and recommended providers.",
      },
      {
        question: "What happens if a coach or venue doesn't have insurance?",
        answer:
          "Coaches and venues without valid insurance cannot operate on PowerMySport. They have 7 days to provide proof of insurance. If they don't, they're suspended for 14 days. If still not resolved, their account is terminated.",
      },
      {
        question: "How do I verify a coach's or venue's insurance?",
        answer:
          "You can see insurance status on every coach/venue profile under 'Certifications.' It shows: Insurance Provider, Policy Number (hidden for privacy), Expiry Date, Verification Status. If you see 'Expired' or 'Unverified,' we recommend contacting support before booking.",
      },
    ],
  },
  {
    category: "Privacy & Cookies",
    questions: [
      {
        question: "Does PowerMySport use cookies?",
        answer:
          "Yes. We use cookies to remember your login, improve the website, and show you relevant ads. When you first visit, you'll see a cookie consent banner. You can manage your preferences or visit our Cookie Policy anytime.",
      },
      {
        question: "What can I do if I don't want cookies?",
        answer:
          "You can: (1) Decline non-essential cookies in our cookie banner; (2) Disable cookies in your browser settings; (3) Use our opt-out links in the Cookie Policy for specific services like Google Analytics or Mixpanel; (4) Use your browser's 'Do Not Track' feature. Note: Some cookies are required for the site to function.",
      },
      {
        question: "How is my personal data used?",
        answer:
          "Your data is used to: provide our service, process payments, improve your experience, detect fraud, and comply with legal requirements. We never sell your personal data. For full details, see our Privacy Policy.",
      },
      {
        question: "Can I delete my account and data?",
        answer:
          "Yes. Go to Account Settings, select 'Privacy & Data,' and click 'Request Account Deletion.' We'll delete your personal data within 30 days, except for transaction records (required by law) and dispute/legal records. Some data may be anonymized instead of deleted.",
      },
    ],
  },
  {
    category: "Accessibility",
    questions: [
      {
        question: "Is PowerMySport accessible to people with disabilities?",
        answer:
          "Yes. We're committed to WCAG 2.1 Level AA compliance, meaning our site is usable by people with visual, hearing, motor, and cognitive disabilities. We support screen readers (NVDA, JAWS, VoiceOver, TalkBack), keyboard navigation, and have high color contrast.",
      },
      {
        question: "What accessibility features does PowerMySport have?",
        answer:
          "Features include: keyboard navigation (Tab through all elements), skip-to-content links, semantic HTML, alt text for images, 4.5:1 color contrast for text, screen reader support, resizable text, focus indicators, and mobile accessibility (large touch targets).",
      },
      {
        question: "How do I use PowerMySport with a screen reader?",
        answer:
          "Our website is optimized for NVDA (Windows), JAWS (Windows), VoiceOver (Mac/iOS), and TalkBack (Android). All buttons, links, and form labels are properly labeled. If you encounter an issue, email accessibility@powermysport.com with your device/screen reader version and we'll help.",
      },
      {
        question: "What if I find an accessibility issue?",
        answer:
          "Please report it to accessibility@powermysport.com with: the issue description, what you were trying to do, your device/browser/assistive tech, and screenshots if possible. We aim to respond within 24-48 hours and fix issues quickly.",
      },
    ],
  },
  {
    category: "Technical & Account",
    questions: [
      {
        question: "Why can't I log in to my account?",
        answer:
          "Try: (1) Reset your password via the login page; (2) Clear your browser cache; (3) Try a different browser; (4) Check that JavaScript is enabled. If still not working, email support@powermysport.com with your email address.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept: credit/debit cards (Visa, Mastercard, American Express), UPI, net banking, and digital wallets. All payments are encrypted and secure. You can save payment methods for faster checkout.",
      },
      {
        question: "Why was my transaction declined?",
        answer:
          "Common reasons: insufficient funds, incorrect CVV, card expired, incorrect address, or fraud detection (try again later). Contact your bank if multiple attempts fail. You can also try a different payment method.",
      },
      {
        question: "How do I change my email or phone number?",
        answer:
          "Go to Account Settings, select 'Contact Information,' and update your email or phone. We'll send a verification code to confirm the change. You'll need to log in again after changing your email.",
      },
    ],
  },
  {
    category: "General Support",
    questions: [
      {
        question: "Is PowerMySport available outside India?",
        answer:
          "Currently, PowerMySport operates only in India. We're expanding to other countries in the future. If you're outside India, you currently cannot create an account.",
      },
      {
        question: "How do I contact PowerMySport?",
        answer:
          "You can reach us via:\n• Email: support@powermysport.com (general queries)\n• Legal issues: legal@powermysport.com\n• Safety concerns: safeguarding@powermysport.com\n• Accessibility: accessibility@powermysport.com\n• Contact form: powermysport.com/contact\n• In-app help center available to logged-in users",
      },
    ],
  },
];

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg sm:p-8">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <HelpCircle size={32} className="text-power-orange" />
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                  Support
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                Frequently Asked Questions
              </h1>
              <p className="text-slate-200 text-base sm:text-lg max-w-2xl">
                Find answers to common questions about PowerMySport. Can't find
                what you're looking for? Contact our support team.
              </p>
            </div>
            <div className="pointer-events-none absolute -right-20 -top-16 h-48 w-48 rounded-full bg-power-orange/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-turf-green/20 blur-3xl" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Links to Legal Pages */}
        <div className="mb-12 p-6 bg-orange-50 rounded-lg border-2 border-orange-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📋 For Detailed Legal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <Link
              href="/terms"
              className="text-power-orange hover:underline font-medium"
            >
              → Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-power-orange hover:underline font-medium"
            >
              → Privacy Policy
            </Link>
            <Link
              href="/refund-policy"
              className="text-power-orange hover:underline font-medium"
            >
              → Full Refund Policy
            </Link>
            <Link
              href="/health-waiver"
              className="text-power-orange hover:underline font-medium"
            >
              → Health & Safety Waiver
            </Link>
            <Link
              href="/parental-consent"
              className="text-power-orange hover:underline font-medium"
            >
              → Parental Consent Agreement
            </Link>
            <Link
              href="/content-policy"
              className="text-power-orange hover:underline font-medium"
            >
              → Content Moderation Policy
            </Link>
            <Link
              href="/insurance-requirements"
              className="text-power-orange hover:underline font-medium"
            >
              → Insurance Requirements
            </Link>
            <Link
              href="/cookies"
              className="text-power-orange hover:underline font-medium"
            >
              → Cookie Policy
            </Link>
            <Link
              href="/accessibility"
              className="text-power-orange hover:underline font-medium"
            >
              → Accessibility Statement
            </Link>
          </div>
        </div>

        <div className="space-y-8">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                {category.category}
              </h2>
              <div className="space-y-3">
                {category.questions.map((faq, faqIndex) => {
                  const id = `${categoryIndex}-${faqIndex}`;
                  const isOpen = openItems.includes(id);

                  return (
                    <Card
                      key={id}
                      className="bg-white border-2 border-slate-100 hover:border-power-orange/30 transition-colors"
                    >
                      <button
                        onClick={() => toggleItem(id)}
                        className="w-full p-5 text-left flex items-start justify-between gap-4"
                      >
                        <h3 className="text-lg font-semibold text-slate-900 flex-1">
                          {faq.question}
                        </h3>
                        <ChevronDown
                          size={24}
                          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5">
                          <p className="text-slate-600 leading-relaxed">
                            {faq.answer}
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Support Section */}
        <Card className="bg-linear-to-br from-power-orange/5 to-turf-green/5 border-2 border-power-orange/20 mt-12 p-8 text-center">
          <MessageCircle size={48} className="mx-auto mb-4 text-power-orange" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Still have questions?
          </h2>
          <p className="text-slate-600 mb-6 max-w-xl mx-auto">
            Our support team is here to help. Reach out and we'll get back to
            you as soon as possible.
          </p>
          <Link href="/contact">
            <Button variant="primary" size="lg">
              Contact Support
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="bg-white border-2 border-slate-100 hover:border-power-orange/30 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 text-left flex items-start justify-between gap-4"
      >
        <h3 className="text-lg font-semibold text-slate-900 flex-1">
          {question}
        </h3>
        <ChevronDown
          size={24}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-100">
          <p className="text-slate-600 leading-relaxed whitespace-pre-line mt-4">
            {answer}
          </p>
        </div>
      )}
    </Card>
  );
}
