"use client";

import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/modules/shared/ui/Button";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import React, { useState } from "react";

const DEFAULT_MESSAGE =
  "Hi! I found PowerMySport and would like help with my child's sports journey.";

/**
 * One field and one action. What the parent types opens WhatsApp as the first
 * message; left empty, the usual greeting is sent. No field is required, so the
 * button never says no.
 */
export function HeroAskField() {
  const [text, setText] = useState("");

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const typed = text.trim();
    window.open(
      buildWhatsAppUrl(typed ? `Hi! ${typed}` : DEFAULT_MESSAGE),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <form
      onSubmit={onSubmit}
      className="border-ink/20 bg-paper focus-within:border-ink/50 flex w-full flex-col gap-2 rounded-xl border p-2 transition-colors duration-200 sm:flex-row sm:items-center"
    >
      <label htmlFor="hero-ask" className="sr-only">
        What would you like help with?
      </label>
      <input
        id="hero-ask"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={300}
        autoComplete="off"
        placeholder="Which sport is right for my 8-year-old?"
        className="text-ink placeholder:text-ink-muted min-w-0 flex-1 bg-transparent px-3 py-3 text-base focus:outline-none"
      />
      <Button type="submit" variant="primary" size="lg" className="h-auto px-6 py-3 text-base">
        <WhatsAppIcon className="h-5 w-5 shrink-0" />
        Talk to PMS
      </Button>
    </form>
  );
}
