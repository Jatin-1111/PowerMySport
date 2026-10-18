"use client";

import { FilterBar, type ActiveFilter } from "@/modules/discovery/components/FilterBar";
import {
  LISTING_FALLBACK_CLASS,
  LISTING_IMAGE_CLASS,
  ListingCard,
  ListingCardSkeleton,
} from "@/modules/discovery/components/ListingCard";
import { expertApi, type Expert } from "@/modules/expert/services/expert";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { StaggerContainer, StaggerItem } from "@/modules/shared/ui/motion/StaggerContainer";
import { cn } from "@/utils/cn";
import { Search, ServerCrash } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const normalize = (v: string) => v.toLocaleLowerCase().trim().replace(/\s+/g, " ");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const MODE_OPTIONS = ["ALL", "ONLINE", "IN_PERSON", "BOTH"];
const MIN_RATING_OPTIONS = ["0", "3", "4", "4.5"];
const SORT_OPTIONS = ["relevance", "priceAsc", "priceDesc", "ratingDesc"];

const modeLabel = (mode: Expert["sessionMode"]) =>
  mode === "BOTH" ? "Online or in-person" : mode === "ONLINE" ? "Online" : "In-person";

function ExpertAvatar({ expert, className }: { expert: Expert; className: string }) {
  const [failed, setFailed] = useState(false);
  const initial = (expert.name || "E").charAt(0).toUpperCase();
  if (!expert.photoUrl || failed) {
    return <div className={cn(LISTING_FALLBACK_CLASS, className)}>{initial}</div>;
  }
  return (
    <img
      src={expert.photoUrl}
      alt={expert.name || "Expert"}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function ExpertCardSkeleton() {
  return <ListingCardSkeleton shape="portrait" />;
}

/**
 * Expert discovery — filters, sorting and the result grid.
 *
 * Shared by both entry points so they cannot drift: `/experts` renders it under
 * its own SEO hero with a server-fetched list, and the `/booking` Experts tab
 * renders it bare and fetches on mount. Everything a caller owns (hero, page
 * chrome, background) lives outside this component.
 */
export function ExpertsTab({
  initialExperts,
  initialError = null,
}: {
  /** Server-rendered list. Omit it to fetch client-side instead. */
  initialExperts?: Expert[];
  initialError?: string | null;
}) {
  const [experts, setExperts] = useState<Expert[]>(initialExperts ?? []);
  const [loading, setLoading] = useState(!initialExperts);
  const [error, setError] = useState<string | null>(initialError);

  const loadExperts = useCallback(async () => {
    try {
      const res = await expertApi.listExperts({ limit: 60 });
      if (res.success && res.data) setExperts(res.data);
      else setError(res.message || "Failed to load experts.");
    } catch {
      setError("Failed to load experts.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Resetting the flags belongs here rather than inside loadExperts: on mount
  // `loading` already starts true, and only a retry needs them cleared.
  const retryLoad = useCallback(() => {
    setLoading(true);
    setError(null);
    void loadExperts();
  }, [loadExperts]);

  // Only the tab fetches. `/experts` already has its list from the server, and
  // re-fetching there would flash a skeleton over content that is already good.
  useEffect(() => {
    if (initialExperts) return;
    void loadExperts();
  }, [initialExperts, loadExperts]);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [maxFee, setMaxFee] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const hasHydratedRef = useRef(false);

  // Hydrate filters from the URL (?sport=, ?mode=, etc.) once on mount.
  // Reads window.location directly (instead of useSearchParams()) so this
  // component doesn't force a Suspense/CSR-bailout boundary in the parent —
  // that boundary was rendering with zero height and popping in later,
  // causing a layout shift once the real content mounted.
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
    const searchParams = new URLSearchParams(window.location.search);
    const sport = searchParams.get("sport") || searchParams.get("q") || "";
    setSearchInput(sport);
    setAppliedSearch(normalize(sport));
    const mode = searchParams.get("mode") || "ALL";
    if (MODE_OPTIONS.includes(mode)) setModeFilter(mode);
    const mr = searchParams.get("maxFee") || "";
    if (mr && Number.isFinite(Number(mr))) setMaxFee(mr);
    const minR = searchParams.get("minRating") || "0";
    if (MIN_RATING_OPTIONS.includes(minR)) setMinRating(minR);
    const sort = searchParams.get("sort") || "relevance";
    if (SORT_OPTIONS.includes(sort)) setSortBy(sort);
  }, []);

  const filtered = useMemo(() => {
    const term = appliedSearch;
    const parsedMax = maxFee ? Number(maxFee) : undefined;
    const parsedRating = Number(minRating || 0);

    let next = experts.filter((e) => {
      const haystack = normalize(
        [
          e.name || "",
          e.bio || "",
          (e.sports || []).join(" "),
          (e.expertise || []).join(" "),
          e.city || "",
        ].join(" ")
      );
      const matchSearch = !term || haystack.includes(term);
      const matchMode = modeFilter === "ALL" || e.sessionMode === modeFilter;
      const matchFee =
        parsedMax === undefined || isNaN(parsedMax) || Number(e.sessionFee || 0) <= parsedMax;
      const matchRating = (e.rating || 0) >= parsedRating;
      return matchSearch && matchMode && matchFee && matchRating;
    });

    const relevance = (e: Expert) => {
      const rating = clamp01((e.rating || 0) / 5);
      const reviews = clamp01((e.reviewCount || 0) / 40);
      let match = 0;
      if (term) {
        if ((e.sports || []).some((s) => normalize(s) === term)) match = 1;
        else if (normalize(e.name || "").includes(term)) match = 0.7;
        else if ((e.expertise || []).some((s) => normalize(s).includes(term))) match = 0.5;
      }
      return rating * 0.55 + reviews * 0.2 + match * 0.25;
    };

    if (sortBy === "priceAsc")
      next = [...next].sort((a, b) => (a.sessionFee || 0) - (b.sessionFee || 0));
    else if (sortBy === "priceDesc")
      next = [...next].sort((a, b) => (b.sessionFee || 0) - (a.sessionFee || 0));
    else if (sortBy === "ratingDesc")
      next = [...next].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    else next = [...next].sort((a, b) => relevance(b) - relevance(a));

    return next;
  }, [experts, appliedSearch, modeFilter, maxFee, minRating, sortBy]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(normalize(searchInput));
  };

  const handleClear = () => {
    setSearchInput("");
    setAppliedSearch("");
    setModeFilter("ALL");
    setMaxFee("");
    setMinRating("0");
    setSortBy("relevance");
  };

  const activeFilters: ActiveFilter[] = [];
  if (modeFilter !== "ALL")
    activeFilters.push({
      id: "mode",
      label: modeLabel(modeFilter as Expert["sessionMode"]),
      onRemove: () => setModeFilter("ALL"),
    });
  if (maxFee)
    activeFilters.push({
      id: "fee",
      label: `Max ${formatInr(Number(maxFee))}`,
      onRemove: () => setMaxFee(""),
    });
  if (Number(minRating) > 0)
    activeFilters.push({
      id: "rating",
      label: `${minRating}+ ★`,
      onRemove: () => setMinRating("0"),
    });
  if (sortBy !== "relevance")
    activeFilters.push({
      id: "sort",
      label: `Sort: ${
        sortBy === "priceAsc" ? "Fee ↑" : sortBy === "priceDesc" ? "Fee ↓" : "Top rated"
      }`,
      onRemove: () => setSortBy("relevance"),
    });

  const hasFilters = activeFilters.length > 0 || appliedSearch !== "";

  return (
    <div>
      {/* ── Filters ──────────────────────────────────────────────── */}
      <FilterBar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search by name, sport, or expertise…"
        onSearchClear={() => setSearchInput("")}
        onSubmit={handleSearch}
        isModalOpen={isFilterModalOpen}
        onModalOpenChange={setIsFilterModalOpen}
        activeFilters={activeFilters}
        onClearAll={handleClear}
      >
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Session mode</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "ALL", label: "Any" },
              { val: "ONLINE", label: "Online" },
              { val: "IN_PERSON", label: "In-person" },
              { val: "BOTH", label: "Online or in-person" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setModeFilter(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  modeFilter === opt.val
                    ? "border-power-orange text-power-orange bg-orange-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">
            Maximum session fee (₹)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min="0"
              value={maxFee}
              onChange={(e) => setMaxFee(e.target.value)}
              placeholder="Max fee"
              className="focus:border-power-orange w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Minimum rating</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: "0", label: "Any" },
              { val: "3", label: "3+ ★" },
              { val: "4", label: "4+ ★" },
              { val: "4.5", label: "4.5+ ★" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMinRating(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  minRating === opt.val
                    ? "border-power-orange text-power-orange bg-orange-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">Sort by</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { val: "relevance", label: "Recommended" },
              { val: "ratingDesc", label: "Top rated" },
              { val: "priceAsc", label: "Fee (Low to High)" },
              { val: "priceDesc", label: "Fee (High to Low)" },
            ].map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setSortBy(opt.val)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-semibold transition-all",
                  sortBy === opt.val
                    ? "border-power-orange text-power-orange bg-orange-50"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </FilterBar>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="max-w-8xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ExpertCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-slate-100 bg-white">
            <EmptyState
              icon={ServerCrash}
              title="Couldn't load experts"
              description={error}
              actionLabel="Retry"
              onAction={retryLoad}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white">
            <EmptyState
              icon={Search}
              title={hasFilters ? "No experts match your filters" : "No experts yet"}
              description={
                hasFilters
                  ? "Try broadening your search or clearing filters."
                  : "Check back soon. We're onboarding experts."
              }
              actionLabel={hasFilters ? "Clear filters" : undefined}
              onAction={hasFilters ? handleClear : undefined}
            />
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-baseline justify-between">
              <h2 className="font-title text-xl font-bold text-slate-900">
                {appliedSearch ? "Matching experts" : "All experts"}
              </h2>
              <span className="text-sm text-slate-500">
                {filtered.length} {filtered.length === 1 ? "expert" : "experts"}
              </span>
            </div>

            <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((expert) => {
                const id = String(expert.id || expert._id || "");
                const route = `/experts/${id}`;
                const primarySport = expert.sports?.[0] || "Guidance";

                return (
                  <StaggerItem key={id} className="h-full">
                    <ListingCard
                      href={route}
                      title={expert.name || "Sports expert"}
                      media={<ExpertAvatar expert={expert} className={LISTING_IMAGE_CLASS} />}
                      badge={modeLabel(expert.sessionMode)}
                      rating={
                        expert.reviewCount > 0
                          ? { value: expert.rating, count: expert.reviewCount }
                          : undefined
                      }
                      subtitle={expert.city || undefined}
                      details={[primarySport, expert.languages?.[0]].filter(Boolean).join(" · ")}
                      price={formatInr(expert.sessionFee)}
                      priceUnit="per session"
                    />
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </>
        )}
      </div>
    </div>
  );
}
