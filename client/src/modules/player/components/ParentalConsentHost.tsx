"use client";

import { Button } from "@/modules/shared/ui/Button";
import { Checkbox } from "@/modules/shared/ui/Checkbox";
import { Modal } from "@/modules/shared/ui/Modal";
import { useState } from "react";
import { PARENTAL_CONSENT_COPY as COPY } from "../data/parentalConsentCopy";
import { useParentalConsentStore } from "../store/parentalConsentStore";

/**
 * The one consent dialog. Mounted once in the root layout and opened by
 * `requestParentalConsent()`, so every place that adds a child (the quick add,
 * the assessment, "I know my sport") asks the same question the same way.
 */
export function ParentalConsentHost() {
  const pending = useParentalConsentStore((s) => s.pending);
  const settle = useParentalConsentStore((s) => s.settle);

  // Mounted only while a question is open, so the box starts unticked every time.
  return pending ? <ConsentDialog onSettle={settle} /> : null;
}

function ConsentDialog({ onSettle }: { onSettle: (agreed: boolean) => void }) {
  const [ticked, setTicked] = useState(false);

  return (
    <Modal
      isOpen
      onClose={() => onSettle(false)}
      title={COPY.title}
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => onSettle(false)}>
            {COPY.cancel}
          </Button>
          <Button type="button" disabled={!ticked} onClick={() => onSettle(true)}>
            {COPY.agree}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm text-slate-600">
        <p>{COPY.intro}</p>
        <p>{COPY.sharing}</p>
        <label className="flex cursor-pointer items-start gap-3 text-slate-800">
          <Checkbox
            checked={ticked}
            onCheckedChange={setTicked}
            className="mt-0.5"
            aria-describedby="parental-consent-policy"
          />
          <span id="parental-consent-policy">
            {COPY.checkbox}{" "}
            <a
              href={COPY.policyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-power-orange-solid underline underline-offset-2"
            >
              {COPY.policyLinkLabel}
            </a>
            .
          </span>
        </label>
      </div>
    </Modal>
  );
}
