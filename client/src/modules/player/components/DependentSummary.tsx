"use client";

import { ProfileCompletionRing } from "@/modules/player/components/ProfileCompletionRing";
import { formatDependentRelation } from "@/modules/player/data/dependentRelations";
import { roadmapHref } from "@/modules/pathway/data/sports";
import { Button } from "@/modules/shared/ui/Button";
import { ArrowRight, Edit2 } from "lucide-react";
import Link from "next/link";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

interface DependentSummaryProps {
  name: string;
  relation?: string;
  age: number | null;
  sport?: string;
  completionPercent: number;
  onEdit: () => void;
}

/**
 * Who this is, in one block: the name, a single line saying who they are and what they play, and
 * the way into the sport's roadmap. Everything else a parent might look up is further down.
 */
export function DependentSummary({
  name,
  relation,
  age,
  sport,
  completionPercent,
  onEdit,
}: DependentSummaryProps) {
  const line = [
    relation ? formatDependentRelation(relation) : null,
    age !== null ? `${age} years old` : null,
    sport ? `plays ${sport}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-center gap-5">
        <ProfileCompletionRing
          percent={completionPercent}
          size={72}
          strokeWidth={3}
          title={`${name}'s profile is ${completionPercent}% complete`}
        >
          <div className="bg-paper-deep text-ink flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold">
            {getInitials(name)}
          </div>
        </ProfileCompletionRing>
        <div className="min-w-0">
          <h1 className="font-editorial text-ink text-balance text-4xl font-light leading-tight tracking-tight sm:text-5xl">
            {name}
          </h1>
          {line && <p className="text-ink-body mt-1 text-pretty">{line}</p>}
          {sport && (
            <Link
              href={roadmapHref(sport)}
              className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-h-0"
            >
              See the {sport} roadmap
              <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
      <Button
        onClick={onEdit}
        variant="outline"
        icon={<Edit2 size={16} strokeWidth={1.5} />}
        className="min-h-11 shrink-0 self-start"
      >
        Edit profile
      </Button>
    </header>
  );
}
