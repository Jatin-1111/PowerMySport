"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { communityService } from "@/modules/community/services/community";
import { CommunityGroupAudience } from "@/modules/community/types";
import SportsSelect from "@/modules/sports/components/SportsSelect";
import {
  X,
  Upload,
  Loader2,
  Users,
  MapPin,
  AlignLeft,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface CreateCommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCommunityModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCommunityModalProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [audience, setAudience] = useState<CommunityGroupAudience>("ALL");

  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Only JPEG, PNG, and WEBP images are supported");
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setProfilePictureUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sport) {
      setError("Name and Sport are required fields.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      let finalProfilePicture = "";
      let finalProfilePictureKey = "";

      if (selectedFile) {
        const { uploadUrl, downloadUrl, key } = await communityService.getGroupImageUploadUrl(
          selectedFile.type as any
        );
        const s3Response = await fetch(uploadUrl, {
          method: "PUT",
          body: selectedFile,
          headers: { "Content-Type": selectedFile.type },
        });
        if (!s3Response.ok) {
          throw new Error("Failed to upload image to S3");
        }
        finalProfilePicture = downloadUrl;
        finalProfilePictureKey = key;
      }

      const newGroup = await communityService.createGroup({
        name,
        description,
        sport,
        city: city || undefined,
        audience,
        profilePicture: finalProfilePicture || undefined,
        profilePictureKey: finalProfilePictureKey || undefined,
      });

      onSuccess();
      onClose();
      // Optionally route them to the new group
      // router.push(`/chats?sidebar=groups`);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to create community.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[201] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 p-4"
          >
            <div className="flex max-h-[90vh] flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-900/5">
              {/* Header */}
              <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 py-5 sm:px-8 sm:py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-title text-xl font-bold tracking-tight text-slate-900">
                      Create Community
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Start a new group for your sport or city.
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-600"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <div className="overflow-y-auto px-6 py-6 sm:px-8">
                <form
                  id="create-community-form"
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6"
                >
                  {/* Profile Picture Mock */}
                  <div className="flex flex-col items-center gap-4 sm:flex-row">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-4 ring-white shadow-sm">
                      {profilePictureUrl ? (
                        <img
                          src={profilePictureUrl}
                          alt="Community preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-power-orange/20 to-power-orange/5 text-3xl font-bold text-power-orange">
                          {name ? name.charAt(0).toUpperCase() : <Users size={32} className="text-power-orange/40" />}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center sm:items-start">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:bg-slate-100"
                      >
                        <Upload size={16} className="text-slate-400" />
                        Upload Logo
                      </button>
                      <p className="mt-2 text-center text-xs text-slate-500 sm:text-left">
                        Optional. Recommended size 512x512px.
                      </p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Users size={16} className="text-power-orange" />
                      Community Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Downtown Runners"
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm shadow-sm transition focus:border-power-orange/50 focus:outline-none focus:ring-4 focus:ring-power-orange/10"
                    />
                  </div>

                  {/* Sport */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 text-turf-green"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                        <path d="M2 12h20" />
                      </svg>
                      Primary Sport *
                    </label>
                    <SportsSelect
                      value={sport}
                      onChange={setSport}
                      required
                      placeholder="Search or add a sport..."
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <MapPin size={16} className="text-blue-500" />
                      City (Optional)
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. New York, NY"
                      className="w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm shadow-sm transition focus:border-blue-500/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <AlignLeft size={16} className="text-purple-500" />
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is this community about?"
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3.5 text-sm shadow-sm transition focus:border-purple-500/50 focus:outline-none focus:ring-4 focus:ring-purple-500/10"
                    />
                  </div>

                  {/* Audience */}
                  <div>
                    <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Shield size={16} className="text-slate-500" />
                      Who can join?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          "ALL",
                          "PLAYERS_ONLY",
                          "COACHES_ONLY",
                        ] as CommunityGroupAudience[]
                      ).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setAudience(opt)}
                          className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${
                            audience === opt
                              ? "bg-slate-900 text-white shadow-md"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {opt.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
                      {error}
                    </div>
                  )}
                </form>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="rounded-2xl px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-community-form"
                  disabled={isSubmitting}
                  className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-power-orange px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-power-orange/20 transition hover:bg-[#d96610] focus:outline-none focus:ring-4 focus:ring-power-orange/20 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Community"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
