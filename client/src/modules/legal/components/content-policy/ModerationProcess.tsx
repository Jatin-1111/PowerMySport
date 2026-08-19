import { Flag } from "lucide-react";

export function ModerationProcess() {
  return (
          <section id="moderation-process" className="mb-8">
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
  );
}
