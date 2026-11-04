import { StatusTag } from "@/modules/shared/ui/StatusTag";
import type { CoachVerificationDocument } from "@/types";
import { Check } from "lucide-react";
import type { VerificationView } from "../../utils/overview";
import { ProfileSection } from "@/modules/shared/components/settings/ProfileSection";

/**
 * Where the coach's review stands, in words, and the documents our team has on
 * file. The two used to be separate cards; they answer one question.
 */
export function VerificationSection({
  view,
  guidance,
  documents,
  notes,
}: {
  view: VerificationView;
  guidance: string;
  documents: CoachVerificationDocument[];
  notes?: string;
}) {
  return (
    <ProfileSection
      id="verification"
      title="Verification"
      description="Our team checks your details and documents before you appear to clients."
    >
      <div className="space-y-6">
        <div>
          <StatusTag tone={view.tone}>{view.tag}</StatusTag>
          <p className="text-ink-body mt-3 max-w-[60ch] text-pretty">{guidance}</p>
          {notes && (
            <p className="mt-3 max-w-[60ch] text-pretty border-l-2 border-red-700/40 pl-4 text-red-900">
              <span className="mb-0.5 block text-sm">Notes from our team</span>
              {notes}
            </p>
          )}
        </div>

        {documents.length > 0 && (
          <div>
            <h3 className="text-ink text-sm font-medium">Documents on file</h3>
            <ul className="border-hairline mt-2 border-t">
              {documents.map((doc, index) => (
                <li
                  key={`${doc.fileName}-${index}`}
                  className="border-hairline flex items-center justify-between gap-4 border-b py-3"
                >
                  <div className="min-w-0">
                    <p className="text-ink truncate font-medium">{doc.fileName}</p>
                    <p className="text-ink-body text-sm capitalize">
                      {String(doc.type).toLowerCase().replace(/_/g, " ")}
                    </p>
                  </div>
                  <Check
                    size={18}
                    strokeWidth={1.5}
                    className="text-green-800"
                    aria-label="Received"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ProfileSection>
  );
}
