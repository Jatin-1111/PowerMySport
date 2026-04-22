"use client";

import { toast } from "@/lib/toast";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import {
  OnboardingStep1Payload,
  OnboardingStep2Payload,
  PresignedUrl,
  VenueCoach,
} from "@/modules/onboarding/types/onboarding";
import { ArrowLeft, Check, CircleDot } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getDefaultOpeningHours } from "./OpeningHoursInput";
import Step1ContactInfo from "./Step1ContactInfo";
import Step2ImageUpload from "./Step2ImageUpload";
import Step2VenueDetails from "./Step2VenueDetails";
import Step3DocumentUpload from "./Step3DocumentUpload";
import Step5CoachList from "./Step5CoachList";
import EmailVerificationModal from "./EmailVerificationModal";

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const STEP_META: Array<{ step: OnboardingStep; label: string; hint: string }> =
  [
    { step: 1, label: "Your Info", hint: "Contact details and verification" },
    { step: 2, label: "Venue Details", hint: "Address, sports, and pricing" },
    { step: 3, label: "Photos", hint: "Upload high-quality venue visuals" },
    { step: 4, label: "Documents", hint: "Business and compliance documents" },
    { step: 5, label: "Coaches", hint: "Optional in-house team setup" },
  ];

function OnboardingContainerSkeleton() {
  return (
    <div className="min-h-screen py-10 md:py-12" aria-hidden="true">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mx-auto h-10 w-64 animate-pulse rounded-xl bg-slate-200" />
          <div className="mx-auto mt-3 h-5 w-80 animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="mx-auto mb-8 max-w-4xl rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-xs">
          <div className="relative mb-4 overflow-x-auto">
            <div className="relative min-w-180">
              <div className="absolute left-6 right-6 top-6 h-0.5 rounded-full bg-slate-100" />
              <div className="grid grid-cols-5 gap-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`step-skeleton-${index}`} className="text-center">
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-slate-200 ring-4 ring-white" />
                    <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
                    <div className="mx-auto mt-1 h-2 w-20 animate-pulse rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full animate-pulse rounded-full bg-slate-100" />
        </div>
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-xs">
          <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 space-y-4">
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="mt-6 h-12 w-full animate-pulse rounded-xl bg-power-orange/25" />
        </div>
      </div>
    </div>
  );
}

interface UploadedImage {
  key: string; // S3 key for regenerating presigned URLs
  url: string; // Current presigned URL (expires in 7 days)
}

interface UploadedDoc {
  type: string;
  fileName: string;
  url: string; // Current presigned URL (expires in 24 hours)
  s3Key: string; // S3 key for regenerating presigned URLs
}

