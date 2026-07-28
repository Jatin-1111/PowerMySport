// ─── RAG knowledge base — source content to embed ─────────────────────────────
// The canonical copy for retrieval-augmented generation. Kept independent of
// the client FAQ page's copy (client/src/app/(marketing)/faq/page.tsx) — this
// version can carry more grounding detail than the bite-sized UI copy needs.
// Re-run `npm run embed:knowledge` (server) after editing this file.

export interface KnowledgeSourceEntry {
  sourceType: "faq";
  sourceId: string;
  title: string;
  content: string;
}

export const KNOWLEDGE_BASE_SOURCES: KnowledgeSourceEntry[] = [
  // ── General & Getting Started ────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "general-what-is-powermysport",
    title: "What is PowerMySport?",
    content:
      "PowerMySport helps parents plan their child's sports journey with AI-powered pathways, personalised guidance, and verified expert sessions across India. Core tools are kept separate on purpose: Get Started (a free Sport Assessment at /assessment/discover for parents who don't yet know which sport suits their child), Problem Solver (AI Guidance at /guidance that builds a full personalized development plan once a sport is known), Sports Pathways (a roadmap explorer at /roadmap covering 70+ sports), and Experts (1:1 consultations with verified coaches and mentors at /experts). The venue/coach/academy booking marketplace is temporarily paused.",
  },
  {
    sourceType: "faq",
    sourceId: "general-create-account",
    title: "How do I create an account?",
    content:
      'Click "Sign Up" in the top right corner and choose an account type (Player, Venue Lister, Coach, or Academy Owner). Fill in your details and verify your email to get started.',
  },
  {
    sourceType: "faq",
    sourceId: "general-is-it-free",
    title: "Is PowerMySport free to use?",
    content:
      "Yes — creating an account, using the free Sport Assessment to find the right sport, using AI Guidance to build a personalized plan, and exploring sport pathways/roadmaps are all free. You only pay when you book a paid service, like an expert consultation.",
  },

  // ── Expert Sessions & Payments ───────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "booking-how-to-book",
    title: "Can I book a venue, coach, or academy session right now?",
    content:
      "The venue/coach/academy booking marketplace is temporarily paused while we roll out improvements. In the meantime, you can still get 1:1 guidance from a verified expert, or use the free Sport Assessment and AI Guidance tools to plan your child's sports journey.",
  },
  {
    sourceType: "faq",
    sourceId: "booking-split-payment",
    title: "How do I book an expert consultation?",
    content:
      "Browse verified experts, pick one whose expertise fits your child, select an available time slot, and confirm. You're directed to payment, and you get a confirmation with the session details once it's complete.",
  },
  {
    sourceType: "faq",
    sourceId: "booking-payment-methods",
    title: "What payment methods are accepted?",
    content:
      "Card, UPI, and wallet checkout are supported for expert session payments. All payments are processed securely through the payment gateway.",
  },
  {
    sourceType: "faq",
    sourceId: "booking-cancel-reschedule",
    title: "Can I cancel or reschedule an expert session?",
    content:
      "Yes — go to your dashboard, find the session, and choose to cancel or reschedule. Refunds follow the standard cancellation policy.",
  },

  // ── For Players ───────────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "players-find-venues",
    title: "How do I find the right sport for my child?",
    content:
      "Use Get Started (the free Sport Assessment) — answer a few quick questions about your child's age, personality, and physical traits, and it recommends sports that genuinely fit. Already know the sport? Build a Sport Profile instead to skip straight to personalization.",
  },
  {
    sourceType: "faq",
    sourceId: "players-venue-closed",
    title: "Can I get a personalized development plan for my child?",
    content:
      "Yes — Problem Solver (AI Guidance) builds a full plan once you know your child's sport: training phases, a weekly schedule, a cost breakdown, and the ideal coaching style for their personality.",
  },
  {
    sourceType: "faq",
    sourceId: "players-book-multiple",
    title: "Can I add multiple children or book for more than one?",
    content:
      "Yes — dependents (like children) can be added to an account and expert sessions booked for them. This is especially useful for parents managing more than one child's sports journey.",
  },

  // ── For Venue & Academy Owners ────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "venues-how-to-list",
    title: "How do I list my venue or academy?",
    content:
      "Sign up as a Venue Lister or Academy Owner and complete onboarding, including facility details, location, pricing, and documentation. Once approved by the review team, the listing goes live.",
  },
  {
    sourceType: "faq",
    sourceId: "venues-required-documents",
    title: "What documents do I need to provide?",
    content:
      "Ownership proof, business registration, tax documents, insurance, and any relevant sports facility certifications. All documents are reviewed for authenticity.",
  },
  {
    sourceType: "faq",
    sourceId: "venues-receive-payments",
    title: "How do I receive payments?",
    content:
      "Once the booking marketplace is live, payments are automatically deposited to the registered bank account after each booking is completed, and earnings can be tracked in the dashboard. Onboarding is open now so listings are ready as soon as bookings launch.",
  },
  {
    sourceType: "faq",
    sourceId: "venues-different-pricing",
    title: "Can I set different prices for different sports?",
    content:
      "Yes — sport-specific pricing is supported. For example, a cricket pitch can be priced differently than a badminton court.",
  },

  // ── For Coaches ───────────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "coaches-become-a-coach",
    title: "How do I become a coach on the platform?",
    content:
      "Sign up as a Coach, provide certifications and sports expertise, and choose a service mode (own venue, freelance, or hybrid). The booking marketplace is temporarily paused, so complete the profile now to be ready to receive bookings as soon as it reopens.",
  },
  {
    sourceType: "faq",
    sourceId: "coaches-service-modes",
    title: "What are the different coach service modes?",
    content:
      "OWN_VENUE: the coach has their own training facility. FREELANCE: the coach travels to different venues. HYBRID: both options are offered.",
  },
  {
    sourceType: "faq",
    sourceId: "coaches-set-availability",
    title: "How do I set my availability?",
    content:
      "Schedule is managed in the coach dashboard. Block out unavailable times, and the system only shows available slots to players.",
  },
  {
    sourceType: "faq",
    sourceId: "coaches-insurance-required",
    title: "Do coaches need insurance?",
    content:
      "Yes. All coaches must maintain active Professional Liability Insurance (₹25-50 lakh) to operate on PowerMySport. This protects the coach and players. Insurance is verified at onboarding and throughout the year — coaches without valid insurance cannot accept bookings.",
  },

  // ── Payment & Refunds ─────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "refunds-cancellation-policy",
    title: "What is the cancellation and refund policy?",
    content:
      "Tiered refund system based on cancellation timing: more than 48 hours before — 100% refund; 24-48 hours before — 50% refund; less than 24 hours before — no refund. For complex cases or emergencies, contact teams@powermysport.com with documentation.",
  },
  {
    sourceType: "faq",
    sourceId: "refunds-emergency-cancellation",
    title: "What if I need to cancel due to an emergency?",
    content:
      "Contact support immediately at teams@powermysport.com with proof of the emergency (e.g. a medical certificate). The case is reviewed and an emergency refund exception may be approved on a case-by-case basis.",
  },
  {
    sourceType: "faq",
    sourceId: "refunds-how-to-request",
    title: "How do I request a refund?",
    content:
      "Log in, go to My Bookings, select the booking to cancel, and click 'Request Cancellation.' The refund follows the standard refund windows and is returned to the original payment method within 5-7 business days.",
  },
  {
    sourceType: "faq",
    sourceId: "refunds-coach-or-venue-cancels",
    title: "What if the coach or venue cancels on me?",
    content:
      "If the coach, venue, or PowerMySport cancels, a 100% refund applies. A dispute ticket can also be opened in the account, or a complaint filed at teams@powermysport.com.",
  },

  // ── Payment Disputes & Resolution ────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "disputes-how-to-file",
    title: "How do I file a dispute?",
    content:
      "Through the account: go to My Bookings, select the booking, and click 'File Dispute.' A unique Dispute Ticket ID (format DISP-YYYY-XXXXXX) is issued to track the case. Disputes can also be emailed to teams@powermysport.com with booking details.",
  },
  {
    sourceType: "faq",
    sourceId: "disputes-resolution-timeline",
    title: "How long does dispute resolution take?",
    content:
      "24 hours: receipt acknowledged and assigned to an investigator. 3-5 business days: initial investigation. 7-10 business days: final decision and resolution. Complex cases needing external verification may take longer.",
  },
  {
    sourceType: "faq",
    sourceId: "disputes-types",
    title: "What types of disputes can I file?",
    content:
      "Payment issues (unauthorized charges, duplicate transactions, billing errors), service issues (coach no-show, quality below expectations), refund issues (not processed or delayed), booking issues (not fulfilled as promised), and other issues (safety concerns, discrimination, etc.).",
  },
  {
    sourceType: "faq",
    sourceId: "disputes-appeal",
    title: "Can I appeal a dispute decision?",
    content:
      "Yes — an appeal can be filed within 5 days of the resolution notice, including new evidence not available during the initial investigation. A fresh review is conducted with a different investigator.",
  },

  // ── Health & Safety ───────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "safety-waiver-what-is-it",
    title: "What is the Health & Safety Waiver?",
    content:
      "A legal document acknowledging the risks of sports activities (sprains, fractures, head trauma, etc.) and accepting responsibility for health and safety. Accepting it releases PowerMySport, coaches, and venues from liability for injuries during normal activity.",
  },
  {
    sourceType: "faq",
    sourceId: "safety-waiver-when-required",
    title: "When do I need to accept the health waiver?",
    content:
      "During the first booking as a player, on behalf of any dependent minor at their first booking, and when renewing an expired waiver. Booking is not possible without a current waiver.",
  },
  {
    sourceType: "faq",
    sourceId: "safety-waiver-validity",
    title: "How long is my waiver valid?",
    content:
      "Waivers are valid for 12 months from acceptance. An email reminder goes out 30 days before expiry. The waiver must be renewed online before it expires to keep booking — renewal takes about a minute.",
  },
  {
    sourceType: "faq",
    sourceId: "safety-waiver-expired",
    title: "What if my waiver expires?",
    content:
      "New sessions cannot be booked until the waiver is renewed. Go to account settings, find the expired waiver, and click 'Renew Waiver' to accept the current version immediately.",
  },

  // ── Parental Consent & Minors ─────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "minors-can-child-book",
    title: "Can my child book on PowerMySport?",
    content:
      "Children under 18 cannot create their own accounts. A parent or legal guardian (18+) creates a parent account and adds the child as a dependent. The parent is fully responsible for all bookings and assumes all liability.",
  },
  {
    sourceType: "faq",
    sourceId: "minors-add-dependent",
    title: "How do I add a minor as a dependent?",
    content:
      "After creating and verifying a parent account, go to Family & Dependents and click 'Add Dependent.' Provide the child's full name, date of birth, relationship, and medical/emergency contact information. Unlimited dependents can be added.",
  },
  {
    sourceType: "faq",
    sourceId: "minors-parental-consent-process",
    title: "What's the parental consent process?",
    content:
      "Booking sports activities for a child requires accepting the Parental Consent agreement, accepting the Health & Safety Waiver on the child's behalf, declaring any medical conditions or health concerns, and authorizing emergency contact. All consent requirements must be completed before booking.",
  },
  {
    sourceType: "faq",
    sourceId: "minors-supervision-requirements",
    title: "What are the supervision requirements for minors?",
    content:
      "Under 8 years: a parent/guardian must be present on-site. 8-12 years: a parent/guardian must be on-call and reachable within 15 minutes. 13-17 years: a parent/guardian must be on-call, but on-site presence isn't required. Venues and coaches must enforce these requirements.",
  },

  // ── Content Policy & Community ────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "content-reviews-and-photos",
    title: "Can I post reviews and photos on PowerMySport?",
    content:
      "Yes — reviews can be posted after completing a session with an expert, and photos from sessions can be shared. All content must follow the Content Policy: no abusive, misleading, or inappropriate content.",
  },
  {
    sourceType: "faq",
    sourceId: "content-not-allowed",
    title: "What content is not allowed?",
    content:
      "Prohibited: abusive or threatening language, false/misleading information, inappropriate images/videos, spam or promotion of external services, privacy violations (doxxing), fake or paid reviews, illegal content, and content violating others' intellectual property rights.",
  },
  {
    sourceType: "faq",
    sourceId: "content-review-removed",
    title: "Why was my review removed?",
    content:
      "Usually a Content Policy violation — abusive language, false claims, inappropriate media, or appearing to be a paid/fake review. An email with the specific reason is sent, and the decision can be appealed via the link in that email.",
  },
  {
    sourceType: "faq",
    sourceId: "content-moderation-timeline",
    title: "How long does content moderation take?",
    content:
      "Severe violations (abuse, illegal content): removed within 24 hours. High priority (misleading, spam): within 48 hours. Standard violations: within 5-7 business days. Appeals are manually reviewed and may take additional time.",
  },

  // ── Insurance & Venue Requirements ─────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "insurance-required-for-coaches-venues",
    title: "Do coaches and venues need insurance?",
    content:
      "Yes. All coaches and venue owners must maintain active insurance coverage, protecting users if an incident occurs. Insurance is verified at onboarding and throughout the year.",
  },
  {
    sourceType: "faq",
    sourceId: "insurance-what-if-missing",
    title: "What happens if a coach or venue doesn't have insurance?",
    content:
      "Coaches and venues without valid insurance cannot operate on PowerMySport. They have 7 days to provide proof; if not provided, they're suspended for 14 days, and the account is terminated if still unresolved.",
  },
  {
    sourceType: "faq",
    sourceId: "insurance-how-to-verify",
    title: "How do I verify a coach's or venue's insurance?",
    content:
      "Insurance status is shown on every coach/venue profile under 'Certifications': provider, policy number (hidden for privacy), expiry date, and verification status. If it shows 'Expired' or 'Unverified,' contact support before booking.",
  },

  // ── Privacy & Cookies ──────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "privacy-cookies-usage",
    title: "Does PowerMySport use cookies?",
    content:
      "Yes — essential cookies keep users signed in and protect the platform. Advertising cookies are not used, and there is currently no cookie banner.",
  },
  {
    sourceType: "faq",
    sourceId: "privacy-disable-cookies",
    title: "What can I do if I don't want cookies?",
    content:
      "Cookies can be disabled in browser settings or cleared at any time. Note that blocking essential cookies may prevent login and other core features from working properly.",
  },
  {
    sourceType: "faq",
    sourceId: "privacy-data-usage",
    title: "How is my personal data used?",
    content:
      "Data is used to provide the service, process payments, improve the experience, detect fraud, and comply with legal requirements. Personal data is never sold. See the Privacy Policy for full details.",
  },
  {
    sourceType: "faq",
    sourceId: "privacy-delete-account",
    title: "Can I delete my account and data?",
    content:
      "Yes — go to Account Settings, select 'Privacy & Data,' and click 'Request Account Deletion.' Personal data is deleted within 30 days, except transaction records (required by law) and dispute/legal records; some data may be anonymized instead of deleted.",
  },

  // ── Technical & Account ────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "technical-cant-log-in",
    title: "Why can't I log in to my account?",
    content:
      "Try resetting the password via the login page, clearing browser cache, trying a different browser, and checking that JavaScript is enabled. If still not working, email teams@powermysport.com with the account email address.",
  },
  {
    sourceType: "faq",
    sourceId: "technical-transaction-declined",
    title: "Why was my transaction declined?",
    content:
      "Common reasons: insufficient funds, incorrect CVV, expired card, incorrect address, or fraud detection. Contact the bank if multiple attempts fail, or try a different payment method.",
  },
  {
    sourceType: "faq",
    sourceId: "technical-change-contact-info",
    title: "How do I change my email or phone number?",
    content:
      "Go to Account Settings, select 'Contact Information,' and update the email or phone. A verification code confirms the change, and re-login is required after changing the email.",
  },

  // ── General Support ────────────────────────────────────────────────────────
  {
    sourceType: "faq",
    sourceId: "support-available-outside-india",
    title: "Is PowerMySport available outside India?",
    content:
      "Currently PowerMySport operates only in India, with expansion to other countries planned for the future. Accounts cannot currently be created from outside India.",
  },
  {
    sourceType: "faq",
    sourceId: "support-contact-methods",
    title: "How do I contact PowerMySport?",
    content:
      "Reach the team at teams@powermysport.com, via the contact form at powermysport.com/contact, or browse the FAQ page for quick answers.",
  },
];
