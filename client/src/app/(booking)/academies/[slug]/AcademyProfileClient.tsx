"use client";

import ParentExperiencesBand from "@/modules/community/components/ParentExperiencesBand";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { Button } from "@/modules/shared/ui/Button";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { BadgeCheck, Mail, MapPin, Phone, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TabKey =
  "overview" | "coaches" | "venues" | "subscriptions" | "packages" | "gallery" | "reviews";

type MaybePopulated = string | { _id?: string; id?: string; [key: string]: unknown };

type AcademyProfile = OnboardingAcademy & {
  ownerId?: { _id?: string; name?: string; email?: string; phone?: string };
  venueIds?: MaybePopulated[];
  coachIds?: MaybePopulated[];
  subscriptionPlans?: MaybePopulated[];
  sessionPackages?: MaybePopulated[];
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "coaches", label: "Coaches" },
  { key: "venues", label: "Venues" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "packages", label: "Packages" },
  { key: "gallery", label: "Gallery" },
  { key: "reviews", label: "Reviews" },
];

const normalizeImageUrl = (value?: string) => {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image")
  )
    return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.includes("amazonaws.com")) return `https://${trimmed}`;
  return trimmed;
};

const toRupees = (paise?: number) => {
  if (typeof paise !== "number") return null;
  return Math.round(paise / 100);
};

const formatAgeGroup = (group: string) => {
  if (group === "kids") return "Kids (5-12)";
  if (group === "teens") return "Teens (13-17)";
  if (group === "adults") return "Adults (18+)";
  if (group === "all") return "All Ages";
  return group;
};

