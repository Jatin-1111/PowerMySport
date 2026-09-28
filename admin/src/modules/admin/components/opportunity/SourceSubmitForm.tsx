"use client";

// ─── Read an entry from a link or a PDF ─────────────────────────────────────
//
// For a new entry, or (with `opportunitySlug`) to check an existing one
// against this year's document. Either way the result is a list of proposed
// changes for a person to accept or drop; nothing here touches a live entry.

import { toast } from "@/lib/toast";
import {
  opportunitySourceApi,
  type OpportunityTrack,
} from "@/modules/admin/services/opportunities";
import axios from "axios";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Field, TextInput } from "../pathway/fields";
import { readApiErrors } from "./apiErrors";
import { SPORT_OPTIONS } from "./opportunityForm";

const selectClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm";

export function SourceSubmitForm({
  opportunitySlug,
  defaultTrack = "scholarship",
  defaultUrl = "",
  defaultLabel = "",
  leadId,
  onCancel,
}: {
  /** The entry being checked. Omit to propose a new entry. */
  opportunitySlug?: string;
  defaultTrack?: OpportunityTrack;
  /** A link to start from, e.g. a source the weekly check flagged. */
  defaultUrl?: string;
  defaultLabel?: string;
  /** A lead from the monthly search: submitting marks it read. */
  leadId?: string;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [track, setTrack] = useState<OpportunityTrack>(defaultTrack);
  const [sportSlug, setSportSlug] = useState("tennis");
  const [kind, setKind] = useState<"LINK" | "PDF">("LINK");
  const [url, setUrl] = useState(defaultUrl);
  const [file, setFile] = useState<File | null>(null);
  const [originUrl, setOriginUrl] = useState("");
  const [label, setLabel] = useState(defaultLabel);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      let upload: { s3Key: string; fileName: string } | null = null;
      if (kind === "PDF") {
        if (!file) throw new Error("Choose the PDF first.");
        const res = await opportunitySourceApi.uploadUrl(file.name);
        if (!res.data) throw new Error(res.message || "Could not start the upload.");
        // Plain axios: this PUT goes straight to storage, not to our API.
        await axios.put(res.data.uploadUrl, file, { headers: { "Content-Type": file.type } });
        upload = { s3Key: res.data.key, fileName: res.data.fileName };
      }

      const res = await opportunitySourceApi.create({
        ...(opportunitySlug ? { opportunitySlug } : { track }),
        sportSlug,
        ...(leadId ? { leadId } : {}),
        sourceLabel: label.trim(),
        sourceKind: kind,
        ...(kind === "LINK"
          ? { sourceUrl: url.trim() }
          : { ...upload!, originUrl: originUrl.trim() }),
      });
      const id = res.data?._id;
      if (!id) throw new Error(res.message || "The source was not saved.");
      if (res.data?.status === "EXTRACTION_FAILED") {
        toast.error("It could not be read. The reason is on the next page.");
      } else {
        toast.success("Read. Review the proposed changes.");
      }
      router.push(`/admin/opportunities/sources/${id}`);
    } catch (error) {
      toast.error(
        error instanceof Error && !axios.isAxiosError(error)
          ? error.message
          : readApiErrors(error)[0]!
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {!opportunitySlug && (
          <Field label="Page">
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as OpportunityTrack)}
              className={selectClass}
            >
              <option value="admission">Admissions</option>
              <option value="scholarship">Scholarships</option>
            </select>
          </Field>
        )}
        <Field
          label="Sport it is being read for"
          hint="Only steers the reading; all-sports schemes stay all-sports."
        >
          <select
            value={sportSlug}
            onChange={(e) => setSportSlug(e.target.value)}
            className={selectClass}
          >
            {SPORT_OPTIONS.map((sport) => (
              <option key={sport.value} value={sport.value}>
                {sport.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="What is this document?"
        hint='Shown to parents as the source, e.g. "DU admissions bulletin 2026-27".'
      >
        <TextInput value={label} onChange={setLabel} />
      </Field>

      <div className="flex gap-2">
        {(["LINK", "PDF"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              kind === option ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700"
            }`}
          >
            {option === "LINK" ? "Link (page or PDF)" : "Upload a PDF"}
          </button>
        ))}
      </div>

      {kind === "LINK" ? (
        <Field label="Link">
          <TextInput value={url} onChange={setUrl} placeholder="https://" />
        </Field>
      ) : (
        <div className="space-y-3">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <Field
            label="Official page it came from"
            hint="Required: parents are linked here, never to the uploaded file."
          >
            <TextInput value={originUrl} onChange={setOriginUrl} placeholder="https://" />
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting || !label.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Reading… (up to a minute)" : "Read it"}
        </button>
      </div>
    </div>
  );
}
