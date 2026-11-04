"use client";

import {
  CHILD_HISTORY_LIMITS,
  CHILD_SHARE_LIFETIME_DAYS,
  type ChildHistoryView,
  type ChildShareSection,
} from "@powermysport/shared-types";
import { SharedProfile } from "@/modules/my-child/components/SharedProfile";
import { useChildShares, useSharePreview } from "@/modules/my-child/hooks/useChildShares";
import { childHistoryApi, type CreatedShare } from "@/modules/my-child/services/childHistory";
import { cvFileNameFor, saveBlob } from "@/modules/my-child/utils/saveFile";
import {
  choiceFrom,
  offeredSections,
  readyVideos,
  whatsappShareUrl,
} from "@/modules/my-child/utils/shareChoices";
import {
  SECTION_LABELS,
  formatEntryDate,
  formatBytes,
  formatDuration,
} from "@/modules/my-child/utils/format";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { useRef, useState } from "react";

type Step = "choose" | "check" | "done";

/**
 * Making a link for a coach, in two steps and a result.
 *
 *   1. Who it is for, and which sections and clips. Everything starts ticked, academics included.
 *   2. What the coach will see, exactly, and the notice the parent agrees to.
 *   3. The link, shown once.
 *
 * The notice is the approved draft in `docs/plans/my-child-consent-copy-draft-2026-10-29.md`.
 * Change it there first and raise `CHILD_SHARING_CONSENT_VERSION` on the server. A line about
 * the coach being able to ask for contact, and about a downloaded CV, is added with those
 * features, because the notice may state only what is live.
 *
 * The form is mounted only while the dialog is open, so each visit starts from the child's
 * current data, not from the last one.
 */
export function ShareDialog({
  isOpen,
  onClose,
  childId,
  history,
}: {
  isOpen: boolean;
  onClose: () => void;
  childId: string;
  history: ChildHistoryView;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share with a coach" size="xl">
      {isOpen && <ShareFlow childId={childId} history={history} onClose={onClose} />}
    </Modal>
  );
}

