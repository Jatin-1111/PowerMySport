"use client";

import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { PresignedUrl } from "@/modules/onboarding/types/onboarding";
import {
  CheckCircle,
  FileText,
  Upload,
  AlertCircle,
  Building2,
  ClipboardList,
  Briefcase,
  Shield,
  BadgeCheck,
  Lightbulb,
  X, // Keep X as it's used for error display
  ClipboardCheck, // Keep ClipboardCheck if it's used elsewhere, or remove if not
  Mail, // Keep Mail if it's used elsewhere, or remove if not
  Zap, // Keep Zap if it's used elsewhere, or remove if not
} from "lucide-react";
import { useState } from "react";

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
  error?: string;
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
  error,
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
      alert(`Please upload all ${presignedUrls.length} required documents`);
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
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Upload Required Documents
        </h2>
        <p className="text-gray-600">
          Upload verification documents to complete your venue registration
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Upload Progress
          </span>
          <span className="text-sm font-bold text-blue-600">
            {uploadedDocs.length} / {presignedUrls.length}
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-3">
          <X className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Document Upload Cards */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {presignedUrls.map((presigned) => {
            const docTypeKey = presigned.field.replace("document_", "");
            const docInfo = DOCUMENT_INFO[docTypeKey] || {
              label: docTypeKey,
              description: "Required document",
              icon: "📄",
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
                    ? "border-green-400 bg-green-50"
                    : "border-gray-200 bg-white hover:border-blue-400 hover:shadow-md"
                }`}
              >
                {/* Document Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <docInfo.IconComponent className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {docInfo.label}
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {docInfo.description}
                      </p>
                    </div>
                  </div>
                  {isUploaded && (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
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
                        handleDocumentSelect(file, presigned.field, presigned);
                    }}
                    disabled={isUploading}
                    className="hidden"
                  />

                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-blue-50 rounded-lg border-2 border-blue-300">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="text-sm text-blue-700 mt-2 font-medium">
                        Uploading...
                      </p>
                    </div>
                  ) : isUploaded ? (
                    <div className="relative py-4 px-4 bg-white rounded-lg border-2 border-green-300">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-green-600" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {uploadedDoc.fileName}
                          </p>
                          <p className="text-xs text-green-600 mt-0.5">
                            Successfully uploaded
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveDocument(docTypeKey);
                          }}
                          className="flex-shrink-0 p-1 hover:bg-red-100 rounded-full transition"
                        >
                          <X className="w-5 h-5 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all">
                      <Upload className="w-10 h-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 font-medium">
                        Click to upload
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        PDF, JPG, PNG (Max 10MB)
                      </p>
                    </div>
                  )}
                </label>

                {/* Error Message */}
                {uploadError && (
                  <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                    <X className="w-3 h-3" />
                    {uploadError}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-600" />
            What happens next?
          </h4>
          <ul className="space-y-2">
            <li className="flex items-start gap-3 text-sm text-blue-800">
              <ClipboardCheck className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <span>
                Our admin team will review your venue and documents within 24-48
                hours
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-blue-800">
              <Mail className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <span>
                You'll receive an email notification once approved or if we need
                additional information
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-blue-800">
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
              <span>
                Once approved, your venue will be live and ready to accept
                bookings immediately
              </span>
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={loading || uploadedDocs.length < presignedUrls.length}
            className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
              uploadedDocs.length >= presignedUrls.length && !loading
                ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
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

        <p className="text-xs text-gray-500 text-center mt-4">
          By submitting, you agree to our{" "}
          <a href="#" className="text-blue-600 hover:underline">
            venue terms and conditions
          </a>
        </p>
      </form>
    </div>
  );
}
