"use client";

import { toast } from "@/lib/toast";
import { academyOnboardingApi } from "@/modules/onboarding/services/academy";
import { uploadFileToPresignedUrl } from "@/modules/onboarding/services/onboarding";
import { Button } from "@/modules/shared/ui/Button";
import SportsMultiSelect from "@/modules/sports/components/SportsMultiSelect";
import { Lightbulb, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AcademyStep1Payload } from "@/modules/onboarding/types/academy";

interface Step1BasicInfoProps {
  onSubmit: (data: AcademyStep1Payload) => Promise<{ academyId: string }>;
  loading?: boolean;
  previousData?: AcademyStep1Payload;
}

export default function Step1BasicInfo({
  onSubmit,
  loading = false,
  previousData,
}: Step1BasicInfoProps) {
  const isMountedRef = useRef(true);
  const [formData, setFormData] = useState({
    ownerName: previousData?.ownerName || "",
    ownerEmail: previousData?.ownerEmail || "",
    ownerPhone: previousData?.ownerPhone || "",
    name: previousData?.name || "",
    legalName: previousData?.legalName || "",
    sports: previousData?.sports || ([] as string[]),
    ageGroups:
      previousData?.ageGroups ||
      ([] as ("kids" | "teens" | "adults" | "all")[]),
    establishedYear: previousData?.establishedYear?.toString() || "",
    description: previousData?.description || "",
    logoUrl: previousData?.logoUrl || "",
    logoKey: previousData?.logoKey || "",
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const toggleAgeGroup = (group: "kids" | "teens" | "adults" | "all") => {
    setFormData((prev) => ({
      ...prev,
      ageGroups: prev.ageGroups.includes(group)
        ? prev.ageGroups.filter((g) => g !== group)
        : [...prev.ageGroups, group],
    }));
  };

  const currentYear = new Date().getFullYear();

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.ownerName.trim().length < 2) {
      errors.ownerName = "Name must be at least 2 characters";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.ownerEmail.trim())) {
      errors.ownerEmail = "Invalid email address";
    }
    if (!/^\+91[0-9]{10}$/.test(formData.ownerPhone.trim())) {
      errors.ownerPhone =
        "Phone must be +91 followed by 10 digits (e.g. +919876543210)";
    }
    if (formData.name.trim().length < 3) {
      errors.name = "Academy name must be at least 3 characters";
    }
    if (formData.legalName.trim().length < 3) {
      errors.legalName = "Legal name must be at least 3 characters";
    }
    if (formData.sports.length === 0) {
      errors.sports = "Select at least one sport";
    }
    if (formData.ageGroups.length === 0) {
      errors.ageGroups = "Select at least one age group";
    }
    if (formData.description.trim().length < 20) {
      errors.description = "Description must be at least 20 characters";
    }
    if (formData.establishedYear) {
      const year = parseInt(formData.establishedYear, 10);
      if (isNaN(year) || year < 1900 || year > currentYear) {
        errors.establishedYear = `Year must be between 1900 and ${currentYear}`;
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo must be less than 2MB");
        return;
      }
      setLogoFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AcademyStep1Payload = {
        ownerName: formData.ownerName.trim(),
        ownerEmail: formData.ownerEmail.trim(),
        ownerPhone: formData.ownerPhone.trim(),
        name: formData.name.trim(),
        legalName: formData.legalName.trim(),
        sports: formData.sports,
        ageGroups: formData.ageGroups,
        description: formData.description.trim(),
        establishedYear: formData.establishedYear
          ? parseInt(formData.establishedYear, 10)
          : undefined,
        ...(formData.logoUrl.trim()
          ? { logoUrl: formData.logoUrl.trim() }
          : {}),
        ...(formData.logoKey.trim()
          ? { logoKey: formData.logoKey.trim() }
          : {}),
      };

      const submission = await onSubmit(payload);

      if (logoFile) {
        const uploadResponse = await academyOnboardingApi.getImageUploadUrls(
          submission.academyId,
          ["logo"],
        );

        const logoUpload = uploadResponse.data?.uploadUrls?.[0];
        if (!uploadResponse.success || !logoUpload) {
          throw new Error("Failed to prepare logo upload");
        }

        await uploadFileToPresignedUrl(
          logoFile,
          logoUpload.uploadUrl,
          logoUpload.contentType,
        );

        const confirmResponse = await academyOnboardingApi.confirmImages({
          academyId: submission.academyId,
          logoUrl: logoUpload.downloadUrl,
          logoKey: logoUpload.s3Key,
        });

        if (!confirmResponse.success) {
          throw new Error(
            confirmResponse.message || "Failed to save academy logo",
          );
        }
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create academy",
      );
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-xs md:p-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Step 1: Academy Basics
        </h2>
        <p className="text-slate-600">
          Tell us about your academy and get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Owner Information */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">
            Owner Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.ownerName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ownerName: e.target.value,
                  }))
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.ownerName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.ownerName && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.ownerName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.ownerEmail}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    ownerEmail: e.target.value,
                  }))
                }
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.ownerEmail
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.ownerEmail && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.ownerEmail}
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-900 mb-1">
                WhatsApp/Phone <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 py-2 border border-r-0 border-slate-300 rounded-l-lg bg-slate-50 text-sm text-slate-600">
                  +91
                </span>
                <input
                  type="tel"
                  value={formData.ownerPhone.replace(/^\+91/, "")}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setFormData((prev) => ({
                      ...prev,
                      ownerPhone: `+91${digits}`,
                    }));
                    if (fieldErrors.ownerPhone) {
                      setFieldErrors((prev) => ({ ...prev, ownerPhone: "" }));
                    }
                  }}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`flex-1 px-3 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                    fieldErrors.ownerPhone
                      ? "border-red-300 bg-red-50"
                      : "border-slate-300 bg-white"
                  }`}
                  disabled={isSubmitting}
                />
              </div>
              {fieldErrors.ownerPhone && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.ownerPhone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Academy Information */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-4">
            Academy Information
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Academy Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Elite Basketball Academy"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.name
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.name && (
                <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.legalName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    legalName: e.target.value,
                  }))
                }
                placeholder="Registered business name"
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.legalName
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.legalName && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.legalName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-1">
                Year Established
              </label>
              <input
                type="number"
                value={formData.establishedYear}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    establishedYear: e.target.value,
                  }));
                  if (fieldErrors.establishedYear) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      establishedYear: "",
                    }));
                  }
                }}
                placeholder="2015"
                min="1900"
                max={currentYear}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.establishedYear
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              {fieldErrors.establishedYear && (
                <p className="text-red-600 text-xs mt-1">
                  {fieldErrors.establishedYear}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }));
                  if (fieldErrors.description) {
                    setFieldErrors((prev) => ({ ...prev, description: "" }));
                  }
                }}
                placeholder="Describe your academy, coaching philosophy, achievements, etc. (min. 20 characters)"
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-power-orange ${
                  fieldErrors.description
                    ? "border-red-300 bg-red-50"
                    : "border-slate-300 bg-white"
                }`}
                disabled={isSubmitting}
              />
              <div className="flex justify-between mt-1">
                {fieldErrors.description ? (
                  <p className="text-red-600 text-xs">
                    {fieldErrors.description}
                  </p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-slate-400">
                  {formData.description.length}/20 min
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sports Selection */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">
            Sports Offered <span className="text-red-500">*</span>
          </h3>
          <SportsMultiSelect
            value={formData.sports}
            onChange={(sports) =>
              setFormData((prev) => ({
                ...prev,
                sports,
              }))
            }
            disabled={isSubmitting}
            required
          />
          {fieldErrors.sports && (
            <p className="text-red-600 text-xs mt-2">{fieldErrors.sports}</p>
          )}
        </div>

        {/* Age Groups */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">
            Age Groups <span className="text-red-500">*</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { id: "kids", label: "Kids (5-12)" },
              { id: "teens", label: "Teens (13-17)" },
              { id: "adults", label: "Adults (18+)" },
              { id: "all", label: "All Ages" },
            ].map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={formData.ageGroups.includes(
                    group.id as "kids" | "teens" | "adults" | "all",
                  )}
                  onChange={() =>
                    toggleAgeGroup(
                      group.id as "kids" | "teens" | "adults" | "all",
                    )
                  }
                  className="w-4 h-4 rounded border-slate-300"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-slate-700">{group.label}</span>
              </label>
            ))}
          </div>
          {fieldErrors.ageGroups && (
            <p className="text-red-600 text-xs mt-2">{fieldErrors.ageGroups}</p>
          )}
        </div>

        {/* Logo Upload */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <h3 className="font-semibold text-slate-900 mb-3">
            Academy Logo (Optional)
          </h3>
          <div className="flex items-center gap-4">
            <label className="flex-1 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center cursor-pointer hover:border-power-orange hover:bg-orange-50 transition">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
                className="hidden"
                disabled={isSubmitting}
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-5 h-5 text-slate-500" />
                <span className="text-sm text-slate-600">
                  {logoFile ? logoFile.name : "Click to upload"}
                </span>
                <span className="text-xs text-slate-500">
                  Max 2MB (JPG, PNG)
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || loading}
            className="flex-1"
          >
            {isSubmitting ? "Creating Academy..." : "Create Academy & Continue"}
          </Button>
        </div>

        <div className="flex gap-2 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <Lightbulb className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">
            All information can be updated later. Complete the onboarding to go
            live.
          </p>
        </div>
      </form>
    </div>
  );
}