const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function AcademyProfileClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [academy, setAcademy] = useState<AcademyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    const loadAcademyProfile = async () => {
      setLoading(true);
      try {
        const response = await academyOnboardingApi.getAcademyProfile(slug);
        if (response.success && response.data) setAcademy(response.data as AcademyProfile);
        else setAcademy(null);
      } catch {
        setAcademy(null);
      } finally {
        setLoading(false);
      }
    };
    if (slug) void loadAcademyProfile();
  }, [slug]);

  const galleryImages = useMemo(() => {
    if (!academy) return [] as string[];
    const allImages = [academy.coverPhotoUrl, academy.logoUrl, ...(academy.photos || [])];
    return Array.from(new Set(allImages.map((image) => normalizeImageUrl(image)).filter(Boolean)));
  }, [academy]);

  if (loading) {
    return (
      <div className="bg-paper min-h-screen" aria-busy="true" aria-label="Loading academy">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-10 h-5 w-28" />
          <div className="flex items-end gap-8">
            <Skeleton className="h-24 w-24 rounded-2xl sm:h-32 sm:w-32" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="mt-12 aspect-[16/7] w-full rounded-2xl" />
          <Skeleton className="mt-12 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (!academy) {
    return (
      <div className="bg-paper flex min-h-screen flex-col items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-editorial text-ink text-4xl font-light">Academy not found</h1>
          <p className="text-ink-body mt-3 text-pretty">
            This academy profile may be unavailable or not publicly visible yet.
          </p>
          <Link href="/booking?tab=academies" className="mt-6 inline-block">
            <Button variant="primary">Browse academies</Button>
          </Link>
        </div>
      </div>
    );
  }

  const academyMongoId = String((academy as any)._id || (academy as any).id || "");
  const coverImage = normalizeImageUrl(academy.coverPhotoUrl) || normalizeImageUrl(academy.logoUrl);
  const logoImage = normalizeImageUrl(academy.logoUrl);
  const sessionRate = toRupees(academy.sessionRatePerHour);

  const handleBookSession = () => {
    const checkoutParams = new URLSearchParams({ type: "academy" });
    if (academyMongoId) checkoutParams.set("academyId", academyMongoId);
    checkoutParams.set("academySlug", encodeURIComponent(slug));
    router.push(`/checkout?${checkoutParams.toString()}`);
  };

  const location = [academy.city, academy.state].filter(Boolean).join(", ");
  const isVerified = Boolean(academy.kycVerified && academy.isApproved);
  const phone = academy.contactPhone || academy.whatsappNumber;

  const sectionHeading = "font-editorial text-ink mb-4 text-2xl font-normal sm:text-3xl";
  const emptyNote = "text-ink-body max-w-[52ch] text-pretty";

  const onTabKeyDown = (e: React.KeyboardEvent) => {
    const index = TABS.findIndex((t) => t.key === activeTab);
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setActiveTab(TABS[next].key);
    (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  // A plain card for a linked coach, venue, plan or package.
  const tile = "border-hairline rounded-2xl border bg-white p-5";

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <nav aria-label="Academy pages" className="mb-10 text-sm">
          <Link
            href="/booking?tab=academies"
            className="text-ink-body hover:text-ink focus-visible:ring-ink group inline-flex items-center gap-1.5 rounded font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
          >
            <span
              aria-hidden
              className="transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
            >
              ←
            </span>
            All academies
          </Link>
        </nav>

        <header className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end lg:gap-10">
          <div className="bg-paper-deep aspect-square w-24 shrink-0 overflow-hidden rounded-2xl sm:w-32">
            {logoImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoImage}
                alt={`${academy.name} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="font-editorial text-ink-muted flex h-full w-full items-center justify-center text-5xl font-light"
              >
                {academy.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            {isVerified && (
              <p className="text-ink-muted mb-3 flex items-center gap-1.5 text-sm font-medium">
                <BadgeCheck aria-hidden strokeWidth={1.75} className="text-ink h-4 w-4" />
                Verified academy
              </p>
            )}
            <h1 className="font-editorial text-ink wrap-break-word text-balance text-4xl font-light leading-[1.05] sm:text-5xl lg:text-6xl">
              {academy.name}
            </h1>
            <p className="text-ink-body mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>{location || "Location unavailable"}</span>
              <span className="text-ink font-semibold tabular-nums">
                {typeof academy.rating === "number" ? academy.rating.toFixed(1) : "New"}
                <span className="text-ink-muted ml-1 font-normal">
                  ({academy.reviewCount || 0} reviews)
                </span>
              </span>
            </p>
            <Button asChild size="md" className="mt-6 lg:hidden">
              <a href="#book">
                Book a session
                {typeof sessionRate === "number" ? ` · ₹${sessionRate}/hr` : ""}
              </a>
            </Button>
          </div>
        </header>

        <div className="bg-paper-deep mt-12 aspect-[16/9] w-full overflow-hidden rounded-2xl sm:aspect-[16/7]">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt={academy.name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-ink-muted flex h-full items-center justify-center text-sm">
              No cover photo yet
            </div>
          )}
        </div>

        {(academy.sports || []).length > 0 && (
          <dl className="border-hairline mt-8 grid gap-1 border-y py-5 sm:grid-cols-[8rem_1fr] sm:gap-6">
            <dt className="text-ink-muted text-sm">Sports</dt>
            <dd className="text-ink text-pretty">{(academy.sports || []).join(", ")}</dd>
          </dl>
        )}

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-16">
          <div className="min-w-0">
            {/* Tabs */}
            <div className="border-hairline hide-scrollbar -mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
              <div
                role="tablist"
                aria-label="Academy sections"
                onKeyDown={onTabKeyDown}
                className="hide-scrollbar -mb-px flex gap-1 whitespace-nowrap"
              >
                {TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      id={`academy-tab-${tab.key}`}
                      aria-selected={active}
                      aria-controls="academy-panel"
                      tabIndex={active ? 0 : -1}
                      onClick={() => setActiveTab(tab.key)}
                      className={`focus-visible:ring-ink border-b-2 px-3 py-3.5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset ${
                        active
                          ? "border-ink text-ink"
                          : "text-ink-muted hover:text-ink border-transparent"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              role="tabpanel"
              id="academy-panel"
              aria-labelledby={`academy-tab-${activeTab}`}
              className="mt-12"
            >
              {activeTab === "overview" && (
                <div className="space-y-14">
                  <section aria-labelledby="about-heading">
                    <h2 id="about-heading" className={sectionHeading}>
                      About
                    </h2>
                    <p className="text-ink-body max-w-[65ch] text-base leading-relaxed sm:text-lg">
                      {academy.description || "No description provided yet."}
                    </p>
                    <dl className="border-hairline mt-8 grid grid-cols-1 gap-x-8 gap-y-6 border-t pt-6 sm:grid-cols-2">
                      <div>
                        <dt className="text-ink-muted text-sm">Age groups</dt>
                        <dd className="text-ink mt-1 font-medium">
                          {(academy.ageGroups || []).length > 0
                            ? (academy.ageGroups || []).map(formatAgeGroup).join(", ")
                            : "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted text-sm">Languages</dt>
                        <dd className="text-ink mt-1 font-medium">
                          {(academy.languagesSpoken || []).join(", ") || "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted text-sm">Established</dt>
                        <dd className="text-ink mt-1 font-medium tabular-nums">
                          {academy.establishedYear || "Not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-ink-muted text-sm">Batch size</dt>
                        <dd className="text-ink mt-1 font-medium">
                          {academy.maxBatchSize
                            ? `${academy.maxBatchSize} students`
                            : "Not provided"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <section aria-labelledby="contact-heading">
                    <h2 id="contact-heading" className={sectionHeading}>
                      Contact and location
                    </h2>
                    <ul className="border-hairline text-ink border-t">
                      {[
                        {
                          icon: MapPin,
                          value:
                            [academy.address, academy.city, academy.state, academy.pincode]
                              .filter(Boolean)
                              .join(", ") || "Address unavailable",
                        },
                        {
                          icon: Users,
                          value: academy.contactPersonName || "Contact person not provided",
                        },
                        { icon: Mail, value: academy.contactEmail || "Email unavailable" },
                        { icon: Phone, value: phone || "Phone unavailable" },
                      ].map(({ icon: Icon, value }) => (
                        <li
                          key={value}
                          className="border-hairline flex items-start gap-3 border-b py-3.5"
                        >
                          <Icon
                            aria-hidden
                            strokeWidth={1.5}
                            className="text-ink-muted mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span>{value}</span>
                        </li>
                      ))}
                    </ul>
                    {academy.placeId && (
                      <div className="mt-6 overflow-hidden rounded-2xl">
                        <iframe
                          title="Academy map"
                          src={`https://www.google.com/maps?q=place_id:${academy.placeId}&output=embed`}
                          loading="lazy"
                          className="h-64 w-full"
                        />
                      </div>
                    )}
                  </section>

                  <section aria-labelledby="hours-heading">
                    <h2 id="hours-heading" className={sectionHeading}>
                      Operating hours
                    </h2>
                    <dl className="border-hairline border-t">
                      {dayOrder.map((day) => {
                        const dayConfig = academy.operatingHours?.[day];
                        const label = day.charAt(0).toUpperCase() + day.slice(1);
                        return (
                          <div
                            key={day}
                            className="border-hairline flex items-baseline justify-between gap-4 border-b py-3"
                          >
                            <dt className="text-ink-body">{label}</dt>
                            <dd
                              className={`tabular-nums ${dayConfig?.isOpen ? "text-ink font-medium" : "text-ink-muted"}`}
                            >
                              {dayConfig?.isOpen
                                ? `${dayConfig.openTime || "--:--"} – ${dayConfig.closeTime || "--:--"}`
                                : "Closed"}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </section>
                </div>
              )}

              {activeTab === "coaches" && (
                <section aria-labelledby="coaches-heading">
                  <h2 id="coaches-heading" className={sectionHeading}>
                    Coaches
                  </h2>
                  {academy.coachIds && academy.coachIds.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {academy.coachIds.map((coach, index) => {
                        const coachObj =
                          typeof coach === "object"
                            ? (coach as { _id?: string; id?: string; name?: string })
                            : null;
                        const key = coachObj?._id || coachObj?.id || `${index}`;
                        return (
                          <li key={key} className={tile}>
                            <p className="text-ink font-semibold">
                              {coachObj?.name || `Coach ${index + 1}`}
                            </p>
                            <p className="text-ink-muted mt-1 text-sm">Coaches at this academy</p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={emptyNote}>No coaches linked yet.</p>
                  )}
                </section>
              )}

              {activeTab === "venues" && (
                <section aria-labelledby="venues-heading">
                  <h2 id="venues-heading" className={sectionHeading}>
                    Venues
                  </h2>
                  {academy.venueIds && academy.venueIds.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {academy.venueIds.map((venue, index) => {
                        const venueObj =
                          typeof venue === "object"
                            ? (venue as { _id?: string; id?: string; name?: string })
                            : null;
                        const key = venueObj?._id || venueObj?.id || `${index}`;
                        return (
                          <li key={key} className={tile}>
                            <p className="text-ink font-semibold">
                              {venueObj?.name || `Venue ${index + 1}`}
                            </p>
                            <p className="text-ink-muted mt-1 text-sm">Run by this academy</p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={emptyNote}>No venues linked yet.</p>
                  )}
                </section>
              )}

              {activeTab === "subscriptions" && (
                <section aria-labelledby="plans-heading">
                  <h2 id="plans-heading" className={sectionHeading}>
                    Subscription plans
                  </h2>
                  {academy.subscriptionPlans && academy.subscriptionPlans.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {academy.subscriptionPlans.map((plan, index) => {
                        const planObj =
                          typeof plan === "object"
                            ? (plan as { _id?: string; id?: string; name?: string; price?: number })
                            : null;
                        const key = planObj?._id || planObj?.id || `${index}`;
                        const price =
                          typeof planObj?.price === "number"
                            ? Math.round(planObj.price / 100)
                            : null;
                        return (
                          <li key={key} className={tile}>
                            <p className="text-ink font-semibold">
                              {planObj?.name || `Plan ${index + 1}`}
                            </p>
                            <p className="font-editorial text-ink mt-2 text-3xl font-light tabular-nums">
                              {typeof price === "number" ? `₹${price}` : "On request"}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={emptyNote}>No subscription plans published yet.</p>
                  )}
                </section>
              )}

              {activeTab === "packages" && (
                <section aria-labelledby="packages-heading">
                  <h2 id="packages-heading" className={sectionHeading}>
                    Session packages
                  </h2>
                  {academy.sessionPackages && academy.sessionPackages.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {academy.sessionPackages.map((pkg, index) => {
                        const packageObj =
                          typeof pkg === "object"
                            ? (pkg as { _id?: string; id?: string; name?: string; price?: number })
                            : null;
                        const key = packageObj?._id || packageObj?.id || `${index}`;
                        const price =
                          typeof packageObj?.price === "number"
                            ? Math.round(packageObj.price / 100)
                            : null;
                        return (
                          <li key={key} className={tile}>
                            <p className="text-ink font-semibold">
                              {packageObj?.name || `Package ${index + 1}`}
                            </p>
                            <p className="font-editorial text-ink mt-2 text-3xl font-light tabular-nums">
                              {typeof price === "number" ? `₹${price}` : "On request"}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className={emptyNote}>No session packages published yet.</p>
                  )}
                </section>
              )}

              {activeTab === "gallery" && (
                <section aria-labelledby="gallery-heading">
                  <h2 id="gallery-heading" className={sectionHeading}>
                    Gallery
                  </h2>
                  {galleryImages.length > 0 ? (
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {galleryImages.map((image, index) => (
                        <li
                          key={`${image}-${index}`}
                          className="bg-paper-deep aspect-[4/3] overflow-hidden rounded-2xl"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={image}
                            alt={`${academy.name}, photo ${index + 1}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={emptyNote}>No gallery photos available.</p>
                  )}
                </section>
              )}

              {activeTab === "reviews" && (
                <section aria-labelledby="reviews-heading">
                  <h2 id="reviews-heading" className={sectionHeading}>
                    Reviews
                  </h2>
                  <p className="mb-6 flex items-baseline gap-3">
                    <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                      {typeof academy.rating === "number" ? academy.rating.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-ink-muted text-sm">
                      from {academy.reviewCount || 0}{" "}
                      {(academy.reviewCount || 0) === 1 ? "review" : "reviews"}
                    </span>
                  </p>
                  <p className={emptyNote}>
                    Individual reviews will appear here once they are connected to this page.
                  </p>
                  {academyMongoId && (
                    <div className="mt-12">
                      <ParentExperiencesBand
                        kind="ACADEMY"
                        refId={academyMongoId}
                        name={academy.name}
                        slug={slug}
                      />
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>

          {/* Booking */}
          <aside
            id="book"
            aria-label="Book a session"
            className="min-w-0 scroll-mt-24 lg:top-24 lg:[@media(min-height:860px)]:sticky"
          >
            <div className="border-hairline overflow-hidden rounded-2xl border bg-white">
              <div className="border-hairline border-b p-6 sm:p-8">
                <p className="text-ink-muted text-sm">Session rate</p>
                <p className="mt-1 flex items-baseline gap-3">
                  {typeof sessionRate === "number" ? (
                    <>
                      <span className="font-editorial text-ink text-5xl font-light tabular-nums">
                        ₹{sessionRate}
                      </span>
                      <span className="text-ink-muted text-sm">per hour</span>
                    </>
                  ) : (
                    <span className="font-editorial text-ink text-3xl font-light">
                      Price on request
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-5 p-6 sm:p-8">
                <p className="text-ink-body text-sm leading-relaxed">
                  Book a session directly, or contact the academy to ask about batches, schedules
                  and trials.
                </p>
                <Button variant="primary" size="lg" className="w-full" onClick={handleBookSession}>
                  Book a session
                </Button>
                {(academy.contactPhone || academy.contactEmail) && (
                  <p className="text-ink flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium">
                    {academy.contactPhone && (
                      <a
                        href={`tel:${academy.contactPhone}`}
                        className="decoration-ink/30 hover:decoration-ink focus-visible:ring-ink rounded underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
                      >
                        Call the academy
                      </a>
                    )}
                    {academy.contactEmail && (
                      <a
                        href={`mailto:${academy.contactEmail}`}
                        className="decoration-ink/30 hover:decoration-ink focus-visible:ring-ink rounded underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2"
                      >
                        Email the academy
                      </a>
                    )}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
