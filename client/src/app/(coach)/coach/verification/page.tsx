"use client";

import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, CoachVerificationDocument, ServiceMode } from "@/types";
import { CheckCircle, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type VerificationStep = 1 | 2 | 3;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
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

const parseCommaSeparated = (value: string): string[] => {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

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

export default function CoachVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(
    null,
  );
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [step, setStep] = useState<VerificationStep>(1);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const [bio, setBio] = useState("");
  const [sportsInput, setSportsInput] = useState("");
  const [certificationsInput, setCertificationsInput] = useState("");

  const [verificationDocs, setVerificationDocs] = useState<
    CoachVerificationDocument[]
  >([{ type: "CERTIFICATION", url: "", fileName: "" }]);

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

  const loadProfile = async () => {
    try {
      const response = await coachApi.getMyProfile();
      if (response.success && response.data) {
        const coach = response.data;
        setCoachProfile(coach);
        setBio(coach.bio || "");
        setSportsInput((coach.sports || []).join(", "));
        setCertificationsInput((coach.certifications || []).join(", "));

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

    setSaving(true);
    void (async () => {
      try {
        const response = await coachApi.saveVerificationStep1({
          bio: bio.trim(),
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

    const sports = parseCommaSeparated(sportsInput);
    if (sports.length === 0) {
      setError("Please add at least one sport you can teach.");
      return;
    }

    setSaving(true);
    try {
      const step2Response = await coachApi.saveVerificationStep2({
        bio: bio.trim(),
        sports,
        certifications: parseCommaSeparated(certificationsInput),
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

    const sports = parseCommaSeparated(sportsInput);
    const certifications = parseCommaSeparated(certificationsInput);

    if (!bio.trim()) {
      setError("Bio is required.");
      return;
    }

    if (sports.length === 0) {
      setError("Please add at least one sport.");
      return;
    }

    if (certifications.length === 0) {
      setError("Please add at least one certification name.");
      return;
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

    setSaving(true);
    try {
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
                Bio (About You)
              </label>
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                rows={5}
                disabled={isLockedByReview}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="Tell players about your experience, achievements, and coaching style."
              />
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                disabled={isLockedByReview}
                onClick={handleStepOneContinue}
              >
                Continue to Sports
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Sports You Can Teach
              </label>
              <input
                type="text"
                value={sportsInput}
                disabled={isLockedByReview}
                onChange={(event) => setSportsInput(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="e.g., Cricket, Football, Badminton"
              />
              <p className="mt-1 text-xs text-slate-500">
                Add comma-separated values.
              </p>
            </div>

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
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Certification Names
              </label>
              <input
                type="text"
                value={certificationsInput}
                disabled={isLockedByReview}
                onChange={(event) => setCertificationsInput(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-power-orange/50"
                placeholder="e.g., NIS Level 1, ICC Foundation Coach"
              />
              <p className="mt-1 text-xs text-slate-500">
                Add comma-separated values.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Upload Verification Documents
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLockedByReview}
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
                          disabled={isLockedByReview}
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
                disabled={saving || isLockedByReview}
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
