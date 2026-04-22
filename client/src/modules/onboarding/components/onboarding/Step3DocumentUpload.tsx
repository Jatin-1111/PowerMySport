"use client";

import { toast } from "@/lib/toast";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { PresignedUrl } from "@/modules/onboarding/types/onboarding";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Mail,
  Shield,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import OnboardingSectionCard from "./OnboardingSectionCard";

interface UploadedDoc {
  type: string;
  fileName: string;
  url: string; // Current presigned URL
  s3Key: string; // S3 key for regenerating presigned URLs
}

interface Step3DocumentUploadProps {
  venueId: string;
  presignedUrls: PresignedUrl[];
  onDocumentsFinalized: (documents: UploadedDoc[]) => Promise<void>;
  loading?: boolean;
  onSkip?: () => Promise<void>;
}

const DOCUMENT_INFO: Record<
  string,
  {
    label: string;
    description: string;
    IconComponent: React.ComponentType<{ className?: string }>;
  }
> = {
  OWNERSHIP_PROOF: {
    label: "Ownership Proof",
    description: "Property deed, lease agreement, or ownership certificate",
    IconComponent: Building2,
  },
  BUSINESS_REGISTRATION: {
    label: "Business Registration",
    description: "Certificate of incorporation or business license",
    IconComponent: ClipboardList,
  },
  TAX_DOCUMENT: {
    label: "Tax Document",
    description: "GST certificate or tax registration",
    IconComponent: Briefcase,
  },
  INSURANCE: {
    label: "Insurance Certificate",
    description: "Valid liability insurance for your venue",
    IconComponent: Shield,
  },
  CERTIFICATE: {
    label: "Safety Certificate",
    description: "Fire safety or other required certifications",
    IconComponent: BadgeCheck,
  },
};

const isDev =
  typeof window !== "undefined" && process.env.NODE_ENV === "development";

