"use client";

import { CHILD_HISTORY_LIMITS } from "@powermysport/shared-types";
import { sendContactRequest } from "@/modules/my-child/services/sharedProfile";
import { Button } from "@/modules/shared/ui/Button";
import { Input } from "@/modules/shared/ui/Input";
import { Modal } from "@/modules/shared/ui/Modal";
import { Textarea } from "@/modules/shared/ui/Textarea";
import { useState } from "react";

/**
 * A coach asking the family behind a link to get in touch.
 *
 * What the coach types goes to the family through PowerMySport; the family's own address is never
 * shown. The notice above the form is the approved wording in
 * `docs/plans/my-child-consent-copy-draft-2026-10-29.md` (section C): it tells the coach what
 * happens to their name and email, because a coach is a person whose details we are about to
 * keep, and they should be told before they type them.
 */
export function ContactRequestDialog({
  isOpen,
  onClose,
  token,
}: {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ask the family to get in touch" size="md">
      {isOpen && <ContactForm token={token} onClose={onClose} />}
    </Modal>
  );
}

function ContactForm({ token, onClose }: { token: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setError("Add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("That email address does not look right.");
    }
    setError(null);
    setSending(true);
    const result = await sendContactRequest(token, {
      name: name.trim(),
      email: email.trim(),
      ...(message.trim() ? { message: message.trim() } : {}),
    });
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  };

  if (sent) {
    return (
      <div className="space-y-5">
        <p role="status" className="font-editorial text-ink text-2xl font-light">
          Sent to the family.
        </p>
        <p className="text-ink-body text-pretty">
          They will decide whether to reply, and will write to the email address you gave.
        </p>
        <div className="flex justify-end">
          <Button type="button" className="min-h-11" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <p className="text-ink-body text-pretty text-sm">
        Your message goes to the family through PowerMySport. Your name and email are shared with
        them and deleted from our records after 90 days.
      </p>

      <div>
        <label htmlFor="contact-name" className="text-ink mb-1.5 block text-sm font-medium">
          Your name
        </label>
        <Input
          id="contact-name"
          autoComplete="name"
          value={name}
          maxLength={CHILD_HISTORY_LIMITS.contactNameChars}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="text-ink mb-1.5 block text-sm font-medium">
          Your email
        </label>
        <Input
          id="contact-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="text-ink mb-1.5 block text-sm font-medium">
          Message <span className="text-ink-muted font-normal">(optional)</span>
        </label>
        <Textarea
          id="contact-message"
          rows={4}
          value={message}
          maxLength={CHILD_HISTORY_LIMITS.contactMessageChars}
          onChange={(event) => setMessage(event.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11" loading={sending}>
          Send request
        </Button>
      </div>
    </form>
  );
}
