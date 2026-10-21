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
      className="focus-within:ring-ink flex w-full items-center gap-2 rounded-lg bg-white p-1.5 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-transparent"
    >
      <Search className="text-ink-muted ml-2.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search questions and experiences"
        aria-label="Search questions and stories"
        className="text-ink placeholder:text-ink-muted min-w-0 flex-1 bg-transparent py-2.5 text-base focus:outline-none"
      />
      <button
        type="submit"
        className="btn-motion bg-power-orange-solid inline-flex min-h-10 shrink-0 items-center justify-center rounded-md px-5 text-base font-semibold text-white hover:bg-indigo-700"
      >
        Search
      </button>
    </form>
  );
}
