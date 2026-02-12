"use client";

import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { PresignedUrl } from "@/modules/onboarding/types/onboarding";
import { CheckCircle, ClipboardCheck, Mail, Zap } from "lucide-react";
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

const DOCUMENT_REQUIREMENTS: Record<string, string> = {
  OWNERSHIP_PROOF: "Ownership Proof",
  BUSINESS_REGISTRATION: "Business Registration",
  TAX_DOCUMENT: "Tax Document",
  INSURANCE: "Insurance Certificate",
  CERTIFICATE: "Safety Certificate",
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
          s3Key: presignedUrl.key, // Store S3 key for URL regeneration
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

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-white rounded-lg shadow">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Upload Required Documents
        </h1>
        <p className="text-gray-600 mt-2">
          Step 3 of 3: Complete Your Venue Onboarding
        </p>
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            Please upload all required documents for verification. Each file
            must be PDF, JPG, or PNG (max 10MB).
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Fields */}
        {presignedUrls.map((presigned) => {
          const docTypeKey = presigned.field.replace("document_", "");
          const docLabel = DOCUMENT_REQUIREMENTS[docTypeKey] || docTypeKey;
          const isUploaded = uploadedDocs.some(
            (doc) => doc.type === docTypeKey,
          );

          return (
            <div
              key={presigned.field}
              className="border border-gray-300 rounded-lg p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{docLabel}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Accepted formats: PDF, JPG, PNG (Max 10MB)
                  </p>
                </div>
                {isUploaded && (
                  <div className="flex items-center space-x-1 text-green-600">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium">Uploaded</span>
                  </div>
                )}
              </div>

              <label className="block cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      handleDocumentSelect(file, presigned.field, presigned);
                  }}
                  disabled={uploading[presigned.field]}
                  className="hidden"
                />

                {uploading[presigned.field] ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded border-2 border-gray-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="text-sm text-gray-600 mt-2">
                      Uploading document...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition">
                    <svg
                      className="w-10 h-10 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <p className="text-sm text-gray-600 mt-2">
                      Click to upload or drag and drop
                    </p>
                    {isUploaded && (
                      <p className="text-xs text-green-600 mt-1">
                        {
                          uploadedDocs.find((doc) => doc.type === docTypeKey)
                            ?.fileName
                        }
                      </p>
                    )}
                  </div>
                )}
              </label>

              {uploadErrors[presigned.field] && (
                <p className="text-red-500 text-sm mt-2">
                  {uploadErrors[presigned.field]}
                </p>
              )}
            </div>
          );
        })}

        {/* Upload Progress */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <p className="text-sm text-gray-700">
            Documents uploaded:{" "}
            <span className="font-bold text-blue-600">
              {uploadedDocs.length}
            </span>{" "}
            /<span> {presignedUrls.length}</span>
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{
                width: `${(uploadedDocs.length / presignedUrls.length) * 100}%`,
              }}
            ></div>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h4 className="font-semibold text-blue-900 mb-2">
            What happens next?
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 flex-shrink-0 text-blue-600" />
              Your venue will be reviewed by our admin team
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 flex-shrink-0 text-blue-600" />
              You'll receive an email once approved or if we need more
              information
            </li>
            <li className="flex items-center gap-2">
              <Zap className="w-4 h-4 flex-shrink-0 text-blue-600" />
              Approved venues can start accepting bookings immediately
            </li>
          </ul>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || uploadedDocs.length < presignedUrls.length}
          className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {loading ? (
            "Finalizing Onboarding..."
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Complete Onboarding
            </>
          )}
        </button>
        {isDev && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="w-full py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Skip (Dev)
          </button>
        )}

        <p className="text-xs text-gray-600 text-center">
          By submitting, you agree to our venue terms and conditions
        </p>
      </form>
    </div>
  );
}
