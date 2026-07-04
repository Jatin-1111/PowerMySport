"use client";

import { expertApi, type Expert } from "@/modules/expert/services/expert";
import { EmptyState } from "@/modules/shared/ui/EmptyState";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { FadeIn } from "@/modules/shared/ui/motion/FadeIn";
import {
  StaggerContainer,
  StaggerItem,
} from "@/modules/shared/ui/motion/StaggerContainer";
import {
  FilterBar,
  type ActiveFilter,
} from "@/modules/discovery/components/FilterBar";
import { cn } from "@/utils/cn";
import {
  ArrowRight,
  Award,
  CalendarCheck,
  Globe,
  Languages,
  MapPin,
  Search,
  ServerCrash,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

const formatInr = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const normalize = (v: string) =>
  v.toLocaleLowerCase().trim().replace(/\s+/g, " ");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const MODE_OPTIONS = ["ALL", "ONLINE", "IN_PERSON", "BOTH"];
const MIN_RATING_OPTIONS = ["0", "3", "4", "4.5"];
const SORT_OPTIONS = ["relevance", "priceAsc", "priceDesc", "ratingDesc"];

const modeLabel = (mode: Expert["sessionMode"]) =>
  mode === "BOTH"
    ? "Online or in-person"
    : mode === "ONLINE"
      ? "Online"
      : "In-person";

function ExpertAvatar({
  expert,
  className,
}: {
  expert: Expert;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (expert.name || "E").charAt(0).toUpperCase();
  if (!expert.photoUrl || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-5xl font-bold text-slate-300",
          className,
        )}
      >
        {initial}
      </div>
    );
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
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)]">
      <Skeleton className="aspect-3/4 w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <div className="!mt-5 flex items-center justify-between border-t border-slate-50 pt-5">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

function ExpertsBrowseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [maxFee, setMaxFee] = useState("");
  const [minRating, setMinRating] = useState("0");
  const [sortBy, setSortBy] = useState("relevance");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const hasHydratedRef = useRef(false);

  // Hydrate filters from the URL (?sport=, ?mode=, etc.).
  useEffect(() => {
    if (hasHydratedRef.current) return;
    hasHydratedRef.current = true;
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
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await expertApi.listExperts({ limit: 60 });
        if (!active) return;
        if (res.success && res.data) setExperts(res.data);
        else setError(res.message || "Failed to load experts.");
      } catch {
        if (active) setError("Failed to load experts.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
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
        ].join(" "),
      );
      const matchSearch = !term || haystack.includes(term);
      const matchMode = modeFilter === "ALL" || e.sessionMode === modeFilter;
      const matchFee =
        parsedMax === undefined ||
        isNaN(parsedMax) ||
        Number(e.sessionFee || 0) <= parsedMax;
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
        else if ((e.expertise || []).some((s) => normalize(s).includes(term)))
          match = 0.5;
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
        sortBy === "priceAsc"
          ? "Fee ↑"
          : sortBy === "priceDesc"
            ? "Fee ↓"
            : "Top rated"
      }`,
      onRemove: () => setSortBy("relevance"),
    });

  const hasFilters = activeFilters.length > 0 || appliedSearch !== "";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-power-orange/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-turf-green/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <FadeIn className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80">
                <Award className="h-3.5 w-3.5" /> Expert guidance
              </span>
              <h1
                className="mt-4 text-3xl font-bold leading-tight sm:text-4xl"
                style={{ fontFamily: "var(--font-syne)" }}
              >
                Book a 1:1 session with a sports expert
              </h1>
              <p className="mt-3 text-sm text-slate-300 sm:text-base">
                Browse verified experts, pay securely, pick a time that suits
                you — then rate your session afterwards.
              </p>
            </FadeIn>
            <Link
              href="/experts/sessions"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/20"
            >
              <CalendarCheck className="h-4 w-4" /> My sessions
            </Link>
          </div>
        </div>
      </section>

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
          <label className="mb-3 block text-sm font-bold text-slate-900">
            Session mode
          </label>
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
                    ? "border-power-orange bg-orange-50 text-power-orange"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
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
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-7 pr-3 text-sm text-slate-900 focus:border-power-orange focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">
            Minimum rating
          </label>
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
                    ? "border-power-orange bg-orange-50 text-power-orange"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-bold text-slate-900">
            Sort by
          </label>
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
                    ? "border-power-orange bg-orange-50 text-power-orange"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </FilterBar>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
              onAction={() => window.location.reload()}
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
                  : "Check back soon — we're onboarding experts."
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

            <StaggerContainer className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((expert) => {
                const id = String(expert.id || expert._id || "");
                const route = `/experts/${id}`;
                const primarySport = expert.sports?.[0] || "Guidance";
                const tags = [
                  ...(expert.sports || []),
                  ...(expert.expertise || []),
                ].slice(0, 3);

                return (
                  <StaggerItem key={id} className="h-full">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(route)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(route);
                        }
                      }}
                      aria-label={`View expert profile for ${expert.name || "expert"}`}
                      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgb(0,0,0,0.08)]"
                    >
                      <div className="relative aspect-3/4 w-full overflow-hidden bg-slate-100">
                        <ExpertAvatar
                          expert={expert}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
                          <Globe className="h-3 w-3" />
                          {modeLabel(expert.sessionMode)}
                        </span>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">
                          {expert.name || "Sports Expert"}
                        </h3>

                        {expert.city && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                            <MapPin size={14} className="shrink-0 text-slate-400" />
                            <span className="line-clamp-1">{expert.city}</span>
                          </p>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-1.5">
                          {expert.reviewCount > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                              <Star
                                size={12}
                                className="fill-amber-400 text-amber-400"
                              />
                              {expert.rating.toFixed(1)}
                              <span className="font-normal text-slate-400">
                                ({expert.reviewCount})
                              </span>
                            </span>
                          )}
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-power-orange">
                            {primarySport}
                          </span>
                          {expert.languages && expert.languages.length > 0 && (
                            <span className="flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                              <Languages size={11} />
                              {expert.languages[0]}
                            </span>
                          )}
                        </div>

                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500">
                          {expert.bio?.trim() ||
                            `Experienced ${primarySport.toLowerCase()} expert available for focused 1:1 guidance sessions.`}
                        </p>

                        {tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-500"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-5">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-slate-900">
                              {formatInr(expert.sessionFee)}
                            </span>
                            <span className="text-sm font-medium text-slate-500">
                              /session
                            </span>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-600 transition-all group-hover:-rotate-45 group-hover:bg-power-orange group-hover:text-white">
                            <ArrowRight size={17} strokeWidth={2.5} />
                          </div>
                        </div>
                      </div>
                    </div>
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

export default function ExpertsBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-100 border-t-power-orange" />
          <p className="text-sm font-medium text-slate-500">Loading experts…</p>
        </div>
      }
    >
      <ExpertsBrowseContent />
    </Suspense>
  );
}
