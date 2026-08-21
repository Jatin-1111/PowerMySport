"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, Newspaper, Search } from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import { CommunitySearchItem } from "@/modules/community/types";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { useDebouncedSearch } from "@/lib/hooks";
import { toast } from "@/lib/toast";

type SearchScope = "ALL" | "POST" | "BLOG";

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "ALL", label: "Everything" },
  { value: "POST", label: "Questions" },
  { value: "BLOG", label: "Stories" },
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
    (searchParams.get("type") as SearchScope) || "ALL",
  );

  // The shared hook already debounces, enforces the two-character floor and
  // aborts superseded requests, so typing fast cannot land an older response
  // on top of a newer one.
  const searchFn = useCallback(
    async (term: string): Promise<CommunitySearchItem[]> => {
      const result = await communityService.search(term, scope);
      return result.items;
    },
    [scope],
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
          subtitle="Find questions and stories across the community."
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
              placeholder="Search questions and stories..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-power-orange focus:outline-none"
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
          <div className="community-card">
            <p className="text-sm text-slate-500">Searching...</p>
          </div>
        ) : displayQuery.length >= 2 && items.length === 0 ? (
          <div className="community-card text-center">
            <p className="text-sm font-semibold text-slate-700">
              Nothing found for &ldquo;{displayQuery}&rdquo;
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try fewer words, or ask the community directly.
            </p>
            <Link
              href="/questions"
              className="mt-3 inline-flex rounded-lg bg-power-orange px-3 py-2 text-sm font-semibold text-white"
            >
              Ask a question
            </Link>
          </div>
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={item.href}
                className="block rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-power-orange/40 hover:shadow-sm"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      item.kind === "POST"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}
                  >
                    {item.kind === "POST" ? (
                      <>
                        <MessageCircle size={11} /> Question
                      </>
                    ) : (
                      <>
                        <Newspaper size={11} /> Story
                      </>
                    )}
                  </span>
                  {item.isSolved ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                      <CheckCircle2 size={11} /> Solved
                    </span>
                  ) : null}
                  {item.sport ? (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {item.sport}
                    </span>
                  ) : null}
                </div>

                <p className="text-sm font-semibold text-slate-900">
                  {item.title}
                </p>
                {item.snippet ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                    {item.snippet}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="community-card">
            <p className="text-sm text-slate-500">
              Type at least two characters to search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
