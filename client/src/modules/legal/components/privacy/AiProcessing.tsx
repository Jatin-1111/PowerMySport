/**
 * What the policy says about AI model providers.
 *
 * DRAFT FOR LEGAL REVIEW. Written 2026-10-05. Every statement below is one we can
 * check against what the code sends and what the product does. The one thing that
 * cannot be stated from the code is what the provider does with the content, so it
 * is held back in PROVIDER_HANDLING_STATEMENT, which renders nothing until someone
 * who has checked the facts fills it in.
 *
 * ── TODO for the owner and a lawyer before this is treated as final ─────────
 * 1. Find out which Gemini API plan the production key is on (Google AI Studio or
 *    the Cloud console: is Cloud Billing enabled on the project?). Google's terms
 *    (ai.google.dev/gemini-api/terms, effective 2026-03-23, updated 2026-04-28)
 *    treat the two very differently:
 *      - Unpaid Services: "Google uses the content you submit to the Services and
 *        any generated responses to provide, improve, and develop Google products
 *        and services", "human reviewers may read, annotate, and process your API
 *        input and output", and "Do not submit sensitive, confidential, or personal
 *        information to the Unpaid Services."
 *      - Paid Services: Google "doesn't use your prompts ... or responses to
 *        improve our products", logs them "for a limited period of time, solely for
 *        detecting and preventing violations of the Prohibited Use Policy", and
 *        data "may be stored transiently or cached in any country in which Google
 *        or its agents maintain facilities".
 *    Comments in server/src/admin/services/dataSourceExtraction/gemini.ts describe
 *    free-tier quotas, so the key may be unpaid. If it is, this feature sends
 *    personal information, including about children, to a service whose own terms
 *    say not to. Moving to Paid Services is the fix, and this section's wording
 *    should be written for whichever plan is true.
 * 2. Google's terms also say: "You must be 18 years of age or older to use the
 *    APIs. You also will not use the Services as part of a website, application,
 *    or other service ... that is directed towards or is likely to be accessed by
 *    individuals under the age of 18." PowerMySport is for parents, but it has a
 *    Player role and holds profiles of children. Whether that fits the clause is a
 *    question for a lawyer, not a sentence in this file.
 * 3. Have the DPDP Act position on children's data and cross-border transfer
 *    checked against this text and against InternationalTransfers.tsx.
 * 4. Decide the effective date. page.tsx updates "Last updated" only.
 *
 * Plain-language rules for this file: no dashes in copy, say what is sent, say what
 * is not, and never promise what we cannot show.
 */

/**
 * What the provider does with the content: whether it is kept, for how long, and
 * whether it may be used to improve the provider's products. Deliberately null.
 * Fill it in only after item 1 above is settled, in words that match the plan.
 */
const PROVIDER_HANDLING_STATEMENT: string | null = null;

export function AiProcessing() {
  return (
    <section id="ai-processing" className="mb-8">
      <h2 className="mb-4 text-2xl font-bold text-slate-900">AI Features and Model Providers</h2>

      <p className="mb-4 leading-relaxed text-slate-600">
        Some features write their answers with an AI model: the season planner (suggested
        tournaments, and travel and stay estimates), the guidance plans, and the chat assistants. We
        send the request to Google&apos;s Gemini API, which processes it on our behalf as a service
        provider. We do not run our own model.
      </p>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">What we send</h3>
      <p className="mb-3 leading-relaxed text-slate-600">
        We send only what a feature needs to answer. For the season planner that is:
      </p>
      <ul className="mb-4 list-disc space-y-2 pl-6 text-slate-600">
        <li>
          the player&apos;s first name, age list (for example Under-14), ranking position and the
          state they are registered in
        </li>
        <li>the tournaments they are eligible for, and the events already on their plan</li>
        <li>
          the goal you choose and any dates you mark as unavailable, including the note you type on
          them
        </li>
        <li>
          your home city, if you give one, together with the city of each event, to estimate travel
          and stay
        </li>
      </ul>
      <p className="mb-4 leading-relaxed text-slate-600">
        We do not send a date of birth, a federation registration number, an email address, a phone
        number or a street address to the model. For the guidance plans and the chat assistants, we
        send what you type and the details you have given us for that feature, such as a
        player&apos;s age, sport and goals.
      </p>
      <p className="mb-4 leading-relaxed text-slate-600">
        Travel and stay estimates are requested automatically for events on your plan and events we
        suggest. Suggestions are only requested when you ask for them.
      </p>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">
        What the AI does and does not decide
      </h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        Whether a player may enter a tournament is decided by the federation&apos;s published entry
        rules, applied by our own software, not by the AI. The model only chooses and explains from
        events those rules allow, and we check its answer before you see it. We do not use this
        information for advertising.
      </p>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">
        Estimates and suggestions can be wrong
      </h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        Costs are estimates, shown as ranges and labelled as estimates, and entry fees are never
        estimated. Dates, entry rules and fees can change, so please confirm them with the
        event&apos;s official fact sheet before you travel or pay.
      </p>

      <h3 className="mb-3 text-xl font-semibold text-slate-900">
        The provider&apos;s handling of this content
      </h3>
      <p className="mb-4 leading-relaxed text-slate-600">
        Google handles the content we send under its own Gemini API terms, which say how long it is
        kept and whether it may be used to improve Google&apos;s products. Those terms depend on the
        plan we use and Google can change them. They are published at{" "}
        <a
          href="https://ai.google.dev/gemini-api/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-orange-700 hover:underline"
        >
          ai.google.dev/gemini-api/terms
        </a>
        .
      </p>
      {PROVIDER_HANDLING_STATEMENT && (
        <p className="mb-4 leading-relaxed text-slate-600">{PROVIDER_HANDLING_STATEMENT}</p>
      )}

      <h3 className="mb-3 text-xl font-semibold text-slate-900">Your choices</h3>
      <p className="leading-relaxed text-slate-600">
        You can use the planner&apos;s entry checks, calendar and plan without asking for
        suggestions, and you can leave your city blank. Deleting your account removes your season
        plans, linked rankings and saved city. See{" "}
        <a href="#your-rights" className="font-semibold text-orange-700 hover:underline">
          Your Rights
        </a>{" "}
        for how to ask us about your information.
      </p>
    </section>
  );
}
