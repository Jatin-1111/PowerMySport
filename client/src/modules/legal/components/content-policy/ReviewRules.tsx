export function ReviewRules() {
  return (
    <section id="review-rules" className="mb-8">
      <h2 className="mt-8 mb-4 text-2xl font-semibold">5. Review & Rating Specific Rules</h2>

      <h3 className="mt-6 mb-3 text-xl font-semibold">5.1 Eligibility to Leave Reviews</h3>
      <p>To leave a legitimate review, you must:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Have completed a verified booking with the coach or venue</li>
        <li>Be writing from personal, direct experience</li>
        <li>Not be the business owner or employee</li>
        <li>Not be a direct competitor</li>
        <li>Not have financial interest in the business (investor, shareholder)</li>
      </ul>

      <h3 className="mt-6 mb-3 text-xl font-semibold">5.2 Prohibited Reviews</h3>
      <p>We remove reviews that:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Are unrelated to the service booked</li>
        <li>Contain off-topic complaints (e.g., about app, not the service)</li>
        <li>Are primarily complaints about price without explaining specific value concerns</li>
        <li>Appear to be submitted by a friend or competitor</li>
        <li>Contain legal threats or demands</li>
        <li>Request removal in exchange for money or positive reviews</li>
      </ul>

      <h3 className="mt-6 mb-3 text-xl font-semibold">5.3 Response Policy</h3>
      <p>Coaches and venues can respond to reviews to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-6">
        <li>Provide their perspective on the feedback</li>
        <li>Offer solutions (e.g., refund, make-good booking)</li>
        <li>Thank reviewers for feedback</li>
      </ul>
      <p className="mt-3">
        Responses that are abusive, threatening, or violate these policies will be removed.
      </p>
    </section>
  );
}
