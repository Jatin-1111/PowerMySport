"use client";

import { useState, useCallback } from "react";
import { onboardingApi } from "@/modules/onboarding/services/onboarding";
import {
  PresignedUrl,
  OnboardingStep1Payload,
  OnboardingStep2Payload,
  VenueCoach,
} from "@/modules/onboarding/types/onboarding";
import Step1ContactInfo from "./Step1ContactInfo";
import Step2VenueDetails from "./Step2VenueDetails";
import Step2ImageUpload from "./Step2ImageUpload";
import Step3DocumentUpload from "./Step3DocumentUpload";
import Step5CoachList from "./Step5CoachList";

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

interface UploadedImage {
  key: string;
  url: string;
}

interface UploadedDoc {
  type: string;
  fileName: string;
  url: string;
}

export default function OnboardingContainer() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [venueId, setVenueId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

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

  // ============ STEP 1: Submit contact info ============
  const handleStep1SubmitContactInfo = useCallback(
    async (data: OnboardingStep1Payload): Promise<{ venueId: string }> => {
      setGlobalError("");
      setLoading(true);

      try {
        const response = await onboardingApi.submitContactInfo(data);

        if (!response.success || !response.data) {
          throw new Error(response.message || "Failed to save contact info");
        }

        const newVenueId = response.data.venueId || (response.data as any)._id;
        setVenueId(newVenueId);
        setContactInfo(data);
        setCurrentStep(2);
        return { venueId: newVenueId };
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : "Failed to proceed",
        );
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ============ STEP 2: Submit venue details ============
  const handleStep2SubmitVenueDetails = useCallback(
    async (data: OnboardingStep2Payload) => {
      setGlobalError("");
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
          5, // min 5 images
          0, // first image as cover
        );

        if (!imageUrlsResponse.success || !imageUrlsResponse.data) {
          throw new Error("Failed to generate image upload URLs");
        }

        setImagePresignedUrls(imageUrlsResponse.data.uploadUrls || []);
        setCurrentStep(3);
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : "Failed to proceed",
        );
      } finally {
        setLoading(false);
      }
    },
    [venueId],
  );

  // ============ STEP 3: Confirm images and get document URLs ============
  const handleStep3ImagesConfirmed = useCallback(
    async (images: string[], coverPhotoUrl: string) => {
      setGlobalError("");
      setLoading(true);

      try {
        if (!venueId) throw new Error("Venue ID not found");

        // images is now array of strings (URLs)
        // Confirm images with server (images is now array of strings)
        const confirmResponse = await onboardingApi.confirmImagesStep3({
          venueId,
          images,
          coverPhotoUrl,
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
        setGlobalError(
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
      setGlobalError("");
      setLoading(true);

      try {
        if (!venueId) throw new Error("Venue ID not found");

        setUploadedDocuments(documents);

        // Finalize onboarding
        const finalizeResponse = await onboardingApi.finalizeOnboarding({
          venueId,
          images: uploadedImages.map((img) => img.url),
          coverPhotoUrl: uploadedImages[0]?.url || "",
          documents: documents.map((doc) => ({
            type: doc.type as any,
            url: doc.url,
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
          setSuccessMessage(
            "Congratulations! Your venue has been submitted for approval. You'll receive an email at " +
              contactInfo?.ownerEmail +
              " once our admin team reviews your submission.",
          );

          // Reset for next submission
          setTimeout(() => {
            setCurrentStep(1);
            setVenueId("");
            setContactInfo(null);
            setVenueDetails(null);
            setUploadedImages([]);
            setUploadedDocuments([]);
            setImagePresignedUrls([]);
            setDocumentPresignedUrls([]);
            setSuccessMessage("");
            setHasCoaches(false);
          }, 3000);
        }
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : "Failed to finalize onboarding",
        );
      } finally {
        setLoading(false);
      }
    },
    [venueId, uploadedImages, contactInfo?.ownerEmail, hasCoaches],
  );

  // ============ STEP 5: Finalize with coaches (optional) ============
  const handleStep5CoachesFinalized = useCallback(
    async (coaches: VenueCoach[]) => {
      setGlobalError("");
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

        setSuccessMessage(
          "Congratulations! Your venue has been submitted for approval. You'll receive an email at " +
            contactInfo?.ownerEmail +
            " once our admin team reviews your submission.",
        );

        // Reset for next submission
        setTimeout(() => {
          setCurrentStep(1);
          setVenueId("");
          setContactInfo(null);
          setVenueDetails(null);
          setUploadedImages([]);
          setUploadedDocuments([]);
          setImagePresignedUrls([]);
          setDocumentPresignedUrls([]);
          setSuccessMessage("");
          setHasCoaches(false);
        }, 3000);
      } catch (err) {
        setGlobalError(
          err instanceof Error ? err.message : "Failed to finalize onboarding",
        );
      } finally {
        setLoading(false);
      }
    },
    [venueId, contactInfo?.ownerEmail],
  );

  // ============ SKIP HANDLERS (Dev Mode) ============
  const handleSkipStep1 = useCallback(async () => {
    setGlobalError("");
    setLoading(true);
    try {
      const dummyData: OnboardingStep1Payload = {
        ownerName: "Dev User",
        // Use unique email for each skip to avoid conflicts
        ownerEmail: `dev+${Date.now()}@example.com`,
        ownerPhone: "+919876543210",
      };
      const result = await handleStep1SubmitContactInfo(dummyData);
      setVenueId(result.venueId);
    } catch (err) {
      console.error("Skip step 1 error:", err);
      setGlobalError(
        err instanceof Error ? err.message : "Failed to skip step 1",
      );
    } finally {
      setLoading(false);
    }
  }, [handleStep1SubmitContactInfo]);

  const handleSkipStep2 = useCallback(async () => {
    setGlobalError("");
    setLoading(true);
    try {
      const dummyData: OnboardingStep2Payload = {
        venueId,
        name: "Dev Venue",
        sports: ["Cricket"],
        pricePerHour: 500,
        amenities: ["Parking", "Restroom"],
        address: "123 Dev Street, Dev City",
        openingHours: "9:00 AM - 9:00 PM",
        description: "Development venue",
        allowExternalCoaches: true,
        hasCoaches: true, // When skipping Step 2, assume in-house coaches for dev
        location: {
          type: "Point",
          coordinates: [77.2, 28.7],
        },
      };
      await handleStep2SubmitVenueDetails(dummyData);
    } catch (err) {
      console.error("Skip step 2 error:", err);
      setGlobalError(
        err instanceof Error ? err.message : "Failed to skip step 2",
      );
    } finally {
      setLoading(false);
    }
  }, [venueId, handleStep2SubmitVenueDetails]);

  const handleSkipStep3 = useCallback(async () => {
    setGlobalError("");
    setLoading(true);
    try {
      if (!venueId) throw new Error("Venue ID not found");

      const dummyImageUrl =
        "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800";
      const dummyImages = [
        dummyImageUrl,
        dummyImageUrl,
        dummyImageUrl,
        dummyImageUrl,
        dummyImageUrl,
      ];

      // Confirm images
      const confirmResponse = await onboardingApi.confirmImagesStep3({
        venueId,
        images: dummyImages,
        coverPhotoUrl: dummyImageUrl,
      });

      if (!confirmResponse.success || !confirmResponse.data) {
        throw new Error("Failed to confirm images");
      }

      setUploadedImages(dummyImages.map((url) => ({ key: url, url })));

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
      setGlobalError(
        err instanceof Error ? err.message : "Failed to skip step 3",
      );
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  const handleSkipStep4 = useCallback(async () => {
    setGlobalError("");
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
          fileName: "ownership_proof.pdf",
        },
        {
          type: "BUSINESS_REGISTRATION" as const,
          url: "https://via.placeholder.com/150?text=Business+Reg",
          fileName: "business_registration.pdf",
        },
      ];

      // Finalize onboarding with dummy documents
      const finalizeResponse = await onboardingApi.finalizeOnboarding({
        venueId,
        images: imagesToSubmit,
        coverPhotoUrl,
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
        setSuccessMessage(
          "Dev Mode: Venue skipped to approval. You'll receive an email at " +
            contactInfo?.ownerEmail +
            " once our admin team reviews your submission.",
        );

        // Reset for next submission
        setTimeout(() => {
          setCurrentStep(1);
          setVenueId("");
          setContactInfo(null);
          setVenueDetails(null);
          setUploadedImages([]);
          setUploadedDocuments([]);
          setImagePresignedUrls([]);
          setDocumentPresignedUrls([]);
          setSuccessMessage("");
          setHasCoaches(false);
        }, 3000);
      }
    } catch (err) {
      console.error("Skip step 4 error:", err);
      setGlobalError(
        err instanceof Error ? err.message : "Failed to skip step 4",
      );
    } finally {
      setLoading(false);
    }
  }, [venueId, uploadedImages, contactInfo?.ownerEmail, hasCoaches]);
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
      setGlobalError("");
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
      // Reset everything
      setCurrentStep(1);
      setVenueId("");
      setContactInfo(null);
      setVenueDetails(null);
      setUploadedImages([]);
      setUploadedDocuments([]);
      setImagePresignedUrls([]);
      setDocumentPresignedUrls([]);
      setGlobalError("");
      setHasCoaches(false);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            List Your Venue
          </h1>
          <p className="text-gray-600">
            Complete these 4 steps to get your venue on PowerMySport
          </p>
        </div>

        {/* Global Error */}
        {globalError && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start justify-between">
            <span>{globalError}</span>
            <button
              onClick={() => setGlobalError("")}
              className="text-red-500 hover:text-red-700"
            >
              ?
            </button>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div className="max-w-3xl mx-auto mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            <p className="font-medium">{successMessage}</p>
            <button
              onClick={() => {
                setSuccessMessage("");
                window.location.href = "/";
              }}
              className="mt-3 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Return Home
            </button>
          </div>
        )}

        {/* Progress Bar */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={`step-${step}`}
                className="flex flex-col items-center flex-1"
              >
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition ${
                    step < currentStep
                      ? "bg-green-500 text-white"
                      : step === currentStep
                        ? "bg-blue-600 text-white"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {step < currentStep ? "?" : step}
                </div>
                <span className="text-sm mt-2 text-gray-600 text-center">
                  {step === 1 && "Your Info"}
                  {step === 2 && "Venue Details"}
                  {step === 3 && "Photos"}
                  {step === 4 && "Documents"}
                  {step === 5 && "Coaches"}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step Content */}
        <div className="max-w-3xl mx-auto">
          {currentStep === 1 && (
            <Step1ContactInfo
              onContactInfoSubmit={handleStep1SubmitContactInfo}
              loading={loading}
              onSkip={handleSkipStep1}
            />
          )}

          {currentStep === 2 && venueId && (
            <div>
              <Step2VenueDetails
                venueId={venueId}
                onSubmit={handleStep2SubmitVenueDetails}
                loading={loading}
                error={globalError}
                onSkip={handleSkipStep2}
              />
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  ? Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <Step2ImageUpload
                venueId={venueId}
                presignedUrls={imagePresignedUrls}
                onImagesConfirmed={handleStep3ImagesConfirmed}
                loading={loading}
                error={globalError}
                onSkip={handleSkipStep3}
              />
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  ? Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <Step3DocumentUpload
                venueId={venueId}
                presignedUrls={documentPresignedUrls}
                onDocumentsFinalized={handleStep4DocumentsFinalized}
                loading={loading}
                error={globalError}
                onSkip={handleSkipStep4}
              />
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  ? Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <Step5CoachList
                onFinalize={handleStep5CoachesFinalized}
                loading={loading}
                error={globalError}
              />
              <div className="mt-6 flex gap-4">
                <button
                  onClick={handleBack}
                  disabled={loading}
                  className="flex-1 py-3 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  ? Back
                </button>
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="flex-1 py-3 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="max-w-3xl mx-auto mt-12 text-center text-sm text-gray-600">
          <p>
            Need help? Contact us at{" "}
            <a
              href="mailto:support@powermysport.com"
              className="text-blue-600 hover:underline"
            >
              support@powermysport.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
