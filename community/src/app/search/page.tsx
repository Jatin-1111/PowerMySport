"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunitySearchItem } from "@/modules/community/types";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { useDebouncedSearch } from "@/lib/hooks";
import { toast } from "@/lib/toast";

type SearchScope = "ALL" | "POST" | "BLOG";

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "ALL", label: "Everything" },
  { value: "POST", label: "Questions" },
  { value: "BLOG", label: "Experiences" },
];

export default function CommunitySearchPage() {
  return (
    <Suspense
      fallback={
        <div className="community-page-shell">
          <div className="community-content-wrap">
            <p className="text-sm text-slate-500">Loading search...</p>
          </div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [scope, setScope] = useState<SearchScope>(
    (searchParams.get("type") as SearchScope) || "ALL"
  );

  // The shared hook already debounces, enforces the two-character floor and
  // aborts superseded requests, so typing fast cannot land an older response
  // on top of a newer one.
  const searchFn = useCallback(
    async (term: string): Promise<CommunitySearchItem[]> => {
      const result = await communityService.search(term, scope);
      return result.items;
    },
    [scope]
  );

  const { query, setQuery, displayQuery, results, isSearching, error } =
    useDebouncedSearch<CommunitySearchItem>(searchFn);

  const items = results;

  // Seed from the URL so a shared link runs its own search.
  useEffect(() => {
    const initial = searchParams.get("q") || "";
    if (initial) {
      setQuery(initial);
    }
    // Deliberately once, on mount: afterwards the input owns the query and
    // re-reading the URL would fight the user's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Search failed");
    }
  }, [error]);

  // Keeps the URL shareable without pushing a history entry per keystroke.
  useEffect(() => {
    const params = new URLSearchParams();
    if (displayQuery.trim()) params.set("q", displayQuery.trim());
    if (scope !== "ALL") params.set("type", scope);
    const search = params.toString();
    router.replace(search ? `/search?${search}` : "/search", { scroll: false });
  }, [displayQuery, scope, router]);

  return (
    <div className="community-page-shell">
      <div className="community-content-wrap space-y-4">
        <CommunityPageHeader
          title="Search"
          subtitle="Find questions and experiences across the community."
          badge="Search"
        />

        <div className="community-card space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Search questions and experiences..."
              className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {SCOPES.map((option) => (
              <button
                key={option.value}
                onClick={() => setScope(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  scope === option.value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isSearching ? (
          <div aria-busy="true" aria-label="Searching" className="border-hairline mt-8 border-t">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-hairline space-y-3 border-b py-6">
                <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                <div className="bg-ink/10 h-6 w-2/3 animate-pulse rounded-sm" />
              </div>
            ))}
          </div>
        ) : displayQuery.length >= 2 && items.length === 0 ? (
          <div className="bg-paper-deep mt-8 rounded-2xl px-6 py-14 text-center">
            <p className="font-editorial text-ink text-3xl font-light">
              Nothing found for &ldquo;{displayQuery}&rdquo;.
            </p>
            <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
              Try fewer words, or ask the community directly.
            </p>
            <Link
              href="/questions"
              className="btn-motion bg-power-orange-solid mt-6 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
            >
              Ask a question
            </Link>
          </div>
        ) : items.length > 0 ? (
          <ul className="border-hairline mt-8 border-t">
            {items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="border-hairline border-b">
                <Link
                  href={item.href}
                  className="hover:bg-paper-deep/60 group -mx-3 block px-3 py-6 transition-colors duration-200"
                >
                  <p className="text-ink-muted text-sm">
                    {item.kind === "POST" ? "Question" : "Experience"}
                    {item.sport ? ` · ${item.sport}` : ""}
                    {item.isSolved ? (
                      <span className="font-semibold text-green-800"> · Solved</span>
                    ) : null}
                  </p>
                  <p className="font-editorial text-ink decoration-ink/30 mt-1 text-2xl font-normal leading-tight underline-offset-4 group-hover:underline">
                    {item.title}
                  </p>
                  {item.snippet ? (
                    <p className="text-ink-body mt-2 line-clamp-2 max-w-[64ch] text-base leading-relaxed">
                      {item.snippet}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-body mt-8 text-base">Type at least two characters to search.</p>
        )}
      </div>
    </div>
  );
}
