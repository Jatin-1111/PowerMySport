import { PaymentMethodOption } from "@/modules/booking/components/checkout/PaymentMethodSelector";
import { OnboardingAcademy } from "@/modules/onboarding/types/academy";
import { Coach } from "@/types";
import { getOwnVenueLocationDisplay } from "@/utils/location";
import { Variants } from "framer-motion";
import { Wallet } from "lucide-react";

/**
 * Pure helpers, types, and animation constants for the checkout page —
 * extracted from `app/(booking)/checkout/page.tsx`, which had grown to
 * 1,602 lines. Nothing here changed behavior, only location.
 */

export type BookingType = "coach" | "venue" | "academy";

export type AcademyCard = OnboardingAcademy & {
  id?: string;
  slug?: string;
  city?: string;
  sports?: string[];
  rating?: number;
  reviewCount?: number;
  sessionRatePerHour?: number;
  logoUrl?: string;
  coverPhotoUrl?: string;
};

// ─── Animation variants ───────────────────────────────────────────────────────

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
};

export const stepVariants: Variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.35, ease: "easeOut" } },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -28 : 28,
    transition: { duration: 0.25, ease: "easeIn" },
  }),
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const PAYMENT_OPTIONS: PaymentMethodOption[] = [
  {
    id: "phonepe",
    label: "PhonePe",
    description: "UPI, cards, and wallets",
    icon: <Wallet size={18} />,
    badge: "Recommended",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const normalizeImageUrl = (value?: string) => {
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

export const getCoachDisplayName = (coach: Coach) => {
  const userName =
    typeof coach.userId === "object" && coach.userId !== null ? coach.userId.name : "";
  return userName?.trim() || `${coach.sports?.[0] || "Coach"} Coach`;
};

export const getCoachImageCandidates = (coach: Coach) => {
  const userPhoto =
    typeof coach.userId === "object" && coach.userId !== null ? coach.userId.photoUrl : "";
  return [coach.photoUrl, coach.profileImage, userPhoto, coach.ownVenueDetails?.images?.[0]]
    .map((v) => normalizeImageUrl(v))
    .filter((v): v is string => Boolean(v));
};

export const getCoachLocationLabel = (coach: Coach) => {
  if (coach.serviceMode === "FREELANCE") return "Freelance";
  if (coach.serviceMode === "OWN_VENUE") {
    const loc = getOwnVenueLocationDisplay(coach.ownVenueDetails);
    return loc ? `Own Venue · ${loc.title}` : "Own Venue";
  }
  return "Hybrid";
};
