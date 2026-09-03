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

const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

export default function Step3DocumentUpload({
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
    presignedUrl: PresignedUrl
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
      await uploadFileToPresignedUrl(file, presignedUrl.uploadUrl, presignedUrl.contentType);

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
        [fieldName]: err instanceof Error ? err.message : "Failed to upload document",
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
      toast.error(`Upload all ${presignedUrls.length} required documents`);
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
    <div className="shadow-xs rounded-2xl border border-slate-200 bg-white/90 p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-bold text-slate-900">Upload Required Documents</h2>
        <p className="text-slate-600">
          Upload verification documents to complete your venue registration
        </p>
      </div>

      {/* Progress Bar */}
      <OnboardingSectionCard
        title="Upload Progress"
        subtitle="Track completion of required onboarding documents"
        className="from-power-orange/10 border-power-orange/20 bg-linear-to-r mb-6 to-white"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Upload Progress</span>
          <span className="text-power-orange text-sm font-bold">
            {uploadedDocs.length} / {presignedUrls.length}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className="from-power-orange bg-linear-to-r h-full to-orange-500 transition-all duration-500 ease-out"
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {presignedUrls.map((presigned) => {
              const docTypeKey = presigned.field.replace("document_", "");
              const docInfo = DOCUMENT_INFO[docTypeKey] || {
                label: docTypeKey,
                description: "Required document",
                IconComponent: FileText,
              };
              const uploadedDoc = uploadedDocs.find((doc) => doc.type === docTypeKey);
              const isUploaded = !!uploadedDoc;
              const isUploading = uploading[presigned.field];
              const uploadError = uploadErrors[presigned.field];

              return (
                <div
                  key={presigned.field}
                  className={`relative rounded-lg border-2 p-5 transition-all ${
                    isUploaded
                      ? "border-emerald-400 bg-emerald-50"
                      : "hover:border-power-orange/50 border-slate-200 bg-white hover:shadow-sm"
                  }`}
                >
                  {/* Document Header */}
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <docInfo.IconComponent className="text-power-orange h-8 w-8" />
                      <div>
                        <h3 className="font-semibold text-slate-900">{docInfo.label}</h3>
                        <p className="mt-0.5 text-xs text-slate-600">{docInfo.description}</p>
                      </div>
                    </div>
                    {isUploaded && <CheckCircle className="h-6 w-6 shrink-0 text-emerald-600" />}
                  </div>

                  {/* Upload Area */}
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleDocumentSelect(file, presigned.field, presigned);
                      }}
                      disabled={isUploading}
                      className="hidden"
                    />

                    {isUploading ? (
                      <div className="bg-power-orange/10 border-power-orange/25 flex flex-col items-center justify-center rounded-lg border-2 py-6">
                        <div className="border-power-orange h-8 w-8 animate-spin rounded-full border-b-2"></div>
                        <p className="text-power-orange mt-2 text-sm font-medium">Uploading...</p>
                      </div>
                    ) : isUploaded ? (
                      <div className="relative rounded-lg border-2 border-emerald-300 bg-white px-4 py-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-emerald-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {uploadedDoc.fileName}
                            </p>
                            <p className="mt-0.5 text-xs text-emerald-600">Successfully uploaded</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleRemoveDocument(docTypeKey);
                            }}
                            className="shrink-0 rounded-full p-1 transition hover:bg-red-100"
                          >
                            <X className="h-5 w-5 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="hover:border-power-orange/40 hover:bg-power-orange/5 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-6 transition-all">
                        <Upload className="mb-2 h-10 w-10 text-slate-400" />
                        <p className="text-sm font-medium text-slate-600">Click to upload</p>
                        <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG (Max 10MB)</p>
                      </div>
                    )}
                  </label>

                  {/* Error Message */}
                  {uploadError && (
                    <p className="text-error-red mt-2 flex items-center gap-1 text-xs">
                      <X className="h-3 w-3" />
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
          className="from-power-orange/10 border-power-orange/20 bg-linear-to-br mt-6 to-white"
          contentClassName="space-y-0"
        >
          <h4 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Zap className="text-power-orange h-5 w-5" />
            What happens next?
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <ClipboardCheck className="text-power-orange mt-0.5 h-5 w-5 shrink-0" />
              <span>Our review team will review your venue and documents within 24-48 hours</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <Mail className="text-power-orange mt-0.5 h-5 w-5 shrink-0" />
              <span>
                You'll receive an email notification once approved or if we need additional
                information
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-slate-700">
              <CheckCircle className="text-power-orange mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Once approved, your venue will be live and ready to accept bookings immediately
              </span>
            </li>
          </ul>
        </OnboardingSectionCard>

        {/* Submit Button */}
        <div className="mt-6 flex gap-4">
          <button
            type="submit"
            disabled={loading || uploadedDocs.length < presignedUrls.length}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-medium transition-all ${
              uploadedDocs.length >= presignedUrls.length && !loading
                ? "bg-power-orange text-white shadow-sm hover:bg-orange-600"
                : "cursor-not-allowed bg-slate-300 text-slate-500"
            }`}
          >
            {loading ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                Finalizing...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5" />
                Complete Onboarding
              </>
            )}
          </button>

          {isDev && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="rounded-lg bg-yellow-100 px-6 py-3 font-medium text-yellow-700 transition hover:bg-yellow-200 disabled:opacity-50"
            >
              Skip (Dev)
            </button>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          By submitting, you agree to our{" "}
          <a href="#" className="text-power-orange hover:underline">
            venue terms and conditions
          </a>
        </p>
      </form>
    </div>
  );
}