export default function Step3DocumentUpload({
  venueId,
  presignedUrls,
  onDocumentsFinalized,
  loading,
  onSkip,
}: Step3DocumentUploadProps) {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const handleDocumentSelect = async (
    file: File,
    fieldName: string,
    presignedUrl: PresignedUrl,
  ) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Please select a PDF, JPG, or PNG file",
      }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: "Document must be smaller than 10MB",
      }));
      return;
    }

    setUploading((prev) => ({ ...prev, [fieldName]: true }));

    try {
      // Upload to S3
      await uploadFileToPresignedUrl(
        file,
        presignedUrl.uploadUrl,
        presignedUrl.contentType,
      );

      const docType = fieldName.replace("document_", "");

      setUploadedDocs((prev) => [
        ...prev.filter((doc) => doc.type !== docType),
        {
          type: docType,
          fileName: file.name,
          url: presignedUrl.downloadUrl,
          s3Key: presignedUrl.key,
        },
      ]);

      setUploadErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]:
          err instanceof Error ? err.message : "Failed to upload document",
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleRemoveDocument = (docType: string) => {
    setUploadedDocs((prev) => prev.filter((doc) => doc.type !== docType));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadedDocs.length < presignedUrls.length) {
      toast.error(
        `Please upload all ${presignedUrls.length} required documents`,
      );
      return;
    }

    try {
      await onDocumentsFinalized(uploadedDocs);
    } catch (err) {
      console.error("Failed to finalize onboarding:", err);
    }
  };

  const uploadProgress = (uploadedDocs.length / presignedUrls.length) * 100;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Upload Required Documents
        </h2>
        <p className="text-slate-600">
          Upload verification documents to complete your venue registration
        </p>
      </div>

      {/* Progress Bar */}
      <OnboardingSectionCard
        title="Upload Progress"
        subtitle="Track completion of required onboarding documents"
        className="mb-6 bg-linear-to-r from-power-orange/10 to-white border-power-orange/20"
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-slate-700">
            Upload Progress
          </span>
          <span className="text-sm font-bold text-power-orange">
            {uploadedDocs.length} / {presignedUrls.length}
          </span>
        </div>
        <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-power-orange to-orange-500 transition-all duration-500 ease-out"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      </OnboardingSectionCard>

      {/* Document Upload Cards */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <OnboardingSectionCard
          title="Required Documents"
          subtitle="Upload each document in PDF, JPG, or PNG format"
          contentClassName="space-y-0"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presignedUrls.map((presigned) => {
              const docTypeKey = presigned.field.replace("document_", "");
              const docInfo = DOCUMENT_INFO[docTypeKey] || {
                label: docTypeKey,
                description: "Required document",
                IconComponent: FileText,
              };
              const uploadedDoc = uploadedDocs.find(
                (doc) => doc.type === docTypeKey,
              );
              const isUploaded = !!uploadedDoc;
              const isUploading = uploading[presigned.field];
              const uploadError = uploadErrors[presigned.field];

              return (
                <div
                  key={presigned.field}
                  className={`relative border-2 rounded-lg p-5 transition-all ${
                    isUploaded
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-power-orange/50 hover:shadow-sm"
                  }`}
                >
                  {/* Document Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <docInfo.IconComponent className="w-8 h-8 text-power-orange" />
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {docInfo.label}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {docInfo.description}
                        </p>
                      </div>
                    </div>
                    {isUploaded && (
                      <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                    )}
                  </div>

                  {/* Upload Area */}
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          handleDocumentSelect(
                            file,
                            presigned.field,
                            presigned,
                          );
                      }}
                      disabled={isUploading}
                      className="hidden"
                    />

                    {isUploading ? (
                      <div className="flex flex-col items-center justify-center py-6 bg-power-orange/10 rounded-lg border-2 border-power-orange/25">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-power-orange"></div>
                        <p className="text-sm text-power-orange mt-2 font-medium">
                          Uploading...
                        </p>
                      </div>
                    ) : isUploaded ? (
                      <div className="relative py-4 px-4 bg-white rounded-lg border-2 border-emerald-300">
                        <div className="flex items-center gap-3">
                          <FileText className="w-8 h-8 text-emerald-600" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {uploadedDoc.fileName}
                            </p>
                            <p className="text-xs text-emerald-600 mt-0.5">
                              Successfully uploaded
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveDocument(docTypeKey);
                            }}
                            className="shrink-0 p-1 hover:bg-red-100 rounded-full transition"
                          >
                            <X className="w-5 h-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 hover:border-power-orange/40 hover:bg-power-orange/5 transition-all">
                        <Upload className="w-10 h-10 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-600 font-medium">
                          Click to upload
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          PDF, JPG, PNG (Max 10MB)
                        </p>
                      </div>
                    )}
                  </label>

                  {/* Error Message */}
                  {uploadError && (
                    <p className="text-error-red text-xs mt-2 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {uploadError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </OnboardingSectionCard>

        {/* Info Box */}
        <OnboardingSectionCard
          title="What Happens Next"
          className="mt-6 bg-linear-to-br from-power-orange/10 to-white border-power-orange/20"
          contentClassName="space-y-0"
        >
          <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-power-orange" />
            What happens next?
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <ClipboardCheck className="w-5 h-5 shrink-0 text-power-orange mt-0.5" />
              <span>
                Our review team will review your venue and documents within
                24-48 hours
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <Mail className="w-5 h-5 shrink-0 text-power-orange mt-0.5" />
              <span>
                You'll receive an email notification once approved or if we need
                additional information
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <CheckCircle className="w-5 h-5 shrink-0 text-power-orange mt-0.5" />
              <span>
                Once approved, your venue will be live and ready to accept
                bookings immediately
              </span>
            </li>
          </ul>
        </OnboardingSectionCard>

        {/* Submit Button */}
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={loading || uploadedDocs.length < presignedUrls.length}
            className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              uploadedDocs.length >= presignedUrls.length && !loading
                ? "bg-power-orange text-white hover:bg-orange-600 shadow-sm"
                : "bg-slate-300 text-slate-500 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Complete Onboarding
              </>
            )}
          </button>

          {isDev && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="px-6 py-3 bg-yellow-100 text-yellow-700 font-medium rounded-lg hover:bg-yellow-200 disabled:opacity-50 transition"
            >
              Skip (Dev)
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          By submitting, you agree to our{" "}
          <a href="#" className="text-power-orange hover:underline">
            venue terms and conditions
          </a>
        </p>
      </form>
    </div>
  );
}
