export function HowWeUseInformation() {
  return (
    <section id="how-we-use-information" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">How We Use Your Information</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        We use the collected information for purposes including:
      </p>
      <ul className="list-disc space-y-2 pl-6 text-slate-600">
        <li>To provide, maintain, and improve our services</li>
        <li>To process bookings and payments</li>
        <li>To send booking confirmations and updates</li>
        <li>To communicate with you about your account or transactions</li>
        <li>To provide customer support</li>
        <li>
          To detect, investigate, and prevent fraud, abuse, or unauthorized activity, including
          sharing information with fraud-prevention and law-enforcement bodies where necessary
        </li>
        <li>To comply with legal, regulatory, and tax obligations</li>
        <li>To send marketing communications (you may opt out at any time)</li>
        <li>To analyze usage patterns and improve user experience</li>
        <li>To enforce our Terms of Service and this Policy</li>
      </ul>

      <h3 className="mb-3 mt-6 text-xl font-semibold text-slate-900">WhatsApp</h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        If you tick the WhatsApp box when you sign up, or switch it on in Settings, we use the phone
        number on your account to send booking updates (confirmed, cancelled, moved or a reminder)
        on WhatsApp. We record when and where you agreed. You can withdraw at any time in Settings,
        or by replying STOP to any of our WhatsApp messages, and we will stop.
      </p>
      <p className="leading-relaxed text-slate-600">
        If you message our WhatsApp number yourself, an AI assistant replies. It tells you it is an
        AI and asks you not to share medical, identity or payment details. We keep the chat for 90
        days to follow the thread and store your number only as a one-way hash, and replying STOP
        deletes it. WhatsApp is run by Meta Platforms, which handles messages on its own platform
        under its own terms and privacy policy.
      </p>
    </section>
  );
}
