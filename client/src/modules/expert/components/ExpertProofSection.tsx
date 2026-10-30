"use client";

import {
  expertApi,
  type Expert,
  type ExpertProofFile,
  type ExpertProofType,
} from "@/modules/expert/services/expert";
import { Button } from "@/modules/shared/ui/Button";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 8 * 1024 * 1024;

const field =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20";

/**
 * Proof an admin reviews before an expert goes live: an ID document, and one
 * proof of the achievements claimed (a file or a link to a public record).
 * Self-contained: it loads and saves through the expert API, so the wizard only
 * has to render it.
 */
export function ExpertProofSection() {
  const [docs, setDocs] = useState<ExpertProofFile[]>([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<ExpertProofType | "LINK" | null>(null);
  const [loaded, setLoaded] = useState(false);

  const apply = (expert: Expert) => {
    setDocs(expert.verificationDocuments ?? []);
    setLink(expert.achievementProofLink ?? "");
  };

  useEffect(() => {
    expertApi
      .getMyProfile()
      .then((res) => {
        if (res.success && res.data) apply(res.data);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const fileFor = (type: ExpertProofType) => docs.find((d) => d.type === type);

  const upload = async (type: ExpertProofType, file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Upload a PDF, JPG or PNG file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("The file must be smaller than 8 MB.");
      return;
    }
    setBusy(type);
    try {
      const urlRes = await expertApi.getVerificationUploadUrl({
        fileName: file.name,
        contentType: file.type,
        documentType: type,
      });
      if (!urlRes.success || !urlRes.data) {
        throw new Error(urlRes.message || "Could not start the upload.");
      }
      const put = await fetch(urlRes.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("The upload failed. Try again.");

      const others = docs.filter((d) => d.type !== type);
      const res = await expertApi.saveVerificationProof({
        documents: [
          ...others.map((d) => ({ type: d.type, s3Key: d.s3Key, fileName: d.fileName })),
          { type, s3Key: urlRes.data.key, fileName: file.name },
        ],
      });
      if (!res.success || !res.data) throw new Error(res.message || "Could not save the file.");
      apply(res.data);
      toast.success("File saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const saveLink = async () => {
    setBusy("LINK");
    try {
      const res = await expertApi.saveVerificationProof({ achievementProofLink: link.trim() });
      if (!res.success || !res.data) throw new Error(res.message || "Could not save the link.");
      apply(res.data);
      toast.success(link.trim() ? "Link saved." : "Link removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the link.");
    } finally {
      setBusy(null);
    }
  };

  const row = (type: ExpertProofType, title: string, hint: string) => {
    const current = fileFor(type);
    return (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {busy === type ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {busy === type ? "Uploading" : current ? "Replace file" : "Upload file"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={busy !== null}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(type, file);
              }}
            />
          </label>
          {current && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {current.fileName}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">Proof for review</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Our team checks these before your profile goes live. They are never shown to parents.
        </p>
      </div>

      {row("ID_PROOF", "ID document", "A government ID. PDF, JPG or PNG, up to 8 MB.")}

      {row(
        "ACHIEVEMENT_PROOF",
        "Proof of your achievements",
        "A certificate, ranking sheet or federation record. Or give a link below instead."
      )}

      <div className="rounded-lg border border-slate-200 p-4">
        <label htmlFor="expert-proof-link" className="text-sm font-semibold text-slate-900">
          Link to a public record
        </label>
        <p className="mt-0.5 text-xs text-slate-500">
          A ranking page or federation profile that shows your achievements. Use this or a file.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id="expert-proof-link"
            type="url"
            inputMode="url"
            className={field}
            placeholder="https://"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void saveLink()}
            className="sm:w-auto"
          >
            {busy === "LINK" ? "Saving" : "Save link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
