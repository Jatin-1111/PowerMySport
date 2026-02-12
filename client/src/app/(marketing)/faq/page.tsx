"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const faqs = [
  {
    category: "General",
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
          <Link href="/">
            <Button variant="ghost" className="mb-4 -ml-2">
              <ArrowLeft size={18} className="mr-2" />
              Back to Home
            </Button>
          </Link>

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
