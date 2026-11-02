import type {
  AcademyCoachesPayload,
  AcademyPayoutsPayload,
  AcademyPricingPayload,
  AcademyStep1Payload,
  AcademyStep2Payload,
  AcademyStep3Payload,
  AcademyVenuesPayload,
  OnboardingAcademy,
} from "@/modules/onboarding/types/academy";

/** What each step's form starts with, rebuilt from the academy the server holds. */
export interface AcademyFormData {
  step1?: AcademyStep1Payload;
  step2?: AcademyStep2Payload;
  step3?: AcademyStep3Payload;
  step4?: AcademyVenuesPayload;
  step5?: AcademyCoachesPayload;
  step6?: AcademyPricingPayload;
  step7?: Pick<AcademyPayoutsPayload, "payoutFrequency" | "cancellationPolicy" | "refundPolicy">;
}

type SavedAcademy = OnboardingAcademy & {
  academyVenues?: AcademyVenuesPayload["academyVenues"];
  academyCoaches?: AcademyCoachesPayload["academyCoaches"];
};

/**
 * `savedStep` is the server's `onboardingStep`: the highest step already saved.
 * A step's form is only filled in when that step was saved. Payout details are
 * never read back: only the frequency and the policies are.
 */
export const formDataFromAcademy = (
  academy: SavedAcademy,
  academyId: string,
  savedStep: number
): AcademyFormData => {
  const data: AcademyFormData = {};

  if (savedStep >= 1) {
    data.step1 = {
      ownerName: academy.contactPersonName || "",
      ownerEmail: academy.contactEmail || "",
      ownerPhone: academy.contactPhone || "",
      name: academy.name,
      legalName: academy.legalName,
      sports: academy.sports,
      ageGroups: academy.ageGroups,
      establishedYear: academy.establishedYear,
      description: academy.description || "",
      logoUrl: academy.logoUrl,
      logoKey: academy.logoKey,
    };
  }

  if (savedStep >= 2) {
    data.step2 = {
      academyId,
      location: academy.location || { type: "Point", coordinates: [0, 0] },
      address: academy.address || "",
      city: academy.city || "",
      state: academy.state || "",
      pincode: academy.pincode || "",
      placeId: academy.placeId,
      contactPersonName: academy.contactPersonName || "",
      contactPhone: academy.contactPhone || "",
      contactEmail: academy.contactEmail || "",
      whatsappNumber: academy.whatsappNumber || "",
      languagesSpoken: academy.languagesSpoken || [],
    };
  }

  if (savedStep >= 3) {
    data.step3 = {
      academyId,
      businessType: academy.businessType || "sole_proprietorship",
      panNumber: academy.panNumber || "",
      panDocumentUrl: academy.panDocumentUrl || "",
      panDocumentKey: academy.panDocumentKey || "",
      gstNumber: academy.gstNumber,
      gstDocumentUrl: academy.gstDocumentUrl,
      gstDocumentKey: academy.gstDocumentKey,
      aadhaarLast4: academy.aadhaarLast4 || "",
    };
  }

  if (savedStep >= 4 && academy.academyVenues?.length) {
    data.step4 = { academyVenues: academy.academyVenues };
  }

  if (savedStep >= 5 && academy.academyCoaches?.length) {
    data.step5 = { academyCoaches: academy.academyCoaches };
  }

  if (savedStep >= 6 && academy.sessionRatePerHour) {
    data.step6 = {
      sessionRatePerHour: academy.sessionRatePerHour,
      batchTimings: academy.batchTimings || [],
      maxBatchSize: academy.maxBatchSize || 20,
      trialsessionOffered: academy.trialsessionOffered ?? false,
      ...(academy.trialsessionOffered ? { trialSessionPrice: academy.trialSessionPrice ?? 0 } : {}),
    };
  }

  if (savedStep >= 7) {
    data.step7 = {
      payoutFrequency: academy.payoutFrequency || "monthly",
      cancellationPolicy: academy.cancellationPolicy || "",
      refundPolicy: academy.refundPolicy || "",
    };
  }

  return data;
};

/** True when payout details were saved earlier, so step 7 can say why its fields are empty. */
export const payoutDetailsWereSaved = (academy: OnboardingAcademy): boolean =>
  Boolean(academy.bankAccountNumber || academy.upiId);
