"use client";

import { useFlow } from "@/flow/useFlow";
import { authApi } from "@/modules/auth/services/auth";
import { useAuthStore } from "@/modules/auth/store/authStore";
import {
  EMPTY_TAX_PAYOUT_INFO,
  buildPayoutMethodPayload,
  validateTaxPayoutInfo,
  type TaxPayoutInfoValue,
} from "@/modules/expert/components/TaxPayoutInfoStep";
import { expertApi, type ExpertAvailabilityWindow } from "@/modules/expert/services/expert";
import { payoutApi } from "@/modules/shared/services/payout";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DAYS, EXPERT_ONBOARDING_FLOW, type SessionMode } from "./steps";

/**
 * Everything the expert onboarding wizard holds and does: the draft fields for
 * each step, loading a saved draft, the per-step checks behind Continue, saving
 * each step as it is left and the final submit for review. The components only
 * render this; none of the rules live in them.
 */
export function useExpertOnboarding() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  /** Why a reviewer sent the profile back; shown above step 1 so it can be fixed. */
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  // Step 1 — Identity
  const [name, setName] = useState(user?.name || "");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoKey, setPhotoKey] = useState("");
  const [bio, setBio] = useState("");
  const [achievements, setAchievements] = useState("");
  const [city, setCity] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Step 2 — Expertise
  const [sports, setSports] = useState<string[]>([]);
  const [expertise, setExpertise] = useState<string[]>([]);

  // Step 3 — Session setup
  const [sessionFee, setSessionFee] = useState("");
  const [sessionMode, setSessionMode] = useState<SessionMode>("ONLINE");
  const [inPersonAddress, setInPersonAddress] = useState("");
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState("60");

  // Step 4 — Availability
  const [windows, setWindows] = useState<ExpertAvailabilityWindow[]>([]);
  const [blackout, setBlackout] = useState<string[]>([]);
  const [newBlackout, setNewBlackout] = useState("");

  // Step 5 — Tax and payout
  const [taxPayout, setTaxPayout] = useState<TaxPayoutInfoValue>(EMPTY_TAX_PAYOUT_INFO);
  const [agreedToPartnerTerms, setAgreedToPartnerTerms] = useState(false);

  // URL-driven step (1-based `step` preserved so every existing reference works).
  // `flowNext`/`goBack` are this flow's next/back; `goNext` below keeps its
  // validation and calls `flowNext()` once the step is saved.
  const {
    number: step,
    next: flowNext,
    back: goBack,
    goToStep,
  } = useFlow(EXPERT_ONBOARDING_FLOW, {
    loading,
    name,
    bio,
    achievements,
    sports,
    expertise,
    sessionFee,
    sessionMode,
    inPersonAddress,
    windows,
  });

  // The auth store hydrates from localStorage asynchronously (see
  // HydrationBoundary), so `user` can still be null on the render where the
  // `name` state initializer runs. Sync once it arrives.
  useEffect(() => {
    if (user?.name && !name) setName(user.name);
  }, [user?.name, name]);

  useEffect(() => {
    // Load existing profile — if already PENDING or APPROVED, show status screen
    expertApi
      .getMyProfile()
      .then((res) => {
        if (res.success && res.data) {
          const p = res.data;
          if (p.verificationStatus === "APPROVED") {
            router.replace("/expert/dashboard");
            return;
          }
          if (p.verificationStatus === "PENDING") {
            setSubmitted(true);
            setLoading(false);
            return;
          }
          // Pre-fill from any saved draft
          setPhotoUrl(p.photoUrl || "");
          setPhotoKey(p.photoKey || "");
          setBio(p.bio || "");
          setAchievements(p.achievements || "");
          setCity(p.city || "");
          setLanguages(p.languages || []);
          setSports(p.sports || []);
          setExpertise(p.expertise || []);
          setSessionFee(p.sessionFee > 0 ? String(p.sessionFee) : "");
          setSessionMode(p.sessionMode || "ONLINE");
          setInPersonAddress(p.inPersonAddress || "");
          setSessionDurationMinutes(String(p.sessionDurationMinutes || 60));
          setWindows(p.weeklyAvailability || []);
          setBlackout(p.blackoutDates || []);
          const primaryPayout = p.payoutMethods?.find((m) => m.isDefault) || p.payoutMethods?.[0];
          setTaxPayout({
            panNumber: p.panNumber || "",
            gstNumber: p.gstNumber || "",
            payoutType: primaryPayout?.type || "BANK_TRANSFER",
            accountHolderName: primaryPayout?.accountHolderName || "",
            accountNumber: primaryPayout?.accountNumber || "",
            confirmAccountNumber: primaryPayout?.accountNumber || "",
            ifscCode: primaryPayout?.ifscCode || "",
            bankName: primaryPayout?.bankName || "",
            upiId: primaryPayout?.upiId || "",
          });
          // If rejected, start at the top and show the reviewer's reason
          if (p.verificationStatus === "REJECTED") {
            setRejectionReason(p.rejectionReason || "Our team asked for changes.");
            goToStep(1);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  // ── Availability helpers ─────────────────────────────────────────────────

  const addWindow = (dayOfWeek: number) =>
    setWindows((w) => [...w, { dayOfWeek, start: "09:00", end: "10:00" }]);

  const updateWindow = (idx: number, key: "start" | "end", val: string) =>
    setWindows((w) => w.map((item, i) => (i === idx ? { ...item, [key]: val } : item)));

  const removeWindow = (idx: number) => setWindows((w) => w.filter((_, i) => i !== idx));

  const addBlackout = () => {
    if (!newBlackout) return;
    setBlackout((b) => (b.includes(newBlackout) ? b : [...b, newBlackout].sort()));
    setNewBlackout("");
  };

  // ── Save draft to server silently ────────────────────────────────────────

  const saveDraft = async (patch: Parameters<typeof expertApi.updateMyProfile>[0]) => {
    try {
      await expertApi.updateMyProfile(patch);
    } catch {
      // Best-effort; don't block navigation
    }
  };

  // ── Step navigation ──────────────────────────────────────────────────────

  const goNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("Name is required");
        return;
      }
      if (!bio.trim() || bio.trim().length < 20) {
        toast.error("Bio must be at least 20 characters");
        return;
      }
      if (!achievements.trim()) {
        toast.error("Achievements are required");
        return;
      }
      if (name.trim() !== user?.name) {
        const nameRes = await authApi.updateProfile({ name: name.trim() });
        if (nameRes.success && nameRes.data) setUser(nameRes.data);
      }
      await saveDraft({
        bio,
        achievements,
        city,
        languages,
        photoUrl: photoUrl || undefined,
        photoKey: photoKey || undefined,
      });
    }
    if (step === 2) {
      if (sports.length === 0) {
        toast.error("Select at least one sport");
        return;
      }
      if (expertise.length === 0) {
        toast.error("Add at least one expertise tag");
        return;
      }
      await saveDraft({ sports, expertise });
    }
    if (step === 3) {
      const fee = Number(sessionFee);
      if (!sessionFee || isNaN(fee) || fee <= 0) {
        toast.error("Enter a valid session fee");
        return;
      }
      if ((sessionMode === "IN_PERSON" || sessionMode === "BOTH") && !inPersonAddress.trim()) {
        toast.error("In-person address is required");
        return;
      }
      await saveDraft({
        sessionFee: fee,
        sessionMode,
        inPersonAddress: inPersonAddress || undefined,
        sessionDurationMinutes: Number(sessionDurationMinutes) || 60,
      });
    }
    if (step === 4) {
      for (const w of windows) {
        if (w.start >= w.end) {
          toast.error(`Invalid time range on ${DAYS[w.dayOfWeek]}`);
          return;
        }
      }
      await saveDraft({ weeklyAvailability: windows, blackoutDates: blackout });
    }
    flowNext();
  };

  // ── Final submission ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const taxPayoutError = validateTaxPayoutInfo(taxPayout);
    if (taxPayoutError) {
      toast.error(taxPayoutError);
      return;
    }
    if (!agreedToPartnerTerms) {
      toast.error("Please accept the Partner Terms to submit for review");
      return;
    }
    setSubmitting(true);
    try {
      await expertApi.updateMyProfile({
        panNumber: taxPayout.panNumber.trim().toUpperCase(),
        gstNumber: taxPayout.gstNumber.trim().toUpperCase(),
      });
      const payoutRes = await payoutApi.upsertExpertPayoutMethod(
        buildPayoutMethodPayload(taxPayout)
      );
      if (!payoutRes.success) {
        toast.error(payoutRes.message || "Failed to save payout method");
        setSubmitting(false);
        return;
      }
      const res = await expertApi.submitForReview();
      if (res.success) {
        setSubmitted(true);
        toast.success("Profile submitted for review.");
      } else {
        toast.error(res.message || "Submission failed");
      }
    } catch {
      toast.error("Failed to submit profile");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    router,
    user,
    step,
    goBack,
    goToStep,
    goNext,
    handleSubmit,
    loading,
    submitting,
    submitted,
    rejectionReason,
    // identity
    name,
    setName,
    photoUrl,
    setPhotoUrl,
    photoKey,
    setPhotoKey,
    bio,
    setBio,
    achievements,
    setAchievements,
    city,
    setCity,
    languages,
    setLanguages,
    // expertise
    sports,
    setSports,
    expertise,
    setExpertise,
    // session
    sessionFee,
    setSessionFee,
    sessionMode,
    setSessionMode,
    inPersonAddress,
    setInPersonAddress,
    sessionDurationMinutes,
    setSessionDurationMinutes,
    // availability
    windows,
    addWindow,
    updateWindow,
    removeWindow,
    blackout,
    setBlackout,
    newBlackout,
    setNewBlackout,
    addBlackout,
    // payout
    taxPayout,
    setTaxPayout,
    agreedToPartnerTerms,
    setAgreedToPartnerTerms,
  };
}

export type ExpertOnboardingState = ReturnType<typeof useExpertOnboarding>;