function ShareFlow({
  childId,
  history,
  onClose,
}: {
  childId: string;
  history: ChildHistoryView;
  onClose: () => void;
}) {
  const offered = offeredSections(history);
  const clips = readyVideos(history);

  const [step, setStep] = useState<Step>("choose");
  const [label, setLabel] = useState("");
  const [ticked, setTicked] = useState<ChildShareSection[]>(() => offered.map((o) => o.section));
  const [tickedClips, setTickedClips] = useState<string[]>(() => clips.map((clip) => clip.id));
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [savingPdf, setSavingPdf] = useState(false);

  const { create } = useChildShares(childId);
  const choice = choiceFrom(ticked, tickedClips);
  const preview = useSharePreview(childId, choice, step === "check");

  const toggle = (section: ChildShareSection) =>
    setTicked((previous) =>
      previous.includes(section) ? previous.filter((s) => s !== section) : [...previous, section]
    );
  const toggleClip = (id: string) =>
    setTickedClips((previous) =>
      previous.includes(id) ? previous.filter((c) => c !== id) : [...previous, id]
    );

  const next = () => {
    if (!label.trim()) return setError("Say who this link is for, for example Coach Miller.");
    if (choice.sections.length === 0) return setError("Tick at least one thing to share.");
    setError(null);
    setStep("check");
  };

  /** The parent's own copy of exactly this CV. It creates no link and reaches no one. */
  const downloadPdf = async () => {
    setSavingPdf(true);
    try {
      saveBlob(
        await childHistoryApi.downloadCv(childId, choice),
        cvFileNameFor(history.child.name)
      );
    } catch {
      toast.error("Could not make the PDF. Try again.");
    } finally {
      setSavingPdf(false);
    }
  };

  const make = async () => {
    try {
      const result = await create.mutateAsync({
        recipientLabel: label.trim(),
        ...choice,
        consent: true,
      });
      setCreated(result);
      setStep("done");
    } catch {
      // The mutation has already shown the server's message; the dialog stays on this step.
    }
  };

  if (step === "done" && created) {
    return <LinkMade created={created} childName={history.child.name} onClose={onClose} />;
  }

  if (step === "check") {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-ink text-sm font-medium">Step 2 of 2</p>
          <p className="text-ink-body mt-1 text-pretty text-sm">
            This is what the coach will see. Go back to untick anything you want to keep private.
          </p>
        </div>

        <div className="border-hairline bg-paper-deep max-h-[50vh] overflow-y-auto rounded-xl border p-3 sm:p-4">
          {preview.isPending && <Skeleton className="h-48 w-full rounded-xl" />}
          {preview.isError && (
            <p role="alert" className="text-ink-body p-3">
              The preview could not be loaded. Go back and try again.
            </p>
          )}
          {preview.data && <SharedProfile view={preview.data} preview />}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            loading={savingPdf}
            disabled={!preview.data}
            onClick={downloadPdf}
          >
            Download as PDF
          </Button>
          <p className="text-ink-body text-sm">
            Your own copy of this CV. It does not make a link or send anything.
          </p>
        </div>

        <section aria-labelledby="share-notice" className="space-y-3">
          <h3 id="share-notice" className="font-editorial text-ink text-xl font-light">
            Before you create this link
          </h3>
          <ul className="text-ink-body list-disc space-y-2 text-pretty pl-5">
            <li>
              Anyone with this link can see the sections shown above until the link expires on{" "}
              {preview.data
                ? formatEntryDate(preview.data.expiresAt, "day")
                : `${CHILD_SHARE_LIFETIME_DAYS} days from today`}{" "}
              or you stop sharing. That includes {history.child.name}, results, academics and
              videos, if those sections are ticked.
            </li>
            <li>
              The coach can ask to contact you. Your email is never shown to them, and you choose
              whether to reply.
            </li>
            <li>PowerMySport does not check what you have entered.</li>
            <li>
              You can stop sharing at any time and the link stops working straight away. A coach who
              has already downloaded the CV or a clip keeps that copy, and we cannot take it back.
            </li>
            <li>
              We count how many times the link is opened. We do not track the coach in any other
              way.
            </li>
          </ul>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span className="text-ink text-pretty">
              I am this child&apos;s parent or legal guardian, and I choose to share this
              information with the person I send the link to.
            </span>
          </label>
        </section>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setStep("choose")}
          >
            Back
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={!agreed || !preview.data}
            loading={create.isPending}
            onClick={make}
          >
            Create link
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-ink text-sm font-medium">Step 1 of 2</p>

      <div>
        <label htmlFor="share-label" className="text-ink mb-1.5 block text-sm font-medium">
          Who is this link for
        </label>
        <Input
          id="share-label"
          value={label}
          maxLength={CHILD_HISTORY_LIMITS.shareLabelChars}
          placeholder="Coach Miller, State University"
          onChange={(event) => setLabel(event.target.value)}
        />
        <p className="text-ink-muted mt-1.5 text-sm">
          Only you see this. It helps you tell your links apart.
        </p>
      </div>

      <fieldset>
        <legend className="text-ink mb-2 text-sm font-medium">What the coach can see</legend>
        {offered.length === 0 ? (
          <p className="text-ink-body text-sm">
            Nothing has been added yet. Add a result, school details or a video first.
          </p>
        ) : (
          <ul className="space-y-1">
            {offered.map(({ section, count }) => (
              <li key={section}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ticked.includes(section)}
                    onChange={() => toggle(section)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="text-ink">
                    {SECTION_LABELS[section]}{" "}
                    <span className="text-ink-body tabular-nums">({count})</span>
                  </span>
                </label>
                {section === "videos" && ticked.includes("videos") && clips.length > 1 && (
                  <ul className="mb-2 ml-8 space-y-1">
                    {clips.map((clip) => (
                      <li key={clip.id}>
                        <label className="flex min-h-11 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={tickedClips.includes(clip.id)}
                            onChange={() => toggleClip(clip.id)}
                            className="h-5 w-5 shrink-0"
                          />
                          <span className="text-ink-body">
                            {clip.title ?? "Video"}
                            {clip.durationSeconds !== undefined && (
                              <span className="tabular-nums">
                                {" "}
                                · {formatDuration(clip.durationSeconds)}
                              </span>
                            )}
                            {clip.sizeBytes ? (
                              <span className="tabular-nums"> · {formatBytes(clip.sizeBytes)}</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" className="min-h-11" onClick={next} disabled={offered.length === 0}>
          Next
        </Button>
      </div>
    </div>
  );
}

function LinkMade({
  created,
  childName,
  onClose,
}: {
  created: CreatedShare;
  childName: string;
  onClose: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(created.url);
      toast.success("Link copied.");
    } catch {
      // Some browsers refuse the clipboard outside a secure page. Selecting the text lets the
      // parent copy it themselves.
      field.current?.select();
      toast.error("Could not copy. The link is selected, so you can copy it yourself.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-editorial text-ink text-2xl font-light">Link created</h3>
        <p className="text-ink-body mt-1 text-pretty">
          It is for {created.share.recipientLabel} and works until{" "}
          {formatEntryDate(created.share.expiresAt, "day")}.
        </p>
      </div>

      <div>
        <label htmlFor="share-link" className="text-ink mb-1.5 block text-sm font-medium">
          The link
        </label>
        <Input
          id="share-link"
          ref={field}
          readOnly
          value={created.url}
          onFocus={(e) => e.target.select()}
        />
      </div>

      <p className="text-ink-body text-pretty text-sm">
        This link is shown once. Copy it or send it now. You can stop it at any time from the list.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="min-h-11" onClick={copy}>
          Copy link
        </Button>
        <a
          href={whatsappShareUrl(childName, created.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="border-hairline text-ink hover:bg-paper-deep inline-flex min-h-11 items-center justify-center rounded-lg border px-6 text-base font-semibold"
        >
          Send on WhatsApp
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <Button type="button" variant="outline" className="min-h-11 sm:ml-auto" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
