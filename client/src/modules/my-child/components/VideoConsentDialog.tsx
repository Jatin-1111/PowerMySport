"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { useState } from "react";

/**
 * The notice a parent agrees to before the first clip is stored. The words are the approved
 * draft in `docs/plans/my-child-consent-copy-draft-2026-10-29.md`; change them there first, and
 * raise `CHILD_VIDEO_CONSENT_VERSION` on the server so every parent is asked again.
 *
 * The box starts unticked and nothing is recorded until it is ticked and the button pressed.
 * "Agree and choose a video" is one press so the file picker opens inside the click: a browser
 * only opens a picker for a click, not for something that happens after a network call.
 */
export function VideoConsentDialog({
  isOpen,
  onClose,
  onAgree,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Before you add a video" size="md">
      {isOpen && <Notice onClose={onClose} onAgree={onAgree} />}
    </Modal>
  );
}

function Notice({ onClose, onAgree }: { onClose: () => void; onAgree: () => void }) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="space-y-5">
      <ul className="text-ink-body list-disc space-y-2 text-pretty pl-5">
        <li>
          Videos of your child are stored privately by PowerMySport. They are shown only on links
          you create.
        </li>
        <li>A video is removed when you delete it, delete this profile or delete your account.</li>
        <li>We do not use AI to analyse your videos.</li>
        <li>
          You can delete a video at any time. A coach who has already downloaded a clip keeps that
          copy.
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
          I am this child&apos;s parent or legal guardian, and I agree to PowerMySport storing this
          video.
        </span>
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" className="min-h-11" disabled={!agreed} onClick={onAgree}>
          Agree and choose a video
        </Button>
      </div>
    </div>
  );
}
