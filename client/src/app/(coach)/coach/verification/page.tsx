"use client";

import ProfilePictureUpload from "@/components/ui/ProfilePictureUpload";
import { authApi } from "@/modules/auth/services/auth";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, CoachVerificationDocument, ServiceMode, User } from "@/types";
import { CheckCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type VerificationStep = 1 | 2 | 3;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const SPORTS_OPTIONS = [
  "Cricket",
  "Football",
  "Badminton",
  "Tennis",
  "Basketball",
  "Volleyball",
  "Table Tennis",
  "Swimming",
  "Hockey",
  "Kabaddi",
];

const getInitialServiceMode = (): ServiceMode => {
  if (typeof window === "undefined") {
    return "FREELANCE";
  }

  const savedMode = localStorage.getItem("coachServiceMode");
  if (
    savedMode === "OWN_VENUE" ||
    savedMode === "FREELANCE" ||
    savedMode === "HYBRID"
  ) {
    return savedMode;
  }

  return "FREELANCE";
};

const isValidMobileNumber = (value: string) =>
  /^[+]?[0-9\s().\-]+$/.test(value.trim());

const sanitizeMobileNumber = (value: string) =>
  value.replace(/[^0-9+\s().\-]/g, "");

const getVerificationBadge = (coachData: Coach | null) => {
  if (!coachData) {
    return {
      label: "Not Started",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
    };
  }

  const status =
    coachData.verificationStatus ||
    (coachData.isVerified ? "VERIFIED" : "UNVERIFIED");

  switch (status) {
    case "VERIFIED":
      return {
        label: "Verified",
        className: "bg-green-100 text-green-700 border border-green-200",
      };
    case "PENDING":
      return {
        label: "Pending Review",
        className: "bg-yellow-100 text-yellow-700 border border-yellow-200",
      };
    case "REVIEW":
      return {
        label: "In Review",
        className: "bg-blue-100 text-blue-700 border border-blue-200",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        className: "bg-red-100 text-red-700 border border-red-200",
      };
    default:
      return {
        label: "Not Started",
        className: "bg-slate-100 text-slate-700 border border-slate-200",
      };
  }
};

const getStatusGuidance = (status: string) => {
  switch (status) {
    case "PENDING":
      return "Your verification is submitted and pending admin review. You'll be notified once reviewed.";
    case "REVIEW":
      return "Your verification is currently under review. Edits are temporarily disabled.";
    case "VERIFIED":
      return "You are verified! Redirecting to your profile...";
    case "REJECTED":
      return "Your verification was rejected. Update documents and resubmit.";
    default:
      return "Complete all 3 steps: Profile info, Sports & Pricing, and upload both certification and ID proof documents.";
  }
};

export default function CoachVerificationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(
    null,
  );
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<VerificationStep>(1);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [bio, setBio] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [pricingMode, setPricingMode] = useState<"SAME" | "PER_SPORT">(
    "PER_SPORT",
  );
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [sportPricing, setSportPricing] = useState<Record<string, string>>({});

  const [verificationDocs, setVerificationDocs] = useState<
    CoachVerificationDocument[]
  >([
    { type: "CERTIFICATION", url: "", fileName: "" },
    { type: "ID_PROOF", url: "", fileName: "" },
  ]);

  const status = useMemo(() => {
    if (!coachProfile) {
      return "UNVERIFIED";
    }

    return (
      coachProfile.verificationStatus ||
      (coachProfile.isVerified ? "VERIFIED" : "UNVERIFIED")
    );
  }, [coachProfile]);

  const isLockedByReview =
    status === "PENDING" || status === "REVIEW" || status === "VERIFIED";

  // Redirect verified coaches to profile page
  useEffect(() => {
    if (!loading && status === "VERIFIED") {
      router.push("/coach/profile");
    }
  }, [loading, status, router]);

  const loadProfile = async () => {
    try {
      const [coachResponse, userResponse] = await Promise.all([
        coachApi.getMyProfile(),
        authApi.getProfile(),
      ]);

      if (userResponse.success && userResponse.data) {
        setUser(userResponse.data);
        if (userResponse.data.phone) {
          setMobileNumber(userResponse.data.phone);
        }
      }

      if (coachResponse.success && coachResponse.data) {
        const coach = coachResponse.data;
        setCoachProfile(coach);
        setBio(coach.bio || "");
        setSelectedSports(coach.sports || []);
        setHourlyRateInput(
          coach.hourlyRate && coach.hourlyRate > 0
            ? String(coach.hourlyRate)
            : "",
        );
        setSportPricing(() => {
          const prices: Record<string, string> = {};
          (coach.sports || []).forEach((sport) => {
            const value = coach.sportPricing?.[sport];
            if (typeof value === "number" && value > 0) {
              prices[sport] = String(value);
            } else if (coach.hourlyRate && coach.hourlyRate > 0) {
              prices[sport] = String(coach.hourlyRate);
            } else {
              prices[sport] = "";
            }
          });
          return prices;
        });
        const pricingValues = Object.values(
          (coach.sportPricing || {}) as Record<string, number>,
        );
        const hasPerSport = pricingValues.some((value) => value > 0);
        const allMatchHourly =
          hasPerSport &&
          coach.hourlyRate &&
          pricingValues.every((value) => value === coach.hourlyRate);
        setPricingMode(allMatchHourly ? "SAME" : "PER_SPORT");

        if (coach.verificationDocuments?.length) {
          setVerificationDocs(
            coach.verificationDocuments.map((doc) => ({
              type: doc.type,
              url: doc.url,
              s3Key: doc.s3Key,
              fileName: doc.fileName,
              uploadedAt: doc.uploadedAt,
            })),
          );
        }
      }
    } catch {
      setCoachProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Invalid file type. Upload JPG, PNG, WebP, or PDF only.",
      };
    }

    return { valid: true };
  };

  const handleUploadDocument = async (index: number, file: File) => {
    setError("");
    setSuccess("");

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      return;
    }

    setUploadingDocIndex(index);
    try {
      const currentDoc = verificationDocs[index];
      if (!currentDoc) {
        throw new Error("Document row not found");
      }

      const uploadResponse = await coachApi.getVerificationUploadUrl({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        documentType: currentDoc.type,
      });

      if (!uploadResponse.success || !uploadResponse.data) {
        throw new Error(uploadResponse.message || "Failed to get upload URL");
      }

      const { uploadUrl, downloadUrl, key, fileName } = uploadResponse.data;
      const uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadResult.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      setVerificationDocs((prev) =>
        prev.map((doc, i) =>
          i === index
            ? {
                ...doc,
                url: downloadUrl,
                s3Key: key,
                fileName,
                uploadedAt: new Date().toISOString(),
              }
            : doc,
        ),
      );
      setSuccess(`${fileName} uploaded successfully.`);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed",
      );
    } finally {
      setUploadingDocIndex(null);
    }
  };

  const handleStepOneContinue = () => {
    setError("");
    setSuccess("");

    if (!bio.trim()) {
      setError("Bio is required to continue.");
      return;
    }

    if (!mobileNumber.trim()) {
      setError("Mobile number is required to continue.");
      return;
    }

    if (!isValidMobileNumber(mobileNumber)) {
      setError("Please provide a valid mobile number.");
      return;
    }

    setSaving(true);
    void (async () => {
      try {
        const response = await coachApi.saveVerificationStep1({
          bio: bio.trim(),
          mobileNumber: mobileNumber.trim(),
        });

        if (!response.success) {
          throw new Error(response.message || "Failed to save step 1");
        }

        if (response.data && "sports" in response.data) {
          setCoachProfile(response.data as Coach);
        }

        setStep(2);
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Failed to save step 1",
        );
      } finally {
        setSaving(false);
      }
    })();
  };

  const handleStepTwoContinue = async () => {
    setError("");
    setSuccess("");

    const sports = selectedSports;
    if (sports.length === 0) {
      setError("Please add at least one sport you can teach.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      const hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        setError("Please add a valid hourly price greater than 0.");
        return;
      }
      for (const sport of sports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          setError(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
    }

    const hourlyRate = Math.max(...Object.values(pricingPayload));

    setSaving(true);
    try {
      const step2Response = await coachApi.saveVerificationStep2({
        bio: bio.trim(),
        sports,
        certifications: [],
        hourlyRate,
        sportPricing: pricingPayload,
        serviceMode: getInitialServiceMode(),
      });

      if (!step2Response.success || !step2Response.data) {
        throw new Error(step2Response.message || "Failed to save step 2");
      }

      setCoachProfile(step2Response.data);
      localStorage.removeItem("coachServiceMode");
      setStep(3);
      setSuccess("Step 2 completed. Now upload your certification documents.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save your profile details",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitVerification = async () => {
    setError("");
    setSuccess("");

    const sports = selectedSports;
    let hourlyRate = 0;

    if (!bio.trim()) {
      setError("Bio is required.");
      return;
    }

    if (sports.length === 0) {
      setError("Please add at least one sport.");
      return;
    }

    const pricingPayload: Record<string, number> = {};
    if (pricingMode === "SAME") {
      hourlyRate = Number(hourlyRateInput);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        setError("Please add a valid hourly price greater than 0.");
        return;
      }
      for (const sport of sports) {
        pricingPayload[sport] = hourlyRate;
      }
    } else {
      for (const sport of sports) {
        const value = Number(sportPricing[sport]);
        if (!Number.isFinite(value) || value <= 0) {
          setError(`Please add a valid price for ${sport}.`);
          return;
        }
        pricingPayload[sport] = value;
      }
      hourlyRate = Math.max(...Object.values(pricingPayload));
    }

    const invalidDoc = verificationDocs.find(
      (doc) => !doc.url.trim() || !doc.fileName.trim(),
    );
    if (invalidDoc) {
      setError("Please upload a file for each listed document.");
      return;
    }

    const hasCertificationDoc = verificationDocs.some(
      (doc) => doc.type === "CERTIFICATION",
    );
    if (!hasCertificationDoc) {
      setError("At least one uploaded document must be a CERTIFICATION.");
      return;
    }

    const hasIdProofDoc = verificationDocs.some(
      (doc) => doc.type === "ID_PROOF",
    );
    if (!hasIdProofDoc) {
      setError("At least one uploaded document must be an ID_PROOF.");
      return;
    }

    setSaving(true);
    try {
      const step2SyncResponse = await coachApi.saveVerificationStep2({
        bio: bio.trim(),
        sports,
        certifications: [],
        hourlyRate,
        sportPricing: pricingPayload,
        serviceMode: getInitialServiceMode(),
      });

      if (!step2SyncResponse.success || !step2SyncResponse.data) {
        throw new Error(step2SyncResponse.message || "Failed to sync profile");
      }

      setCoachProfile(step2SyncResponse.data);

      const response = await coachApi.submitVerificationStep3({
        documents: verificationDocs.map((doc) => ({
          type: doc.type,
          url: doc.url.trim(),
          fileName: doc.fileName.trim(),
          s3Key: doc.s3Key,
          uploadedAt: doc.uploadedAt,
        })),
      });

      if (!response.success) {
        throw new Error(response.message || "Verification submission failed");
      }

      setSuccess(
        "Verification submitted successfully. Your profile is now in review.",
      );
      await loadProfile();

      // Redirect to profile page after successful submission
      setTimeout(() => {
        router.push("/coach/profile");
      }, 2000);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit verification",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-white text-center">
        <p className="text-slate-600">Loading verification flow...</p>
      </Card>
    );
  }

  const badge = getVerificationBadge(coachProfile);
  const guidance = getStatusGuidance(status);

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Coach Verification
            </p>
            <h1 className="text-3xl font-bold text-slate-900">
              Complete Your Verification
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              3 steps: Bio, Sports, Certifications/Documents
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {guidance}
        </div>

        {coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {coachProfile.verificationNotes}
          </div>
        )}
      </Card>

      <Card className="bg-white">
        <div className="mb-6 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((current) => (
            <div
              key={current}
              className={`rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                step === current
                  ? "border-power-orange bg-orange-50 text-power-orange"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
            >
              Step {current}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Profile Picture
              </label>
              <div className="flex items-center gap-4">
                <ProfilePictureUpload
                  currentPhotoUrl={user?.photoUrl}
                  onUploadSuccess={(updatedUser) => {
                    setUser(updatedUser);
                  }}
                  size="lg"
                />
                <div className="text-sm text-slate-600">
                  <p className="font-medium">Upload your profile picture</p>
                  <p className="text-xs text-slate-500">
                    JPG, PNG or WebP (Max 5MB)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Bio (About You)
              </label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={5}
                disabled={isLockedByReview}
                minLength={20}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="Tell players about your experience, achievements, and coaching style."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Mobile Number
              </label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) =>
                  setMobileNumber(sanitizeMobileNumber(event.target.value))
                }
                disabled={isLockedByReview}
                inputMode="tel"
                pattern="^[+]?[0-9\s().\-]+$"
                maxLength={20}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="e.g., 9876543210"
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                disabled={isLockedByReview || saving}
                onClick={handleStepOneContinue}
              >
                Continue to Sports
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Pricing</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="SAME"
                    checked={pricingMode === "SAME"}
                    disabled={isLockedByReview}
                    onChange={() => setPricingMode("SAME")}
                  />
                  Same price for all sports
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    value="PER_SPORT"
                    checked={pricingMode === "PER_SPORT"}
                    disabled={isLockedByReview}
                    onChange={() => setPricingMode("PER_SPORT")}
                  />
                  Different price per sport
                </label>
              </div>
            </div>

            {pricingMode === "SAME" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-900">
                  Hourly Price
                </label>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={hourlyRateInput}
                  disabled={isLockedByReview}
                  onChange={(event) => setHourlyRateInput(event.target.value)}
                  inputMode="decimal"
                  pattern="^\d+(\.\d{1,2})?$"
                  className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                  placeholder="e.g., 500"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Sports You Can Teach
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {SPORTS_OPTIONS.map((sport) => {
                  const checked = selectedSports.includes(sport);
                  return (
                    <label
                      key={sport}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isLockedByReview}
                        onChange={(event) => {
                          if (event.target.checked) {
                            const nextValue =
                              pricingMode === "SAME"
                                ? hourlyRateInput || ""
                                : "";
                            setSelectedSports((prev) => [...prev, sport]);
                            setSportPricing((prev) => ({
                              ...prev,
                              [sport]: prev[sport] || nextValue,
                            }));
                          } else {
                            setSelectedSports((prev) =>
                              prev.filter((item) => item !== sport),
                            );
                            setSportPricing((prev) => {
                              const updated = { ...prev };
                              delete updated[sport];
                              return updated;
                            });
                          }
                        }}
                      />
                      {sport}
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Select all sports you coach.
              </p>
            </div>

            {pricingMode === "PER_SPORT" && selectedSports.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-900">
                  Price per Sport
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedSports.map((sport) => (
                    <div key={sport}>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                        {sport}
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={0.01}
                        value={sportPricing[sport] || ""}
                        disabled={isLockedByReview}
                        inputMode="decimal"
                        pattern="^\d+(\.\d{1,2})?$"
                        onChange={(event) =>
                          setSportPricing((prev) => ({
                            ...prev,
                            [sport]: event.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                        placeholder="e.g., 600"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleStepTwoContinue}
                disabled={saving || isLockedByReview}
              >
                {saving ? "Saving..." : "Continue to Documents"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Upload Verification Documents
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLockedByReview || uploadingDocIndex !== null}
                  onClick={() =>
                    setVerificationDocs((prev) => [
                      ...prev,
                      { type: "CERTIFICATION", url: "", fileName: "" },
                    ])
                  }
                >
                  Add Document
                </Button>
              </div>

              {verificationDocs.map((doc, index) => (
                <div
                  key={`${doc.fileName}-${index}`}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                          Document Type
                        </label>
                        <select
                          value={doc.type}
                          disabled={
                            isLockedByReview || uploadingDocIndex !== null
                          }
                          onChange={(event) =>
                            setVerificationDocs((prev) =>
                              prev.map((item, i) =>
                                i === index
                                  ? {
                                      ...item,
                                      type: event.target
                                        .value as CoachVerificationDocument["type"],
                                    }
                                  : item,
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="CERTIFICATION">Certification</option>
                          <option value="ID_PROOF">ID Proof</option>
                          <option value="ADDRESS_PROOF">Address Proof</option>
                          <option value="BACKGROUND_CHECK">
                            Background Check
                          </option>
                          <option value="INSURANCE">Insurance</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase text-slate-600">
                          Uploaded File
                        </label>
                        <div className="truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          {doc.fileName || "No file uploaded"}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                        <Upload size={14} />
                        {uploadingDocIndex === index
                          ? "Uploading..."
                          : "Upload"}
                        <input
                          type="file"
                          disabled={
                            isLockedByReview || uploadingDocIndex === index
                          }
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleUploadDocument(index, file);
                            }
                          }}
                        />
                      </label>

                      {verificationDocs.length > 1 && !isLockedByReview && (
                        <button
                          type="button"
                          disabled={uploadingDocIndex !== null}
                          onClick={() =>
                            setVerificationDocs((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={
                  saving || isLockedByReview || uploadingDocIndex !== null
                }
                onClick={handleSubmitVerification}
              >
                {saving ? "Submitting..." : "Submit for Verification"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
