"use client";

import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Modal } from "@/modules/shared/ui/Modal";
import { Coach, CoachVerificationDocument } from "@/types";
import {
  AlertCircle,
  CheckCircle,
  File,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

interface ModalState {
  type: "success" | "error" | "warning" | "info" | null;
  isOpen: boolean;
  title: string;
  message: string;
}

interface FilePreview {
  index: number;
  name: string;
  type: string;
  size: number;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

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
  const [modal, setModal] = useState<ModalState>({
    type: null,
    isOpen: false,
    title: "",
    message: "",
  });
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);

  const showModal = (
    type: "success" | "error" | "warning" | "info",
    title: string,
    message: string,
  ) => {
    setModal({ type, isOpen: true, title, message });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    return "Something went wrong";
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds 5MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      };
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error:
          "Invalid file type. Please upload JPG, PNG, WebP, or PDF files only.",
      };
    }

    return { valid: true };
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
      showModal(
        "error",
        "Load Failed",
        "Failed to load your profile. Please refresh the page.",
      );
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
    // Validate file first
    const validation = validateFile(file);
    if (!validation.valid) {
      showModal(
        "error",
        "Invalid File",
        validation.error || "File validation failed",
      );
      return;
    }

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

      showModal(
        "success",
        "Upload Successful",
        `${fileName} has been uploaded successfully.`,
      );
    } catch (error: unknown) {
      showModal("error", "Upload Failed", getErrorMessage(error));
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
      showModal(
        "warning",
        "No Documents",
        "Please add at least one document before submitting.",
      );
      return;
    }

    const invalidDoc = verificationDocs.find(
      (doc) => !doc.url.trim() || !doc.fileName.trim(),
    );
    if (invalidDoc) {
      showModal(
        "warning",
        "Missing File",
        "Please upload a file for each document before submitting.",
      );
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

      showModal(
        "success",
        "Submitted Successfully",
        "Your verification documents have been submitted. We'll review them shortly and notify you of the status.",
      );
      await loadProfile();
    } catch (error: unknown) {
      showModal("error", "Submission Failed", getErrorMessage(error));
    } finally {
      setVerificationSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="text-center bg-white">
        <p className="text-slate-600">Loading your verification status...</p>
      </Card>
    );
  }

  const badge = getVerificationBadge(coachProfile);
  const modalIconMap = {
    success: <CheckCircle className="h-5 w-5 text-green-600" />,
    error: <AlertCircle className="h-5 w-5 text-red-600" />,
    warning: <AlertCircle className="h-5 w-5 text-yellow-600" />,
    info: <AlertCircle className="h-5 w-5 text-blue-600" />,
  };

  const modalColorMap = {
    success: "bg-green-50 text-green-800",
    error: "bg-red-50 text-red-800",
    warning: "bg-yellow-50 text-yellow-800",
    info: "bg-blue-50 text-blue-800",
  };

  return (
    <div className="space-y-6">
      {/* Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="primary" onClick={closeModal}>
              OK
            </Button>
          </div>
        }
      >
        <div className="flex gap-3">
          {modal.type && modalIconMap[modal.type]}
          <p className={`text-sm ${modal.type && modalColorMap[modal.type]}`}>
            {modal.message}
          </p>
        </div>
      </Modal>

      {/* File Preview Modal */}
      <Modal
        isOpen={filePreview !== null}
        onClose={() => setFilePreview(null)}
        title="File Preview"
        size="lg"
      >
        {filePreview && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <File className="h-8 w-8 text-power-orange" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {filePreview.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(filePreview.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
            </div>
            {filePreview.type.startsWith("image/") && (
              <div className="rounded-lg bg-slate-100 p-4">
                <div className="bg-gray-200 rounded h-96 w-full flex items-center justify-center">
                  <p className="text-gray-500 text-sm">
                    Image preview not available
                  </p>
                </div>
              </div>
            )}
            {filePreview.type === "application/pdf" && (
              <div className="rounded-lg bg-slate-100 p-4 text-center">
                <File className="mx-auto h-16 w-16 text-slate-400" />
                <p className="mt-2 text-sm text-slate-600">PDF Document</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Header Card */}
      <Card className="bg-white">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Verification</h2>
            <p className="text-sm text-slate-600">
              Upload your documents to get verified on our platform.
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>
        {coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 border border-red-200">
            <p className="text-sm text-red-700">
              <span className="font-semibold">Rejection Reason:</span>{" "}
              {coachProfile.verificationNotes}
            </p>
          </div>
        )}
      </Card>

      {/* Documents Card */}
      <Card className="bg-white">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          Verification Documents
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Upload your ID proof, coaching certification, and other relevant
          documents. Max file size: 5MB. Supported formats: JPG, PNG, WebP, PDF
        </p>

        <div className="space-y-4">
          {verificationDocs.map((doc, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Document Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Document Type
                  </label>
                  <select
                    value={doc.type}
                    onChange={(e) =>
                      updateVerificationDoc(index, "type", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-power-orange"
                  >
                    <option value="ID_PROOF">ID Proof</option>
                    <option value="CERTIFICATION">Certification</option>
                    <option value="ADDRESS_PROOF">Address Proof</option>
                    <option value="BACKGROUND_CHECK">Background Check</option>
                    <option value="INSURANCE">Insurance</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Upload File
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleUploadDocument(index, file);
                          e.currentTarget.value = "";
                        }
                      }}
                      disabled={uploadingDocIndex === index}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className={`rounded-lg border-2 border-dashed border-slate-300 p-3 text-center transition-colors ${
                        uploadingDocIndex === index
                          ? "bg-slate-50 border-slate-400"
                          : "hover:border-power-orange hover:bg-orange-50"
                      }`}
                    >
                      {uploadingDocIndex === index ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-power-orange border-t-transparent" />
                          <span className="text-xs font-semibold text-power-orange">
                            Uploading...
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Upload size={16} className="text-slate-400" />
                          <span className="text-xs font-semibold text-slate-600">
                            Click to upload
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* File Status */}
              {doc.url && (
                <div className="mt-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-600" />
                      <div>
                        <p className="text-xs font-semibold text-green-800">
                          {doc.fileName}
                        </p>
                        {doc.uploadedAt && (
                          <p className="text-xs text-green-700">
                            Uploaded{" "}
                            {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remove Button */}
              {verificationDocs.length > 1 && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeVerificationDoc(index)}
                    className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
                  >
                    <X size={14} />
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={addVerificationDoc}>
            + Add Document
          </Button>
          <Button
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
