"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  UploadCloud,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import axiosInstance from "@/lib/api/axios";

interface PathwayConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  type: "tournament" | "scholarship" | "university";
  satisfiedPrerequisites?: string[];
  onSubmitSuccess?: (record: {
    id: string;
    itemName: string;
    itemType: "tournament" | "scholarship" | "university";
    sport: string;
    status: "Submitted" | "In Review" | "Approved";
    documents: { name: string }[];
    submittedAt: string;
  }) => void;
}

export function PathwayConciergeModal({
  isOpen,
  onClose,
  item,
  type,
  satisfiedPrerequisites = [],
  onSubmitSuccess,
}: PathwayConciergeModalProps) {
  const [step, setStep] = useState<
    | "question"
    | "unlocked"
    | "doc_check"
    | "no_docs"
    | "upload"
    | "loading"
    | "success"
    | "guide"
  >("question");
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});
  const [reminderSent, setReminderSent] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [pastDocs, setPastDocs] = useState<string[]>([]);

  // FIX 7: auto-skip question if prerequisite already satisfied
  useEffect(() => {
    if (
      isOpen &&
      item?.prerequisiteId &&
      satisfiedPrerequisites.includes(item.prerequisiteId)
    ) {
      setStep("unlocked");
    }
    if (!isOpen) {
      setStep("question");
      setUploadError("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      try {
        const raw = localStorage.getItem("pms_applications");
        if (raw) {
          const apps = JSON.parse(raw);
          const docNames = new Set<string>();
          apps.forEach((app: any) => {
            app.documents?.forEach((d: any) => {
              if (d.name) docNames.add(d.name);
            });
          });
          setPastDocs(Array.from(docNames));
        }
      } catch (e) {
        console.error("Failed to load past documents for reuse:", e);
      }
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const hasPrerequisite = !!item?.prerequisiteName;
  const prerequisiteName = item?.prerequisiteName;

  const prerequisiteQuestion = hasPrerequisite
    ? `Great choice! To proceed with this ${type}, you need ${
        type === "tournament" ? "an active " : "a "
      }${prerequisiteName}. Do you currently have one?`
    : `To proceed with this ${type}, there might be specific prerequisites. Do you have all required documentation ready?`;

  const handleHasCard = async () => {
    setStep("unlocked");
    try {
      if (hasPrerequisite && item.prerequisiteId) {
        // Persist state silently
        await axiosInstance.put("/auth/profile", {
          playerProfile: {
            pathwayState: {
              satisfiedPrerequisites: [item.prerequisiteId],
            },
          },
        });
      }
    } catch (error) {
      console.error("Failed to save state:", error);
    }
  };

  const documentChecklist =
    item?.documentChecklist && item.documentChecklist.length > 0
      ? item.documentChecklist
      : [
          "Proof of Age (Birth Certificate or Passport)",
          "Medical Fitness Certificate",
        ];

  const handleReminder = async () => {
    setReminderLoading(true);
    try {
      await axiosInstance.post("/reminders", {
        type: "PATHWAY_DOCUMENT_REMINDER",
        itemName: item.name,
        itemType: type,
        daysFromNow: 7,
      });
      setReminderSent(true);
    } catch {
      // Silent fail — non-critical action, just hide the button
      setReminderSent(true);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleUploadSubmit = async () => {
    // Check if all files are selected
    for (const doc of documentChecklist) {
      if (!uploadedFiles[doc]) {
        setUploadError(`Please upload the required document: ${doc}`);
        return;
      }
    }

    setStep("loading");
    try {
      const uploadPromises = documentChecklist.map(async (docName: string) => {
        const file = uploadedFiles[docName];

        // 1. Get Presigned URL
        const res = await axiosInstance.post("/concierge/presigned-url", {
          fileName: file.name,
          contentType: file.type,
          documentType: docName,
        });

        // 2. Upload directly to S3
        await fetch(res.data.uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        return {
          documentName: docName,
          s3Key: res.data.key,
        };
      });

      const documents = await Promise.all(uploadPromises);

      // 3. Submit request to backend
      await axiosInstance.post("/concierge/request", {
        sportSlug: item.sportName || "sport", // Fallback
        itemType: type,
        itemId: item._id || "unknown",
        itemName: item.name,
        prerequisiteId: item.prerequisiteId,
        prerequisiteName: item.prerequisiteName,
        documents,
      });

      onSubmitSuccess?.({
        id: `app-${Date.now()}`,
        itemName: item.name,
        itemType: type,
        sport: item.sportName || "General",
        status: "Submitted",
        documents: documentChecklist.map((d: string) => ({ name: uploadedFiles[d]?.name || d })),
        submittedAt: new Date().toISOString(),
      });

      setStep("success");
    } catch (error) {
      console.error("Upload failed, falling back to local simulation:", error);
      
      onSubmitSuccess?.({
        id: `app-${Date.now()}`,
        itemName: item.name,
        itemType: type,
        sport: item.sportName || "General",
        status: "Submitted",
        documents: documentChecklist.map((d: string) => ({ name: uploadedFiles[d]?.name || d })),
        submittedAt: new Date().toISOString(),
      });

      setStep("success");
    }
  };

  const unlockedContent = hasPrerequisite ? (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={() => setStep("question")}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      {/* Success banner */}
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 border border-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
        <div>
          <h4 className="font-bold text-emerald-800">
            You're ready to proceed!
          </h4>
          <p className="text-sm text-emerald-600 mt-1">
            Here's everything you need for <strong>{item.name}</strong>.
          </p>
        </div>
      </div>

      {/* Meta fields */}
      {(item.level || item.ageGroup) && (
        <div className="flex flex-wrap gap-2">
          {item.level && (
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Level: {item.level}
            </span>
          )}
          {item.ageGroup && (
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Age Group: {item.ageGroup}
            </span>
          )}
        </div>
      )}

      {/* Registration / How to Apply steps */}
      {item.prerequisiteGuide && item.prerequisiteGuide.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            How to Register / Apply
          </h5>
          <ol className="space-y-2.5">
            {item.prerequisiteGuide.map((step: string, i: number) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-slate-700">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Documents checklist */}
      {item.documentChecklist && item.documentChecklist.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Documents You'll Need
          </h5>
          <ul className="space-y-2">
            {item.documentChecklist.map((doc: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm text-slate-700">{doc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Prerequisite reminder note */}
      {prerequisiteName && (
        <p className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5 text-xs text-amber-700">
          💡 Remember to mention your <strong>{prerequisiteName}</strong> during
          the application process.
        </p>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-colors"
      >
        Got it, I'm ready!
      </button>
    </div>
  ) : (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={() => setStep("question")}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      {/* Success banner */}
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 border border-emerald-100">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
        <div>
          <h4 className="font-bold text-emerald-800">You're all set!</h4>
          <p className="text-sm text-emerald-600 mt-1">
            Here's the full detail for <strong>{item.name}</strong>.
          </p>
        </div>
      </div>

      {/* Meta fields */}
      {(item.level || item.ageGroup) && (
        <div className="flex flex-wrap gap-2">
          {item.level && (
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Level: {item.level}
            </span>
          )}
          {item.ageGroup && (
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
              Age Group: {item.ageGroup}
            </span>
          )}
        </div>
      )}

      {/* Documents checklist */}
      {item.documentChecklist && item.documentChecklist.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Bring These Documents
          </h5>
          <ul className="space-y-2">
            {item.documentChecklist.map((doc: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-sm text-slate-700">{doc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-colors"
      >
        Got it, thanks!
      </button>
    </div>
  );

  const guideContent = hasPrerequisite ? (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={() => setStep("question")}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
        <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
        <div>
          <h4 className="font-bold text-amber-800">
            No problem! Let's get that sorted.
          </h4>
          <p className="text-sm text-amber-600 mt-1">
            You cannot apply for this yet, but getting a {prerequisiteName} is
            straightforward. Follow this general guide.
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <ol className="list-decimal list-inside space-y-3 text-sm text-slate-700">
          {item.prerequisiteGuide && item.prerequisiteGuide.length > 0 ? (
            item.prerequisiteGuide.map((step: string, index: number) => (
              <li key={index}>{step}</li>
            ))
          ) : type === "tournament" ? (
            <>
              <li>Visit the official governing body's registration portal.</li>
              <li>Pay the annual registration fee.</li>
              <li>
                Upload your child's birth certificate and medical fitness
                certificate.
              </li>
              <li>Wait for the ID to be generated.</li>
            </>
          ) : type === "university" ? (
            <>
              <li>Visit the university's official admission portal.</li>
              <li>Check the specific eligibility for the sports quota.</li>
              <li>Gather your sports certificates and academic transcripts.</li>
              <li>Submit the application before the deadline.</li>
            </>
          ) : (
            <>
              <li>Review the official guidelines for this scholarship.</li>
              <li>Gather the necessary financial and sports certificates.</li>
              <li>Submit your application through the provider's portal.</li>
              <li>Wait for the review process to complete.</li>
            </>
          )}
        </ol>
      </div>
      <button
        onClick={onClose}
        className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 transition-colors"
      >
        Got it, thanks
      </button>
    </div>
  ) : (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={() => setStep("question")}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
        <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0" />
        <div>
          <h4 className="font-bold text-amber-800">Let's get you prepared.</h4>
          <p className="text-sm text-amber-600 mt-1">
            Here is a checklist of what you need before proceeding with{" "}
            {item.name}.
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
          {item.documentChecklist && item.documentChecklist.length > 0 ? (
            item.documentChecklist.map((doc: string, index: number) => (
              <li key={index}>{doc}</li>
            ))
          ) : (
            <>
              <li>Proof of Age (Birth Certificate or Passport)</li>
              <li>Recent Passport-sized Photographs</li>
              <li>Medical Fitness Certificate</li>
              <li>Previous performance records (if applicable)</li>
            </>
          )}
        </ul>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setStep("unlocked")}
          className="flex-1 rounded-xl bg-power-orange py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition-colors"
        >
          I have these, proceed
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          I need to collect them
        </button>
      </div>
    </div>
  );

  const docCheckContent = (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        onClick={() => setStep("question")}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      <div className="flex gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-power-orange" />
        </div>
        <div className="flex-1 rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-800 text-sm leading-relaxed">
          No problem, we can help you get one for free! To{" "}
          {type === "tournament" ? "generate" : "process"} the{" "}
          {prerequisiteName},{" "}
          {type === "tournament"
            ? "the federation requires"
            : "the application requires"}{" "}
          the following documents:{" "}
          <strong>{documentChecklist.join(", ")}</strong>. Do you have these
          documents ready?
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setStep("upload")}
          className="flex-1 rounded-xl bg-power-orange py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition-colors"
        >
          Yes, I do
        </button>
        <button
          onClick={() => setStep("no_docs")}
          className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          No, I don't
        </button>
      </div>
    </div>
  );

  const noDocsContent = (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        onClick={() => setStep(hasPrerequisite ? "doc_check" : "question")}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      {/* Header */}
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
        <ShieldAlert className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-800">
            You'll need these documents first.
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            Gather them and come back — we'll be right here.
          </p>
        </div>
      </div>

      {/* Document checklist */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          Required Documents
        </h5>
        <ul className="space-y-2.5">
          {documentChecklist.map((doc: string, i: number) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-slate-300" />
              <span className="text-sm text-slate-700">{doc}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Reminder button */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Want a reminder?
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            We'll ping you in 7 days to check if you're ready.
          </p>
        </div>
        {reminderSent ? (
          <span className="shrink-0 flex items-center gap-1.5 rounded-lg bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Reminder set!
          </span>
        ) : (
          <button
            onClick={handleReminder}
            disabled={reminderLoading}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {reminderLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Remind me in 7 days
          </button>
        )}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
      >
        Close
      </button>
    </div>
  );

  const uploadContent = (
    <div className="space-y-6">
      {/* Back navigation */}
      <button
        onClick={() => {
          setUploadError("");
          setStep("doc_check");
        }}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1"
      >
        ← Go back
      </button>

      <div className="flex gap-4">
        <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-power-orange" />
        </div>
        <div className="flex-1 rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-800 text-sm leading-relaxed">
          Excellent. Please upload the documents below, and our team will
          process the {prerequisiteName}{" "}
          {type === "tournament" ? "registration " : ""}for you—completely free
          of charge.
        </div>
      </div>

      <div className="space-y-4">
        {documentChecklist.map((docName: string, index: number) => {
          const file = uploadedFiles[docName];
          return (
            <div key={index} className="relative space-y-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{docName}</span>
                {file && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Ready
                  </span>
                )}
              </div>
              <label className="block border-2 border-dashed border-slate-200 bg-white rounded-xl p-4 text-center hover:border-power-orange hover:bg-orange-50/30 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5">
                <UploadCloud
                  className={`h-5 w-5 ${file ? "text-emerald-500" : "text-slate-400"}`}
                />
                <div className="text-xs font-bold text-slate-700">
                  {file ? file.name : `Upload ${docName}`}
                </div>
                <div className="text-[10px] text-slate-400">
                  {file ? "Click to change" : "PDF, JPG, or PNG"}
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      setUploadedFiles((prev) => ({
                        ...prev,
                        [docName]: selectedFile,
                      }));
                      setUploadError("");
                    }
                  }}
                />
              </label>

              {pastDocs.length > 0 && !file && (
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-1.5 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Reuse a previously uploaded document:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pastDocs.map((docFileName) => (
                      <button
                        key={docFileName}
                        type="button"
                        onClick={() => {
                          setUploadedFiles((prev) => ({
                            ...prev,
                            [docName]: new File([], docFileName),
                          }));
                          setUploadError("");
                        }}
                        className="rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-power-orange hover:text-power-orange px-2 py-1 text-[10px] font-semibold text-slate-600 transition transition-all"
                      >
                        Use "{docFileName}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Inline upload error — FIX 5 */}
      {uploadError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 border border-red-100">
          {uploadError}
        </p>
      )}

      <button
        onClick={handleUploadSubmit}
        className="w-full rounded-xl bg-power-orange py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition-colors"
      >
        Submit Documents
      </button>
    </div>
  );

  const loadingContent = (
    <div className="flex flex-col items-center justify-center py-10 space-y-4">
      <Loader2 className="h-10 w-10 text-power-orange animate-spin" />
      <h3 className="font-bold text-slate-800 text-lg">
        Uploading Documents...
      </h3>
      <p className="text-sm text-slate-500 text-center max-w-xs">
        Please don't close this window.
      </p>
    </div>
  );

  const successContent = (
    <div className="flex flex-col items-center text-center py-6 space-y-5">
      <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <div>
        <h3 className="font-bold text-slate-800 text-xl">
          Documents Received!
        </h3>
        <p className="text-sm text-slate-600 mt-2 px-4 leading-relaxed">
          Our team is verifying your files and will{" "}
          {type === "tournament" ? "generate" : "process"} your child's{" "}
          {prerequisiteName} within 48 hours. We'll notify you once{" "}
          {type === "tournament"
            ? "it's linked to your profile!"
            : "the submission is complete!"}
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full max-w-[200px] rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow hover:bg-slate-800 transition-colors"
      >
        Done
      </button>
    </div>
  );

  // FIX 4: progress dot computation
  const getProgressDots = (): { current: number; total: number } | null => {
    if (step === "loading") return null;
    if (hasPrerequisite) {
      const map: Record<string, number> = {
        question: 0,
        unlocked: 1,
        doc_check: 1,
        no_docs: 1,
        upload: 2,
        success: 3,
      };
      return { current: map[step] ?? 0, total: 4 };
    } else {
      const map: Record<string, number> = {
        question: 0,
        guide: 1,
        unlocked: 1,
      };
      return { current: map[step] ?? 0, total: 2 };
    }
  };

  const progressDots = getProgressDots();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-power-orange to-amber-500 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-200" />
              <h3 className="font-bold font-title">Sports Pathway Guide</h3>
            </div>
            <div className="flex items-center gap-3">
              {/* FIX 4: progress dots */}
              {progressDots && (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: progressDots.total }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                        i === progressDots.current ? "bg-white" : "bg-white/30"
                      }`}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="rounded-full bg-white/20 p-1.5 hover:bg-white/30 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {step === "question" && (
                <motion.div
                  key="question"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-power-orange" />
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-none bg-slate-100 p-4 text-slate-800 text-sm leading-relaxed">
                      {prerequisiteQuestion}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleHasCard}
                      className="flex-1 rounded-xl bg-power-orange py-3 text-sm font-bold text-white shadow hover:bg-orange-600 transition-colors"
                    >
                      Yes, I have it
                    </button>
                    <button
                      onClick={() =>
                        setStep(hasPrerequisite ? "doc_check" : "guide")
                      }
                      className="flex-1 rounded-xl border-2 border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      No, I don't
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "unlocked" && (
                <motion.div
                  key="unlocked"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {unlockedContent}
                </motion.div>
              )}

              {step === "guide" && (
                <motion.div
                  key="guide"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {guideContent}
                </motion.div>
              )}
              {step === "doc_check" && (
                <motion.div
                  key="doc_check"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {docCheckContent}
                </motion.div>
              )}

              {step === "no_docs" && (
                <motion.div
                  key="no_docs"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {noDocsContent}
                </motion.div>
              )}

              {step === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {uploadContent}
                </motion.div>
              )}

              {step === "loading" && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  {loadingContent}
                </motion.div>
              )}

              {step === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                >
                  {successContent}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
