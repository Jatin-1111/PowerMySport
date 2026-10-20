"use client";

import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Button } from "@/modules/shared/ui/Button";
import { WhatsAppIcon } from "@/modules/shared/ui/WhatsAppIcon";
import React, { useId, useState } from "react";

const DEFAULT_MESSAGE =
  "Hi! I found PowerMySport and would like help with my child's sports journey.";

const AGES = Array.from({ length: 13 }, (_, i) => i + 5);
const SPORTS = [
  "Tennis",
  "Badminton",
  "Cricket",
  "Football",
  "Chess",
  "Swimming",
  "Athletics",
  "Another sport",
];

const FIELD =
  "border-ink/20 bg-paper text-ink focus-visible:border-ink/60 focus-visible:ring-ink h-12 w-full rounded-lg border px-3 text-base focus-visible:outline-none focus-visible:ring-1";

/** What the parent picked, as the first WhatsApp message. Nothing picked sends the usual greeting. */
function buildMessage(age: string, sport: string): string {
  if (!age && !sport) return DEFAULT_MESSAGE;
  const who = age ? `My child is ${age}` : "I have a child";
  const what =
    sport === "NOT_SURE"
      ? "and we are not sure which sport suits them"
      : sport
        ? `and we are looking at ${sport.toLowerCase()}`
        : "";
  return `Hi! ${who} ${what}`.trim() + ". I would like help with their sports journey.";
}

/** Two optional questions, then one action. Each answer is context the team would otherwise ask for. */
export function HeroChooserCard() {
  const [age, setAge] = useState("");
  const [sport, setSport] = useState("");
  // The card can be mounted twice (one copy hidden by CSS per breakpoint), so ids must be unique.
  const uid = useId();
  const ageId = `${uid}-age`;
  const sportId = `${uid}-sport`;

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    window.open(buildWhatsAppUrl(buildMessage(age, sport)), "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={onSubmit} className="p-5 sm:p-6">
      <p className="text-ink text-base font-semibold">Tell us a little first</p>
      <p className="text-ink-muted mt-0.5 text-sm">Both are optional.</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={ageId} className="text-ink-muted mb-1.5 block text-sm">
            Child&apos;s age
          </label>
          <select
            id={ageId}
            value={age}
            onChange={(event) => setAge(event.target.value)}
            className={FIELD}
          >
            <option value="">Any age</option>
            {AGES.map((value) => (
              <option key={value} value={value}>
                {value} years
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={sportId} className="text-ink-muted mb-1.5 block text-sm">
            Sport
          </label>
          <select
            id={sportId}
            value={sport}
            onChange={(event) => setSport(event.target.value)}
            className={FIELD}
          >
            <option value="">Choose</option>
            <option value="NOT_SURE">Not sure yet</option>
            {SPORTS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="mt-4 h-auto w-full px-6 py-3.5 text-base"
      >
        <WhatsAppIcon className="h-5 w-5 shrink-0" />
        Talk to PMS
      </Button>
    </form>
  );
}
