"use client";

import { toast } from "@/lib/toast";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { Button } from "@/modules/shared/ui/Button";
import { CheckCircle, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import type {
  AcademyBusinessType,
  AcademyStep3Payload,
} from "@/modules/onboarding/types/academy";

interface Step3LegalProps {
  academyId: string;
  onSubmit: (data: AcademyStep3Payload) => Promise<void>;
  loading?: boolean;
  onBack?: () => void;
  previousData?: AcademyStep3Payload;
}

export default function Step3Legal({
  academyId,
  onSubmit,
  loading = false,
  onBack,
  previousData,
}: Step3LegalProps) {
  const [formData, setFormData] = useState({
    businessType: (previousData?.businessType ||
      "sole_proprietorship") as AcademyBusinessType,
    panNumber: previousData?.panNumber || "",
    panDocumentUrl: previousData?.panDocumentUrl || "",
    panDocumentKey: previousData?.panDocumentKey || "",
    gstNumber: previousData?.gstNumber || "",
    gstDocumentUrl: previousData?.gstDocumentUrl || "",
    gstDocumentKey: previousData?.gstDocumentKey || "",
    aadhaarLast4: previousData?.aadhaarLast4 || "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [panUploading, setPanUploading] = useState(false);
  const [gstUploading, setGstUploading] = useState(false);
  const [panUploaded, setPanUploaded] = useState(
    !!previousData?.panDocumentUrl,
  );
  const [gstUploaded, setGstUploaded] = useState(
    !!previousData?.gstDocumentUrl,
  );

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber.trim())) {
      errors.panNumber = "Invalid PAN format (e.g., ABCDE1234F)";
    }
    if (!panUploaded && !formData.panDocumentUrl) {
      errors.panDocument = "PAN document is required — please upload it";
    }
    if (
      formData.gstNumber.trim() &&
      !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(
        formData.gstNumber.trim(),
      )
    ) {
      errors.gstNumber = "Invalid GST format (e.g., 22AABCT1234H2Z0)";
    }
    if (formData.gstNumber.trim() && !gstUploaded && !formData.gstDocumentKey) {
      errors.gstDocument =
        "GST document is required when GST number is provided";
    }
    if (!/^\d{4}$/.test(formData.aadhaarLast4)) {
      errors.aadhaarLast4 = "Please enter last 4 digits of Aadhaar";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "pan" | "gst",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Document must be less than 5MB");
      return;
    }

    if (type === "pan") {
      setPanFile(file);
      setPanUploaded(false);
      // Upload immediately
      setPanUploading(true);
      try {
        const res = await academyOnboardingApi.getDocumentUploadUrls(
          academyId,
          ["panDocument"],
        );
        const upload = res.data?.uploadUrls?.[0];
        if (!res.success || !upload)
          throw new Error("Could not get upload URL");
        await uploadFileToPresignedUrl(
          file,
          upload.uploadUrl,
          upload.contentType,
        );
        const confirmRes = await academyOnboardingApi.confirmDocuments({
          academyId,
          panDocumentUrl: upload.downloadUrl,
          panDocumentKey: upload.s3Key,
        });
        if (!confirmRes.success)
          throw new Error(confirmRes.message || "Upload confirmation failed");
        setFormData((prev) => ({
          ...prev,
          panDocumentUrl: upload.downloadUrl,
          panDocumentKey: upload.s3Key,
        }));
        setPanUploaded(true);
        setFieldErrors((prev) => ({ ...prev, panDocument: "" }));
        toast.success("PAN document uploaded ✓");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "PAN upload failed");
        setPanFile(null);
      } finally {
        setPanUploading(false);
      }
    } else {
      setGstFile(file);
      setGstUploaded(false);
      setGstUploading(true);
      try {
        const res = await academyOnboardingApi.getDocumentUploadUrls(
          academyId,
          ["gstDocument"],
        );
        const upload = res.data?.uploadUrls?.[0];
        if (!res.success || !upload)
          throw new Error("Could not get upload URL");
        await uploadFileToPresignedUrl(
          file,
          upload.uploadUrl,
          upload.contentType,
        );
        const confirmRes = await academyOnboardingApi.confirmDocuments({
          academyId,
          panDocumentUrl: formData.panDocumentUrl,
          panDocumentKey: formData.panDocumentKey,
          gstDocumentUrl: upload.downloadUrl,
          gstDocumentKey: upload.s3Key,
        });
        if (!confirmRes.success)
          throw new Error(confirmRes.message || "Upload confirmation failed");
        setFormData((prev) => ({
          ...prev,
          gstDocumentUrl: upload.downloadUrl,
          gstDocumentKey: upload.s3Key,
        }));
        setGstUploaded(true);
        setFieldErrors((prev) => ({ ...prev, gstDocument: "" }));
        toast.success("GST document uploaded ✓");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "GST upload failed");
        setGstFile(null);
      } finally {
        setGstUploading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors before continuing");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AcademyStep3Payload = {
        businessType: formData.businessType,
        panNumber: formData.panNumber.trim(),
        panDocumentUrl: formData.panDocumentUrl.trim(),
        panDocumentKey: formData.panDocumentKey.trim(),
        aadhaarLast4: formData.aadhaarLast4.trim(),
        academyId,
      };

      const gstNumber = formData.gstNumber.trim();
      const gstDocumentUrl = formData.gstDocumentUrl.trim();
      const gstDocumentKey = formData.gstDocumentKey.trim();

      if (gstNumber) {
        payload.gstNumber = gstNumber;
      }
      if (gstDocumentUrl) {
        payload.gstDocumentUrl = gstDocumentUrl;
      }
      if (gstDocumentKey) {
        payload.gstDocumentKey = gstDocumentKey;
      }

      await onSubmit(payload);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save legal info",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 3: Legal & KYC
        </h2>
        <p className="text-slate-600">
          Provide your business and compliance details
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business Type */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Business Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.businessType}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                businessType: e.target.value as AcademyBusinessType,
              }))
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
            disabled={isSubmitting}
          >
            <option value="sole_proprietorship">Sole Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="pvt_ltd">Private Limited Company</option>
            <option value="ngo_trust">NGO/Trust</option>
          </select>
        </div>

        {/* PAN */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">PAN Details</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                PAN Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.panNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    panNumber: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="AAAAA0000A"
                maxLength={10}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.panNumber
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.panNumber && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.panNumber}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                PAN Document <span className="text-red-500">*</span>
              </label>
              <label
                className={`flex items-center gap-4 border-2 border-dashed rounded-lg p-4 cursor-pointer transition ${
                  panUploaded
                    ? "border-emerald-400 bg-emerald-50"
                    : fieldErrors.panDocument
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300 hover:border-power-orange hover:bg-orange-50"
                } ${panUploading ? "pointer-events-none opacity-75" : ""}`}
              >
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => handleFileChange(e, "pan")}
                  className="hidden"
                  disabled={isSubmitting || panUploading}
                />
                <div className="flex flex-col gap-1">
                  {panUploading ? (
                    <Loader2 className="w-5 h-5 text-power-orange animate-spin" />
                  ) : panUploaded ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Upload className="w-5 h-5 text-slate-500" />
                  )}
                  <span className="text-sm text-slate-600">
                    {panUploading
                      ? "Uploading..."
                      : panUploaded
                        ? `✓ ${panFile?.name ?? "Uploaded"}`
                        : panFile
                          ? panFile.name
                          : "Click to upload PAN"}
                  </span>
                  <span className="text-xs text-slate-500">
                    PDF, JPG, PNG (Max 5MB)
                  </span>
                </div>
              </label>
              {fieldErrors.panDocument && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.panDocument}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* GST (Optional) */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">
            GST Details (Optional)
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                GST Number (if applicable)
              </label>
              <input
                type="text"
                value={formData.gstNumber}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    gstNumber: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="22AABCT1234H2Z0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange"
                disabled={isSubmitting}
              />
              {formData.gstNumber && fieldErrors.gstNumber && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.gstNumber}
                </p>
              )}
            </div>

            {formData.gstNumber.trim() && (
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">
                  GST Document <span className="text-red-500">*</span>
                </label>
                <label
                  className={`flex items-center gap-4 border-2 border-dashed rounded-lg p-4 cursor-pointer transition ${
                    gstUploaded
                      ? "border-emerald-400 bg-emerald-50"
                      : fieldErrors.gstDocument
                        ? "border-red-300 bg-red-50"
                        : "border-slate-300 hover:border-power-orange hover:bg-orange-50"
                  } ${gstUploading ? "pointer-events-none opacity-75" : ""}`}
                >
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    onChange={(e) => handleFileChange(e, "gst")}
                    className="hidden"
                    disabled={isSubmitting || gstUploading}
                  />
                  <div className="flex flex-col gap-1">
                    {gstUploading ? (
                      <Loader2 className="w-5 h-5 text-power-orange animate-spin" />
                    ) : gstUploaded ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Upload className="w-5 h-5 text-slate-500" />
                    )}
                    <span className="text-sm text-slate-600">
                      {gstUploading
                        ? "Uploading..."
                        : gstUploaded
                          ? `✓ ${gstFile?.name ?? "Uploaded"}`
                          : gstFile
                            ? gstFile.name
                            : "Click to upload GST"}
                    </span>
                  </div>
                </label>
                {fieldErrors.gstDocument && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.gstDocument}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Aadhaar */}
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">
            Aadhaar Last 4 Digits <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.aadhaarLast4}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                aadhaarLast4: e.target.value.replace(/\D/g, "").slice(0, 4),
              }))
            }
            placeholder="1234"
            maxLength={4}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
              fieldErrors.aadhaarLast4
                ? "border-red-300 bg-red-50"
                : "border-slate-300 bg-white"
            }`}
            disabled={isSubmitting}
          />
          {fieldErrors.aadhaarLast4 && (
            <p className="text-red-600 text-xs mt-1">
              {fieldErrors.aadhaarLast4}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            We only store the last 4 digits for privacy
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-4">
          {onBack && (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              disabled={isSubmitting}
            >
              Back
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {isSubmitting ? "Saving..." : "Continue to Step 4"}
          </Button>
        </div>
      </form>
    </div>
  );
}
