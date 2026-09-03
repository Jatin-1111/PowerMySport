export function Verification() {
  return (
    <section id="verification" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">Verification &amp; Approval</h2>
      <p className="mb-4 leading-relaxed text-slate-600">
        No Partner profile goes live automatically. Every application is reviewed by the
        PowerMySport team before it becomes visible to clients.
      </p>
      <ul className="mb-6 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          <strong>UNVERIFIED:</strong> The account exists but the profile is hidden and cannot
          receive bookings. You must complete the onboarding wizard and submit for review.
        </li>
        <li>
          <strong>PENDING:</strong> The application is under review. We aim to complete review
          within 5–7 business days, though it may take longer where documents require third-party
          verification. You are notified of the outcome by email and in-platform notification.
        </li>
        <li>
          <strong>APPROVED:</strong> The profile is live, discoverable, and eligible to receive
          bookings.
        </li>
        <li>
          <strong>REJECTED:</strong> The application did not meet our requirements. You will receive
          a reason and may resubmit after addressing it. Repeated misrepresentation may result in a
          permanent bar from the Partner programme.
        </li>
      </ul>
      <p className="mb-4 leading-relaxed text-slate-600">
        We may conduct background checks, reference checks, credential verification, facility
        inspection, or third-party verification at any time, including after approval. You agree to
        cooperate with such checks and to provide documents within seven (7) days of a request.
      </p>
      <p className="leading-relaxed text-slate-600">
        Approval is not an endorsement, certification, or guarantee by PowerMySport of your
        competence, safety, or results. We may revoke APPROVED status at any time where information
        is found to be false, where conduct falls below expected standards, or where continued
        listing poses a risk to clients.
      </p>
    </section>
  );
}