export default function OnboardingContainer() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [isBooting, setIsBooting] = useState(true);
  const [isStepVisible, setIsStepVisible] = useState(false);
  const [venueId, setVenueId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState<string>("");

  // Step 1: Contact Info
  const [contactInfo, setContactInfo] = useState<OnboardingStep1Payload | null>(
    null,
  );

  // Step 2: Venue Details
  const [venueDetails, setVenueDetails] =
    useState<OnboardingStep2Payload | null>(null);
  const [hasCoaches, setHasCoaches] = useState(false);

  // Step 3: Images
  const [imagePresignedUrls, setImagePresignedUrls] = useState<PresignedUrl[]>(
    [],
  );
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // Step 4: Documents
  const [documentPresignedUrls, setDocumentPresignedUrls] = useState<
    PresignedUrl[]
  >([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDoc[]>([]);

  const resetOnboardingFlow = useCallback(() => {
    setCurrentStep(1);
    setVenueId("");
    setContactInfo(null);
    setVenueDetails(null);
    setUploadedImages([]);
    setUploadedDocuments([]);
    setImagePresignedUrls([]);
    setDocumentPresignedUrls([]);
    setHasCoaches(false);
    setShowEmailVerification(false);
    setEmailToVerify("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsBooting(false);
      setIsStepVisible(true);
    }, 450);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isBooting) {
      return;
    }

    setIsStepVisible(false);
    const frame = window.requestAnimationFrame(() => {
      setIsStepVisible(true);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });

    return () => window.cancelAnimationFrame(frame);
  }, [currentStep, isBooting]);

  // ============ STEP 1: Submit contact info ============
  const handleStep1SubmitContactInfo = useCallback(
    async (data: OnboardingStep1Payload): Promise<{ venueId: string }> => {
      setLoading(true);

      try {
        const response = await onboardingApi.submitContactInfo(data);

        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to save contact info");
        }

        const newVenueId = response.data.venueId || (response.data as any)._id;
        setVenueId(newVenueId);
        setContactInfo(data);

        // Show email verification modal instead of proceeding directly
        setEmailToVerify(data.ownerEmail);
        setShowEmailVerification(true);

        return { venueId: newVenueId };
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to proceed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ============ Email Verification ============
  const handleEmailVerified = useCallback(() => {
    setShowEmailVerification(false);
    setCurrentStep(2);
    toast.success("Email verified successfully!");
  }, []);

  const handleEmailVerificationClose = useCallback(() => {
    setShowEmailVerification(false);
    // Reset to step 1 if email verification is closed
    setCurrentStep(1);
    setVenueId("");
    setContactInfo(null);
  }, []);

  // ============ STEP 2: Submit venue details ============
  const handleStep2SubmitVenueDetails = useCallback(
    async (data: OnboardingStep2Payload) => {
      setLoading(true);

      try {
        const response = await onboardingApi.submitVenueDetails(data);

        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to save venue details");
        }

        console.log("Step 2 submitted with hasCoaches:", data.hasCoaches);
        setVenueDetails(data);
        setHasCoaches(data.hasCoaches);

        // Get image presigned URLs for step 3
        const imageUrlsResponse = await onboardingApi.getImageUploadUrls(
          venueId,
          data.sports, // Pass sports array for categorized image upload
        );

        if (!imageUrlsResponse.success || !imageUrlsResponse.data) {
          throw new Error("Failed to generate image upload URLs");
        }

        setImagePresignedUrls(imageUrlsResponse.data.uploadUrls || []);
        setCurrentStep(3);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to proceed");
      } finally {
        setLoading(false);
      }
    },
    [venueId],
  );

  // ============ STEP 3: Confirm images and get document URLs ============
  const handleStep3ImagesConfirmed = useCallback(
    async (
      generalImages: string[],
      generalImageKeys: string[],
      sportImages: Record<string, string[]>,
      sportImageKeys: Record<string, string[]>,
      coverPhotoUrl: string,
      coverPhotoKey: string,
    ) => {
      setLoading(true);

      try {
        if (!venueId) throw new Error("Venue ID not found");

        // Store uploaded images (flatten for legacy compatibility)
        const allImages = [
          ...generalImages,
          ...Object.values(sportImages).flat(),
        ];
        const allKeys = [
          ...generalImageKeys,
          ...Object.values(sportImageKeys).flat(),
        ];
        const uploadedImagesData: UploadedImage[] = allImages.map(
          (url, index) => ({
            key: allKeys[index],
            url,
          }),
        );
        setUploadedImages(uploadedImagesData);

        // Confirm images with server (sport-specific structure)
        const confirmResponse = await onboardingApi.confirmImagesStep3({
          venueId,
          images: [], // Legacy field (empty for new structure)
          imageKeys: [], // Legacy field (empty for new structure)
          generalImages,
          generalImageKeys,
          sportImages,
          sportImageKeys,
          coverPhotoUrl,
          coverPhotoKey,
        });

        if (!confirmResponse.success) {
          throw new Error(
            confirmResponse.message || "Failed to confirm images",
          );
        }

        // Get document presigned URLs for step 4
        const docTypes = [
          {
            type: "OWNERSHIP_PROOF",
            fileName: "ownership.pdf",
            contentType: "application/pdf",
          },
          {
            type: "BUSINESS_REGISTRATION",
            fileName: "registration.pdf",
            contentType: "application/pdf",
          },
          {
            type: "TAX_DOCUMENT",
            fileName: "tax.pdf",
            contentType: "application/pdf",
          },
          {
            type: "INSURANCE",
            fileName: "insurance.pdf",
            contentType: "application/pdf",
          },
          {
            type: "CERTIFICATE",
            fileName: "certificate.pdf",
            contentType: "application/pdf",
          },
        ];

        const docUrlsResponse = await onboardingApi.getDocumentUploadUrls(
          venueId,
          docTypes,
        );

        if (!docUrlsResponse.success || !docUrlsResponse.data) {
          throw new Error("Failed to generate document upload URLs");
        }

        setDocumentPresignedUrls(docUrlsResponse.data.uploadUrls || []);
        setCurrentStep(4);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to proceed to next step",
        );
      } finally {
        setLoading(false);
      }
    },
    [venueId],
  );

  // ============ STEP 4: Finalize with documents ============
  const handleStep4DocumentsFinalized = useCallback(
    async (documents: UploadedDoc[]) => {
      setLoading(true);

      try {
        if (!venueId) throw new Error("Venue ID not found");

        setUploadedDocuments(documents);

        // Finalize onboarding with S3 keys
        const finalizeResponse = await onboardingApi.finalizeOnboarding({
          venueId,
          images: uploadedImages.map((img) => img.url),
          imageKeys: uploadedImages.map((img) => img.key),
          coverPhotoUrl: uploadedImages[0]?.url || "",
          coverPhotoKey: uploadedImages[0]?.key || "",
          documents: documents.map((doc) => ({
            type: doc.type as any,
            url: doc.url,
            s3Key: doc.s3Key,
            fileName: doc.fileName,
          })),
        });

        if (!finalizeResponse.success) {
          throw new Error(
            finalizeResponse.message || "Failed to finalize onboarding",
          );
        }

        // If venue has coaches, go to Step 5, otherwise finalize
        if (hasCoaches) {
          setCurrentStep(5);
        } else {
          toast.success(
            "Congratulations! Your venue has been submitted for approval. You'll receive an email at " +
              contactInfo?.ownerEmail +
              " once our review team reviews your submission.",
          );

          // Reset for next submission
          setTimeout(() => {
            resetOnboardingFlow();
          }, 3000);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to finalize onboarding",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      venueId,
      uploadedImages,
      contactInfo?.ownerEmail,
      hasCoaches,
      resetOnboardingFlow,
    ],
  );

  // ============ STEP 5: Finalize with coaches (optional) ============
  const handleStep5CoachesFinalized = useCallback(
    async (coaches: VenueCoach[]) => {
      setLoading(true);

      try {
        if (!venueId) throw new Error("Venue ID not found");

        // Submit coaches
        const coachesResponse = await onboardingApi.submitCoaches({
          venueId,
          coaches,
        });

        if (!coachesResponse.success) {
          throw new Error(coachesResponse.message || "Failed to save coaches");
        }

        toast.success(
          "Congratulations! Your venue has been submitted for approval. You'll receive an email at " +
            contactInfo?.ownerEmail +
            " once our review team reviews your submission.",
        );

        // Reset for next submission
        setTimeout(() => {
          resetOnboardingFlow();
        }, 3000);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to finalize onboarding",
        );
      } finally {
        setLoading(false);
      }
    },
    [venueId, contactInfo?.ownerEmail, resetOnboardingFlow],
  );

  // ============ SKIP HANDLERS (Dev Mode) ============
  const handleSkipStep1 = useCallback(async () => {
    setLoading(true);
    try {
      const dummyData: OnboardingStep1Payload = {
        ownerName: "Dev User",
        // Use unique email for each skip to avoid conflicts
        ownerEmail: `dev+${Date.now()}@example.com`,
        ownerPhone: "+919876543210",
      };

      const response = await onboardingApi.submitContactInfo(dummyData);
      if (!response.success || !response.data) {
        throw new Error(response.message || "Failed to save contact info");
      }

      const newVenueId = response.data.venueId || (response.data as any)._id;

      setVenueId(newVenueId);
      setContactInfo(dummyData);
      setEmailToVerify(dummyData.ownerEmail);
      setShowEmailVerification(false);
      setCurrentStep(2);
      toast.success("Dev skip: moved to Step 2 without email verification");
    } catch (err) {
      console.error("Skip step 1 error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to skip step 1");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSkipStep2 = useCallback(
    async (hasCoachesOverride?: boolean) => {
      setLoading(true);
      try {
        const dummyData: OnboardingStep2Payload = {
          venueId,
          name: "Dev Venue",
          sports: ["Cricket"],
          pricePerHour: 500,
          amenities: ["Parking", "Restroom"],
          address: "123 Dev Street, Dev City",
          openingHours: getDefaultOpeningHours(),
          description: "Development venue",
          allowExternalCoaches: true,
          hasCoaches: hasCoachesOverride ?? false, // Respect user selection or default to false
          location: {
            type: "Point",
            coordinates: [77.2, 28.7],
          },
        };
        await handleStep2SubmitVenueDetails(dummyData);
      } catch (err) {
        console.error("Skip step 2 error:", err);
        toast.error(
          err instanceof Error ? err.message : "Failed to skip step 2",
        );
      } finally {
        setLoading(false);
      }
    },
    [venueId, handleStep2SubmitVenueDetails],
  );

  const handleSkipStep3 = useCallback(async () => {
    setLoading(true);
    try {
      if (!venueId) throw new Error("Venue ID not found");

      const dummyImageUrl =
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800";

      // Generate structured dummy images (to match validation)
      const generalImages = [dummyImageUrl, dummyImageUrl, dummyImageUrl];
      const generalImageKeys = [
        "dev/dummy-general-1.jpg",
        "dev/dummy-general-2.jpg",
        "dev/dummy-general-3.jpg",
      ];

      const sportImages: Record<string, string[]> = {};
      const sportImageKeys: Record<string, string[]> = {};

      // Generate 5 images per sport
      // Use sports from venue details or fallback to Cricket (for robustness)
      const sportsToUse =
        venueDetails?.sports && venueDetails.sports.length > 0
          ? venueDetails.sports
          : ["Cricket"];

      sportsToUse.forEach((sport) => {
        sportImages[sport] = Array(5).fill(dummyImageUrl);
        sportImageKeys[sport] = Array(5).fill(`dev/dummy-${sport}-1.jpg`);
      });

      // Flatten for legacy state compatibility
      const dummyImages = [
        ...generalImages,
        ...Object.values(sportImages).flat(),
      ];
      const dummyImageKeys = [
        ...generalImageKeys,
        ...Object.values(sportImageKeys).flat(),
      ];

      // Confirm images
      const confirmResponse = await onboardingApi.confirmImagesStep3({
        venueId,
        images: [], // Legacy field (empty for new structure)
        imageKeys: [], // Legacy field (empty for new structure)
        generalImages,
        generalImageKeys,
        sportImages,
        sportImageKeys,
        coverPhotoUrl: dummyImageUrl,
        coverPhotoKey: generalImageKeys[0],
      });

      if (!confirmResponse.success || !confirmResponse.data) {
        throw new Error("Failed to confirm images");
      }

      setUploadedImages(
        dummyImages.map((url, i) => ({ key: dummyImageKeys[i], url })),
      );

      // Get document presigned URLs for step 4
      const docUrlsResponse = await onboardingApi.getDocumentUploadUrls(
        venueId,
        [
          {
            type: "OWNERSHIP_PROOF",
            fileName: "ownership.pdf",
            contentType: "application/pdf",
          },
          {
            type: "BUSINESS_REGISTRATION",
            fileName: "registration.pdf",
            contentType: "application/pdf",
          },
          {
            type: "TAX_DOCUMENT",
            fileName: "tax.pdf",
            contentType: "application/pdf",
          },
          {
            type: "INSURANCE",
            fileName: "insurance.pdf",
            contentType: "application/pdf",
          },
          {
            type: "CERTIFICATE",
            fileName: "certificate.pdf",
            contentType: "application/pdf",
          },
        ],
      );

      if (!docUrlsResponse.success || !docUrlsResponse.data) {
        throw new Error("Failed to generate document upload URLs");
      }

      setDocumentPresignedUrls(docUrlsResponse.data.uploadUrls || []);
      setCurrentStep(4);
    } catch (err) {
      console.error("Skip step 3 error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to skip step 3");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const handleSkipStep4 = useCallback(async () => {
    setLoading(true);
    try {
      if (!venueId) throw new Error("Venue ID not found");

      // Use dummy images if none uploaded (for skip case)
      const dummyImageUrl =
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800";
      const imagesToSubmit =
        uploadedImages.length > 0
          ? uploadedImages.map((img) => img.url)
          : [
              dummyImageUrl,
              dummyImageUrl,
              dummyImageUrl,
              dummyImageUrl,
              dummyImageUrl,
            ];

      const coverPhotoUrl = uploadedImages[0]?.url || dummyImageUrl;

      // Create dummy documents for dev skip (backend requires at least 1 document)
      const dummyDocuments = [
        {
          type: "OWNERSHIP_PROOF" as const,
          url: "https://via.placeholder.com/150?text=Ownership+Proof",
          s3Key: "dev/dummy-ownership-proof.pdf",
          fileName: "ownership_proof.pdf",
        },
        {
          type: "BUSINESS_REGISTRATION" as const,
          url: "https://via.placeholder.com/150?text=Business+Reg",
          s3Key: "dev/dummy-business-registration.pdf",
          fileName: "business_registration.pdf",
        },
      ];

      // Finalize onboarding with dummy documents
      const finalizeResponse = await onboardingApi.finalizeOnboarding({
        venueId,
        images: imagesToSubmit,
        imageKeys:
          uploadedImages.length > 0
            ? uploadedImages.map((img) => img.key)
            : [
                "dev/dummy-image-1.jpg",
                "dev/dummy-image-2.jpg",
                "dev/dummy-image-3.jpg",
                "dev/dummy-image-4.jpg",
                "dev/dummy-image-5.jpg",
              ],
        coverPhotoUrl,
        coverPhotoKey: uploadedImages[0]?.key || "dev/dummy-image-1.jpg",
        documents: dummyDocuments,
      });

      if (!finalizeResponse.success) {
        throw new Error(
          finalizeResponse.message || "Failed to finalize onboarding",
        );
      }

      // If venue has coaches, go to Step 5, otherwise finalize
      console.log("Step 4 skipped - hasCoaches is:", hasCoaches);
      if (hasCoaches) {
        console.log("Routing to Step 5 (coaches)");
        setCurrentStep(5);
      } else {
        console.log("Showing success message (no coaches)");
        toast.success(
          "Dev Mode: Venue skipped to approval. You'll receive an email at " +
            contactInfo?.ownerEmail +
            " once our review team reviews your submission.",
        );

        // Reset for next submission
        setTimeout(() => {
          resetOnboardingFlow();
        }, 3000);
      }
    } catch (err) {
      console.error("Skip step 4 error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to skip step 4");
    } finally {
      setLoading(false);
    }
  }, [
    venueId,
    uploadedImages,
    contactInfo?.ownerEmail,
    hasCoaches,
    resetOnboardingFlow,
  ]);
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
    }
  }, [currentStep]);

  const handleCancel = useCallback(async () => {
    if (!venueId) return;

    const confirmed = confirm(
      "Are you sure you want to cancel? Your progress will be lost.",
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await onboardingApi.cancelOnboarding(venueId);
      resetOnboardingFlow();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  }, [venueId, resetOnboardingFlow]);

  const handleStepJump = useCallback(
    (targetStep: OnboardingStep) => {
      if (loading) return;
      if (targetStep >= currentStep) return;
      setCurrentStep(targetStep);
    },
    [loading, currentStep],
  );

  if (isBooting) {
    return <OnboardingContainerSkeleton />;
  }

  const activeStepMeta = STEP_META.find((item) => item.step === currentStep);
  const totalSteps = STEP_META.length;
  const completedSteps = Math.max(0, currentStep - 1);
  const progressPercent = (completedSteps / (totalSteps - 1)) * 100;
  const stepsRemaining = totalSteps - currentStep;
  const activeStepSummary = activeStepMeta?.label ?? `Step ${currentStep}`;

  const renderStepActionBar = () => (
    <div className="mt-6 flex gap-4">
      <button
        onClick={handleBack}
        disabled={loading}
        className="flex-1 py-3 bg-slate-100 text-slate-800 font-medium rounded-xl hover:bg-slate-200 disabled:opacity-50 flex items-center justify-center gap-2 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="flex-1 py-3 bg-red-50 text-red-700 font-medium rounded-xl hover:bg-red-100 disabled:opacity-50 transition"
      >
        Cancel
      </button>
    </div>
  );

  return (
    <div className="min-h-screen py-10 md:py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            List Your Venue
          </h1>
          <p className="text-slate-600">
            Complete these 5 steps to get your venue on PowerMySport
          </p>
          {activeStepMeta && (
            <p className="mt-3 inline-flex items-center rounded-full border border-power-orange/20 bg-power-orange/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-power-orange">
              Step {currentStep} of 5
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {Math.round(progressPercent)}% complete • {stepsRemaining} step
            {stepsRemaining === 1 ? "" : "s"} remaining
          </p>
        </div>

        {/* Progress Bar */}
        <div className="sticky top-4 z-20 max-w-4xl mx-auto mb-8 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-xs backdrop-blur-sm">
          <div className="relative mb-4 overflow-x-auto">
            <div className="relative min-w-180 pb-2">
              <div className="absolute left-6 right-6 top-6 h-0.5 rounded-full bg-slate-200" />
              <div
                className="absolute left-6 top-6 h-0.5 rounded-full bg-power-orange transition-all duration-500"
                style={{
                  width: `max(0px, calc(${progressPercent}% - 0.5rem))`,
                }}
              />

              <div className="grid grid-cols-5 gap-2 md:gap-3">
                {STEP_META.map((item) => {
                  const isCompleted = item.step < currentStep;
                  const isActive = item.step === currentStep;
                  const isFuture = item.step > currentStep;
                  const stepStateLabel = isCompleted
                    ? "Done"
                    : isActive
                      ? "Current"
                      : "Upcoming";

                  return (
                    <div
                      key={`step-${item.step}`}
                      className="relative text-center"
                    >
                      <button
                        type="button"
                        onClick={() => handleStepJump(item.step)}
                        disabled={!isCompleted || loading}
                        title={
                          isCompleted
                            ? `Go to ${item.label}`
                            : isFuture
                              ? "Complete previous steps first"
                              : item.label
                        }
                        className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ring-4 ring-white transition-all duration-300 ${
                          isCompleted
                            ? "bg-emerald-500 text-white shadow-md hover:scale-105 cursor-pointer"
                            : isActive
                              ? "bg-linear-to-br from-power-orange to-orange-500 text-white shadow-lg scale-110"
                              : "bg-slate-200 text-slate-600 cursor-not-allowed"
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="h-5 w-5" />
                        ) : isActive ? (
                          <CircleDot className="h-5 w-5" />
                        ) : (
                          `0${item.step}`.slice(-2)
                        )}
                      </button>
                      <div
                        className={`mt-3 rounded-2xl border px-3 py-3 transition-all duration-300 ${
                          isActive
                            ? "border-power-orange/25 bg-linear-to-b from-power-orange/10 to-white shadow-sm"
                            : isCompleted
                              ? "border-emerald-200 bg-emerald-50/70"
                              : "border-slate-200 bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              isActive
                                ? "bg-power-orange/15 text-power-orange"
                                : isCompleted
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-500"
                            }`}
                          >
                            {stepStateLabel}
                          </span>
                        </div>
                        <p
                          className={`mt-2 text-[11px] md:text-xs font-semibold leading-tight ${
                            isActive ? "text-power-orange" : "text-slate-800"
                          }`}
                        >
                          {item.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-power-orange transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>{activeStepSummary}</p>
            <p>
              {completedSteps}/{totalSteps - 1} completed
            </p>
          </div>
        </div>

        {/* Step Content */}
        <div
          className={`max-w-3xl mx-auto transition-all duration-300 ${
            isStepVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2"
          }`}
        >
          {currentStep === 1 && (
            <Step1ContactInfo
              onContactInfoSubmit={handleStep1SubmitContactInfo}
              loading={loading}
              onSkip={handleSkipStep1}
            />
          )}

          {/* Email Verification Modal */}
          {showEmailVerification && venueId && emailToVerify && (
            <EmailVerificationModal
              email={emailToVerify}
              venueId={venueId}
              onVerified={handleEmailVerified}
              onClose={handleEmailVerificationClose}
              showCloseButton={false}
            />
          )}

          {currentStep === 2 && venueId && (
            <div>
              <Step2VenueDetails
                venueId={venueId}
                onSubmit={handleStep2SubmitVenueDetails}
                loading={loading}
                onSkip={handleSkipStep2}
              />
              {renderStepActionBar()}
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <Step2ImageUpload
                venueId={venueId}
                presignedUrls={imagePresignedUrls}
                onImagesConfirmed={handleStep3ImagesConfirmed}
                loading={loading}
                onSkip={handleSkipStep3}
              />
              {renderStepActionBar()}
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <Step3DocumentUpload
                venueId={venueId}
                presignedUrls={documentPresignedUrls}
                onDocumentsFinalized={handleStep4DocumentsFinalized}
                loading={loading}
                onSkip={handleSkipStep4}
              />
              {renderStepActionBar()}
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <Step5CoachList
                venueId={venueId}
                onFinalize={handleStep5CoachesFinalized}
                loading={loading}
              />
              {renderStepActionBar()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="max-w-3xl mx-auto mt-12 text-center text-sm text-slate-600"
          aria-live="polite"
        >
          <p>
            Need help? Contact us at{" "}
            <a
              href="mailto:support@powermysport.com"
              className="text-power-orange hover:underline"
            >
              support@powermysport.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
