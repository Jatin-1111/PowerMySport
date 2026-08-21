"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

/**
 * Search, as the hero's primary way in.
 *
 * This replaces a "Search" entry in the top nav. A nav link only ever offers
 * an empty results page; a field in the hero lets someone start with the thing
 * they actually came to find out, which is the point of a question-and-answer
 * community.
 *
 * The heavy lifting stays on /search — debouncing, scope tabs, the two-character
 * floor. This only hands over the first query.
 */
export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    // An empty submit still opens search rather than doing nothing, so the
    // button never feels broken.
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      className="mx-auto mt-6 flex w-full max-w-xl items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm focus-within:border-power-orange/50 focus-within:ring-4 focus-within:ring-power-orange/10"
    >
      <Search
        className="ml-2 h-4 w-4 shrink-0 text-slate-400"
        aria-hidden="true"
      />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search questions and stories..."
        aria-label="Search questions and stories"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />
      <button
        type="submit"
        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-xl bg-power-orange px-4 text-sm font-semibold text-white transition hover:bg-power-orange/90"
      >
        Search
      </button>
    </form>
  );
}
