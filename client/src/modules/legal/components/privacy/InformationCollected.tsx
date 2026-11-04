export function InformationCollected() {
  return (
    <section id="information-collected" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Information We Collect</h2>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Personal Information</h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        We collect information that you provide directly to us, including:
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-slate-600">
        <li>Name, email address, and phone number</li>
        <li>Account credentials (username and password)</li>
        <li>
          Payment information (processed securely through our payment gateway; we do not store full
          card details)
        </li>
        <li>Profile information and preferences</li>
        <li>Dependent information (for parent/guardian accounts)</li>
        <li>
          Business documents, government identifiers, bank/payout details, and certifications (for
          venue listers and coaches)
        </li>
      </ul>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Usage Information</h3>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-slate-600">
        <li>Booking history and preferences</li>
        <li>Search queries and browsing behavior</li>
        <li>
          Device and technical information (IP address, browser type, operating system, device
          identifiers)
        </li>
        <li>Location data (with your permission)</li>
        <li>Communication preferences and history</li>
      </ul>
      <p className="leading-relaxed text-slate-600">
        You are solely responsible for ensuring that any information you provide, including about a
        dependent or on behalf of a business, is accurate and that you are legally authorized to
        provide it.
      </p>
    </section>
  );
}
