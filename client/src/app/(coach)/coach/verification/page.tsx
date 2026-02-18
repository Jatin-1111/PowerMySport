"use client";

import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Coach, CoachVerificationDocument } from "@/types";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export default function CoachVerificationPage() {
  const [coachProfile, setCoachProfile] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationDocs, setVerificationDocs] = useState<
    CoachVerificationDocument[]
  >([
    {
      type: "ID_PROOF",
      url: "",
      fileName: "",
    },
  ]);
  const [uploadingDocIndex, setUploadingDocIndex] = useState<number | null>(
    null,
  );
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return "Something went wrong";
  };

  const loadProfile = async () => {
    try {
      const response = await coachApi.getMyProfile();
      if (response.success && response.data) {
        setCoachProfile(response.data);
        if (response.data.verificationDocuments?.length) {
          setVerificationDocs(
            response.data.verificationDocuments.map((doc) => ({
              type: doc.type,
              url: doc.url,
              fileName: doc.fileName,
              s3Key: doc.s3Key,
              uploadedAt: doc.uploadedAt,
            })),
          );
        }
      }
    } catch (error) {
      console.error("Failed to load coach profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const getVerificationBadge = (coachData: Coach | null) => {
    if (!coachData) {
      return {
        label: "Unverified",
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
          label: "Pending",
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
          label: "Unverified",
          className: "bg-slate-100 text-slate-700 border border-slate-200",
        };
    }
  };

  const updateVerificationDoc = (
    index: number,
    field: keyof CoachVerificationDocument,
    value: string,
  ) => {
    setVerificationDocs((prev) =>
      prev.map((doc, i) => (i === index ? { ...doc, [field]: value } : doc)),
    );
  };

  const handleUploadDocument = async (index: number, file: File) => {
    setUploadingDocIndex(index);
    try {
      const currentDoc = verificationDocs[index];
      if (!currentDoc) {
        throw new Error("Document entry not found");
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
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally {
      setUploadingDocIndex(null);
    }
  };

  const addVerificationDoc = () => {
    setVerificationDocs((prev) => [
      ...prev,
      { type: "CERTIFICATION", url: "", fileName: "" },
    ]);
  };

  const removeVerificationDoc = (index: number) => {
    setVerificationDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVerificationSubmit = async () => {
    if (!verificationDocs.length) {
      alert("Please add at least one document");
      return;
    }

    const invalidDoc = verificationDocs.find(
      (doc) => !doc.url.trim() || !doc.fileName.trim(),
    );
    if (invalidDoc) {
      alert("Please upload a file for each document");
      return;
    }

    setVerificationSubmitting(true);
    try {
      const response = await coachApi.submitVerification({
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

      alert("Verification submitted. We'll review it shortly.");
      await loadProfile();
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally {
      setVerificationSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="text-center bg-white">
        <p className="text-slate-600">Loading verification...</p>
      </Card>
    );
  }

  const badge = getVerificationBadge(coachProfile);

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Verification</h2>
            <p className="text-sm text-slate-600">
              Upload your documents to get verified.
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        {coachProfile?.verificationNotes && (
          <p className="mt-3 text-sm text-red-600">
            {coachProfile.verificationNotes}
          </p>
        )}
      </Card>

      <Card className="bg-white">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Verification Documents
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Upload ID proof, coaching certification, and optional address proof.
        </p>

        <div className="space-y-4">
          {verificationDocs.map((doc, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Type
                  </label>
                  <select
                    value={doc.type}
                    onChange={(e) =>
                      updateVerificationDoc(index, "type", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="ID_PROOF">ID Proof</option>
                    <option value="CERTIFICATION">Certification</option>
                    <option value="ADDRESS_PROOF">Address Proof</option>
                    <option value="BACKGROUND_CHECK">Background Check</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Upload File
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUploadDocument(index, file);
                        e.currentTarget.value = "";
                      }
                    }}
                    className="text-sm text-slate-600"
                  />
                  {doc.fileName && (
                    <p className="mt-2 text-xs text-slate-500">
                      Uploaded: {doc.fileName}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {doc.url ? "Ready" : "Not uploaded"}
                </span>
                {uploadingDocIndex === index && (
                  <span className="text-xs font-semibold text-power-orange">
                    Uploading...
                  </span>
                )}
              </div>

              <div className="mt-3 flex justify-end">
                {verificationDocs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVerificationDoc(index)}
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={addVerificationDoc}
          >
            Add Document
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleVerificationSubmit}
            disabled={verificationSubmitting}
            className="flex items-center gap-2"
          >
            <ShieldCheck size={18} />
            {verificationSubmitting ? "Submitting..." : "Submit Verification"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
