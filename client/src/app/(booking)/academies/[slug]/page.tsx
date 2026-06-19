"use client";

import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  IndianRupee,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TabKey =
  | "overview"
  | "coaches"
  | "venues"
  | "subscriptions"
  | "packages"
  | "gallery"
  | "reviews";

type MaybePopulated =
  | string
  | { _id?: string; id?: string; [key: string]: unknown };

type AcademyProfile = OnboardingAcademy & {
  ownerId?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
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
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image")
  ) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.includes("amazonaws.com")) {
    return `https://${trimmed}`;
  }

  return trimmed;
};

const toRupees = (paise?: number) => {
  if (typeof paise !== "number") {
    return null;
  }

  return Math.round(paise / 100);
};

const formatAgeGroup = (group: string) => {
  if (group === "kids") return "Kids (5-12)";
  if (group === "teens") return "Teens (13-17)";
  if (group === "adults") return "Adults (18+)";
  if (group === "all") return "All Ages";
  return group;
};

const dayOrder = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function AcademyProfilePage() {
  const params = useParams();
  const slug = params.slug as string;

  const [academy, setAcademy] = useState<AcademyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  useEffect(() => {
    const loadAcademyProfile = async () => {
      setLoading(true);

      try {
        const response = await academyOnboardingApi.getAcademyProfile(slug);
        if (response.success && response.data) {
          setAcademy(response.data as AcademyProfile);
        } else {
          setAcademy(null);
        }
      } catch (error) {
        console.error("Failed to load academy profile:", error);
        setAcademy(null);
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      void loadAcademyProfile();
    }
  }, [slug]);

  const galleryImages = useMemo(() => {
    if (!academy) {
      return [] as string[];
    }

    const allImages = [
      academy.coverPhotoUrl,
      academy.logoUrl,
      ...(academy.photos || []),
    ];
    return Array.from(
      new Set(
        allImages.map((image) => normalizeImageUrl(image)).filter(Boolean),
      ),
    );
  }, [academy]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_46%,#fff8ee_100%)]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-power-orange" />
      </div>
    );
  }

  if (!academy) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_46%,#fff8ee_100%)] flex flex-col">
        <Navigation sticky />
        <main className="mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-10">
          <Card className="w-full rounded-2xl border-slate-200 bg-white/90 p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              Academy not found
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              This academy profile may be unavailable or not publicly visible
              yet.
            </p>
            <div className="mt-5">
              <Link href="/academies">
                <Button variant="primary">Browse Academies</Button>
              </Link>
            </div>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const coverImage =
    normalizeImageUrl(academy.coverPhotoUrl) ||
    normalizeImageUrl(academy.logoUrl);
  const logoImage = normalizeImageUrl(academy.logoUrl);
  const sessionRate = toRupees(academy.sessionRatePerHour);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_46%,#fff8ee_100%)] flex flex-col">
      <Navigation sticky />

      <main className="flex-1">
        <section className="border-b border-white/60 bg-white/80 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Link
              href="/academies"
              className="text-sm font-semibold text-power-orange hover:text-orange-700"
            >
              ← Back to academies
            </Link>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-sm">
            <div className="relative h-60 w-full bg-slate-200 sm:h-72 lg:h-80">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={academy.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="bg-linear-to-br from-slate-200 to-slate-300 flex h-full items-center justify-center text-slate-600">
                  No cover photo
                </div>
              )}
            </div>

            <div className="px-5 py-6 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:h-20 sm:w-20">
                    {logoImage ? (
                      <img
                        src={logoImage}
                        alt={`${academy.name} logo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500">
                        Logo
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                        {academy.name}
                      </h1>
                      {academy.kycVerified && academy.isApproved && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <BadgeCheck size={14} />
                          Verified
                        </span>
                      )}
                    </div>

                    <p className="inline-flex items-center gap-1 text-sm text-slate-600">
                      <MapPin size={14} />
                      {[academy.city, academy.state]
                        .filter(Boolean)
                        .join(", ") || "Location unavailable"}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <p className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                        <IndianRupee size={14} />
                        {typeof sessionRate === "number"
                          ? `${sessionRate}/hr`
                          : "Price on request"}
                      </p>
                      <p className="text-sm font-semibold text-slate-700">
                        ⭐{" "}
                        {typeof academy.rating === "number"
                          ? academy.rating.toFixed(1)
                          : "New"}
                        <span className="ml-1 font-normal text-slate-500">
                          ({academy.reviewCount || 0} reviews)
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(academy.sports || []).map((sport) => (
                    <span
                      key={sport}
                      className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700"
                    >
                      {sport}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white/85 p-2">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-power-orange text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="rounded-2xl border-slate-200 bg-white/90 lg:col-span-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    About Academy
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {academy.description || "No description provided yet."}
                  </p>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Age Groups
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(academy.ageGroups || []).length > 0 ? (
                          (academy.ageGroups || []).map((group) => (
                            <span
                              key={group}
                              className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                            >
                              {formatAgeGroup(group)}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">
                            Not provided
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Languages
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {(academy.languagesSpoken || []).join(", ") ||
                          "Not provided"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Established
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {academy.establishedYear || "N/A"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Batch Size
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {academy.maxBatchSize
                          ? `${academy.maxBatchSize} students`
                          : "Not provided"}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-2xl border-slate-200 bg-white/90">
                  <h2 className="text-lg font-bold text-slate-900">
                    Contact & Location
                  </h2>

                  <div className="mt-4 space-y-3 text-sm text-slate-700">
                    <p className="inline-flex items-center gap-2">
                      <MapPin size={14} className="text-slate-500" />
                      {[
                        academy.address,
                        academy.city,
                        academy.state,
                        academy.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "Address unavailable"}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Users size={14} className="text-slate-500" />
                      {academy.contactPersonName ||
                        "Contact person not provided"}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Mail size={14} className="text-slate-500" />
                      {academy.contactEmail || "Email unavailable"}
                    </p>
                    <p className="inline-flex items-center gap-2">
                      <Phone size={14} className="text-slate-500" />
                      {academy.contactPhone ||
                        academy.whatsappNumber ||
                        "Phone unavailable"}
                    </p>
                  </div>

                  {academy.placeId && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      <iframe
                        title="Academy map"
                        src={`https://www.google.com/maps?q=place_id:${academy.placeId}&output=embed`}
                        loading="lazy"
                        className="h-56 w-full"
                      />
                    </div>
                  )}
                </Card>

                <Card className="rounded-2xl border-slate-200 bg-white/90 lg:col-span-3">
                  <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Clock3 size={18} />
                    Operating Hours
                  </h2>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {dayOrder.map((day) => {
                      const dayConfig = academy.operatingHours?.[day];
                      const label = day.charAt(0).toUpperCase() + day.slice(1);

                      return (
                        <div
                          key={day}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {label}
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-700">
                            {dayConfig?.isOpen
                              ? `${dayConfig.openTime || "--:--"} - ${dayConfig.closeTime || "--:--"}`
                              : "Closed"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "coaches" && (
              <Card className="rounded-2xl border-slate-200 bg-white/90">
                <h2 className="text-lg font-bold text-slate-900">Coaches</h2>
                {academy.coachIds && academy.coachIds.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {academy.coachIds.map((coach, index) => {
                      const coachObj =
                        typeof coach === "object"
                          ? (coach as {
                              _id?: string;
                              id?: string;
                              name?: string;
                            })
                          : null;
                      const key = coachObj?._id || coachObj?.id || `${index}`;

                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {coachObj?.name || `Coach ${index + 1}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Assigned to academy
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No coaches linked yet.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "venues" && (
              <Card className="rounded-2xl border-slate-200 bg-white/90">
                <h2 className="text-lg font-bold text-slate-900">Venues</h2>
                {academy.venueIds && academy.venueIds.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {academy.venueIds.map((venue, index) => {
                      const venueObj =
                        typeof venue === "object"
                          ? (venue as {
                              _id?: string;
                              id?: string;
                              name?: string;
                            })
                          : null;
                      const key = venueObj?._id || venueObj?.id || `${index}`;

                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {venueObj?.name || `Venue ${index + 1}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Managed by academy
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No venues linked yet.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "subscriptions" && (
              <Card className="rounded-2xl border-slate-200 bg-white/90">
                <h2 className="text-lg font-bold text-slate-900">
                  Subscription Plans
                </h2>
                {academy.subscriptionPlans &&
                academy.subscriptionPlans.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {academy.subscriptionPlans.map((plan, index) => {
                      const planObj =
                        typeof plan === "object"
                          ? (plan as {
                              _id?: string;
                              id?: string;
                              name?: string;
                              price?: number;
                            })
                          : null;
                      const key = planObj?._id || planObj?.id || `${index}`;

                      const price =
                        typeof planObj?.price === "number"
                          ? Math.round(planObj.price / 100)
                          : null;

                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {planObj?.name || `Plan ${index + 1}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {typeof price === "number"
                              ? `₹${price}`
                              : "Price available on request"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No subscription plans published yet.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "packages" && (
              <Card className="rounded-2xl border-slate-200 bg-white/90">
                <h2 className="text-lg font-bold text-slate-900">
                  Session Packages
                </h2>
                {academy.sessionPackages &&
                academy.sessionPackages.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {academy.sessionPackages.map((pkg, index) => {
                      const packageObj =
                        typeof pkg === "object"
                          ? (pkg as {
                              _id?: string;
                              id?: string;
                              name?: string;
                              price?: number;
                            })
                          : null;
                      const key =
                        packageObj?._id || packageObj?.id || `${index}`;

                      const price =
                        typeof packageObj?.price === "number"
                          ? Math.round(packageObj.price / 100)
                          : null;

                      return (
                        <div
                          key={key}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {packageObj?.name || `Package ${index + 1}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {typeof price === "number"
                              ? `₹${price}`
                              : "Price available on request"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No session packages published yet.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "gallery" && (
              <Card className="rounded-2xl border-slate-200 bg-white/90">
                <h2 className="text-lg font-bold text-slate-900">Gallery</h2>
                {galleryImages.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {galleryImages.map((image, index) => (
                      <div
                        key={`${image}-${index}`}
                        className="h-56 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                      >
                        <img
                          src={image}
                          alt={`${academy.name} gallery ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No gallery photos available.
                  </p>
                )}
              </Card>
            )}

            {activeTab === "reviews" && (
              <Card className="rounded-2xl border-slate-200 bg-white/90">
                <h2 className="text-lg font-bold text-slate-900">Reviews</h2>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Average Rating
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {typeof academy.rating === "number"
                        ? academy.rating.toFixed(1)
                        : "0.0"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Total Reviews
                    </p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {academy.reviewCount || 0}
                    </p>
                  </div>
                </div>

                <p className="mt-5 text-sm text-slate-600">
                  Detailed review feed will be connected in the reviews module
                  integration.
                </p>
              </Card>
            )}
          </div>

          <section className="mt-8">
            <Card className="rounded-2xl border-slate-200 bg-white/90">
              <h2 className="inline-flex items-center gap-2 text-lg font-bold text-slate-900">
                <CalendarDays size={18} />
                Ready to train?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Contact the academy to discuss batches, schedules, and trials.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {academy.contactPhone && (
                  <a href={`tel:${academy.contactPhone}`}>
                    <Button variant="primary">Call Academy</Button>
                  </a>
                )}
                {academy.contactEmail && (
                  <a href={`mailto:${academy.contactEmail}`}>
                    <Button variant="outline">Email Academy</Button>
                  </a>
                )}
              </div>
            </Card>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}
