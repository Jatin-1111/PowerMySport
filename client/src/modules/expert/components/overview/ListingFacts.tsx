import type { Expert } from "@/modules/expert/services/expert";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { formatRupees } from "@/modules/shared/utils/figures";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const MODE: Record<Expert["sessionMode"], string> = {
  ONLINE: "Online",
  IN_PERSON: "In person",
  BOTH: "Online and in person",
};

/** Facts about the expert's listing, as a ruled definition list. */
export function ListingFacts({ expert, days }: { expert: Expert; days: number }) {
  const rows: Array<{ label: string; value: string }> = [
    { label: "Sports", value: expert.sports.join(", ") || "None listed" },
    { label: "Session fee", value: formatRupees(expert.sessionFee) },
    { label: "Session length", value: `${expert.sessionDurationMinutes ?? 60} minutes` },
    { label: "How you hold sessions", value: MODE[expert.sessionMode] },
    { label: "Open days", value: days > 0 ? `${days} a week` : "None set" },
  ];

  return (
    <section aria-labelledby="listing-heading">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="listing-heading" className="text-ink text-base font-semibold">
          Your listing
        </h2>
        <Link href="/expert/profile" className={`${TEXT_LINK} ring-offset-paper text-sm`}>
          Edit profile
          <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </div>

      <dl className="border-hairline mt-4 border-t">
        {rows.map((row) => (
          <div
            key={row.label}
            className="border-hairline flex items-baseline justify-between gap-6 border-b py-3.5"
          >
            <dt className="text-ink-body">{row.label}</dt>
            <dd className="text-ink text-right font-medium tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
