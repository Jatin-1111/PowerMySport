"use client";

import {
  expertApi,
  type Expert,
  type ExpertProofFile,
  type ExpertProofType,
} from "@/modules/expert/services/expert";
import { FIELD_INPUT } from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { cn } from "@/utils/cn";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 8 * 1024 * 1024;

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
      <div className="border-hairline border-t py-5">
        <p className="text-ink font-medium">{title}</p>
        <p className="text-ink-body mt-0.5 text-sm">{hint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <label
            className={`${TEXT_LINK} focus-within:ring-ink ring-offset-paper min-h-11 cursor-pointer text-sm focus-within:ring-2 focus-within:ring-offset-2`}
          >
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
            <span className="text-ink-body inline-flex items-center gap-1.5 text-sm">
              <Check size={16} strokeWidth={1.5} className="text-green-800" aria-hidden="true" />
              {current.fileName}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (!loaded) return null;

  return (
    <div className="pt-2">
      <div>
        <h3 className="text-ink font-medium">Proof for review</h3>
        <p className="text-ink-body mt-0.5 max-w-[56ch] text-pretty text-sm">
          Our team checks these before your profile goes live. They are never shown to parents.
        </p>
      </div>

      <div className="mt-4">
        {row("ID_PROOF", "ID document", "A government ID. PDF, JPG or PNG, up to 8 MB.")}

        {row(
          "ACHIEVEMENT_PROOF",
          "Proof of your achievements",
          "A certificate, ranking sheet or federation record. Or give a link below instead."
        )}

        <div className="border-hairline border-t py-5">
          <label htmlFor="expert-proof-link" className="text-ink font-medium">
            Link to a public record
          </label>
          <p className="text-ink-body mt-0.5 text-sm">
            A ranking page or federation profile that shows your achievements. Use this or a file.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              id="expert-proof-link"
              type="url"
              inputMode="url"
              className={cn(FIELD_INPUT, "sm:max-w-md")}
              placeholder="https://"
              value={link}
              onChange={(event) => setLink(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void saveLink()}
              className="min-h-11 sm:w-auto"
            >
              {busy === "LINK" ? "Saving" : "Save link"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
