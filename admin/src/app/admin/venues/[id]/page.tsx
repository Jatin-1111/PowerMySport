"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { statsApi } from "@/modules/analytics/services/stats";
import { adminApi } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import { Venue } from "@/types";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { Card } from "@/modules/shared/ui/Card";
import {
  ArrowLeft,
  MapPin,
  Star,
  Clock,
  Info,
  CheckCircle2,
  Activity,
  XCircle,
  FileText,
  Image as ImageIcon,
  Pencil,
  X,
} from "lucide-react";

interface VenueEditForm {
  name: string;
  description: string;
  pricePerHour: number;
  sports: string;
  amenities: string;
  allowExternalCoaches: boolean;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVIEW";
}

export default function AdminVenueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const venueId = params.id as string;

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<VenueEditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchVenue = async () => {
    try {
      setLoading(true);
      const response = await statsApi.getVenueById(venueId);
      if (response.success && response.data) {
        setVenue(response.data);
      } else {
        setError(response.message || "Failed to load venue details");
      }
    } catch (err) {
      console.error("Error fetching venue:", err);
      setError("Failed to load venue details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!venueId) return;
    fetchVenue();
  }, [venueId]);

  const openEdit = () => {
    if (!venue) return;
    setEditForm({
      name: venue.name,
      description: venue.description || "",
      pricePerHour: venue.pricePerHour,
      sports: (venue.sports || []).join(", "),
      amenities: (venue.amenities || []).join(", "),
      allowExternalCoaches: venue.allowExternalCoaches,
      approvalStatus: venue.approvalStatus || "PENDING",
    });
    setIsEditing(true);
  };

  const closeEdit = () => {
    setIsEditing(false);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    setSaving(true);
    try {
      const response = await adminApi.updateVenue(venueId, {
        name: editForm.name,
        description: editForm.description,
        pricePerHour: editForm.pricePerHour,
        sports: editForm.sports
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        amenities: editForm.amenities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        allowExternalCoaches: editForm.allowExternalCoaches,
        approvalStatus: editForm.approvalStatus,
      });
      if (response.success) {
        toast.success("Venue updated.");
        closeEdit();
        await fetchVenue();
      } else {
        toast.error(response.message || "Failed to update venue.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to update venue.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="border-t-power-orange h-8 w-8 animate-spin rounded-full border-4 border-slate-200"></div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="space-y-6">
        <div className="mb-4 flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-900">
          <ArrowLeft size={20} />
          <button onClick={() => router.push("/admin/venues")} className="font-semibold">
            Back to Venues
          </button>
        </div>
        <Card className="bg-white">
          <div className="space-y-3 py-10 text-center">
            <p className="font-semibold text-red-600">{error || "Venue not found"}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
            >
              Retry
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const imageUrl = venue.coverPhotoUrl || (venue.images && venue.images[0]) || null;
  const joinedDate = venue.createdAt
    ? new Date(venue.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  return (
    <div className="space-y-6 pb-12">
      <div className="mb-2 flex items-center justify-between">
        <Link
          href="/admin/venues"
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Venues
        </Link>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              venue.approvalStatus === "APPROVED"
                ? "bg-emerald-100 text-emerald-700"
                : venue.approvalStatus === "REJECTED"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            {venue.approvalStatus || "PENDING"}
          </span>
          <button
            onClick={openEdit}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil size={14} /> Edit
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm md:h-80">
        {imageUrl ? (
          <Image src={imageUrl} alt={venue.name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <ImageIcon className="h-16 w-16 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 flex w-full flex-col justify-between gap-4 p-6 md:flex-row md:items-end md:p-8">
          <div className="text-white">
            <h1 className="mb-2 text-3xl font-extrabold text-white drop-shadow-md md:text-4xl">
              {venue.name}
            </h1>
            <p className="flex items-center gap-2 text-sm font-medium text-white/90 md:text-base">
              <MapPin size={18} />
              {venue.address || "Location not provided"}
            </p>
          </div>
          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/20 px-4 py-2 text-white shadow-lg backdrop-blur-md">
              <span className="text-sm font-semibold tracking-wider uppercase">Base Price</span>
              <span className="text-2xl font-bold">₹{venue.pricePerHour}</span>
              <span className="text-xs font-medium opacity-80">/hr</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content - Left Column */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <FileText className="text-power-orange" size={24} />
              <h2 className="text-xl font-bold text-slate-900">About this Venue</h2>
            </div>
            <p className="leading-relaxed whitespace-pre-line text-slate-600">
              {venue.description || "No description provided."}
            </p>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Activity className="text-power-orange" size={24} />
              <h2 className="text-xl font-bold text-slate-900">Sports Available</h2>
            </div>
            {venue.sports && venue.sports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {venue.sports.map((sport) => (
                  <div
                    key={sport}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    {sport}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No sports listed.</p>
            )}
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <CheckCircle2 className="text-power-orange" size={24} />
              <h2 className="text-xl font-bold text-slate-900">Amenities</h2>
            </div>
            {venue.amenities && venue.amenities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {venue.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="bg-power-orange/10 text-power-orange rounded-full px-3 py-1.5 text-xs font-semibold"
                  >
                    {amenity}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">No amenities listed.</p>
            )}
          </Card>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Info className="text-slate-700" size={20} />
              <h2 className="text-lg font-bold text-slate-900">Quick Stats</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Rating</span>
                <div className="flex items-center gap-1 font-bold text-amber-600">
                  <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                  {venue.rating ? venue.rating.toFixed(1) : "New"}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Reviews</span>
                <span className="font-semibold text-slate-900">{venue.reviewCount || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">Listed On</span>
                <span className="text-sm font-semibold text-slate-900">{joinedDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500">External Coaches</span>
                <span className="text-sm font-semibold text-slate-900">
                  {venue.allowExternalCoaches ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 size={14} /> Allowed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle size={14} /> Not Allowed
                    </span>
                  )}
                </span>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Clock className="text-slate-700" size={20} />
              <h2 className="text-lg font-bold text-slate-900">Location Data</h2>
            </div>
            <div className="space-y-3">
              <div>
                <span className="mb-1 block text-xs font-medium tracking-wider text-slate-500 uppercase">
                  Coordinates
                </span>
                <p className="rounded border border-slate-100 bg-slate-50 p-2 font-mono text-sm text-slate-700">
                  {venue.location?.coordinates
                    ? `${venue.location.coordinates[1]}, ${venue.location.coordinates[0]}`
                    : "N/A"}
                </p>
              </div>
              <div>
                <span className="mb-1 block text-xs font-medium tracking-wider text-slate-500 uppercase">
                  Venue ID
                </span>
                <p className="font-mono text-xs break-all text-slate-500">
                  {venue.id || venue._id}
                </p>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 bg-white shadow-sm">
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Info className="text-slate-700" size={20} />
              <h2 className="text-lg font-bold text-slate-900">Owner</h2>
            </div>
            {typeof venue.ownerId === "object" && venue.ownerId !== null ? (
              <div className="text-sm text-slate-900">
                <p className="font-semibold">
                  {(venue.ownerId as { name?: string }).name || "Unknown"}
                </p>
                {(venue.ownerId as { email?: string }).email && (
                  <p className="mt-1 text-xs text-slate-500">
                    {(venue.ownerId as { email?: string }).email}
                  </p>
                )}
                {(venue.ownerId as { phone?: string }).phone && (
                  <p className="text-xs text-slate-500">
                    {(venue.ownerId as { phone?: string }).phone}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Owner unavailable</p>
            )}
          </Card>
        </div>
      </div>

      {isEditing && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={closeEdit}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-bold text-slate-900">Edit venue</h2>
              <button
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Name
                </label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => prev && { ...prev, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, description: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Sports (comma separated)
                </label>
                <input
                  value={editForm.sports}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, sports: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  Amenities (comma separated)
                </label>
                <input
                  value={editForm.amenities}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, amenities: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Price per hour (₹)
                  </label>
                  <input
                    type="number"
                    value={editForm.pricePerHour}
                    onChange={(e) =>
                      setEditForm(
                        (prev) =>
                          prev && {
                            ...prev,
                            pricePerHour: Number(e.target.value),
                          }
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Approval status
                  </label>
                  <select
                    value={editForm.approvalStatus}
                    onChange={(e) =>
                      setEditForm(
                        (prev) =>
                          prev && {
                            ...prev,
                            approvalStatus: e.target.value as VenueEditForm["approvalStatus"],
                          }
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="REVIEW">REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.allowExternalCoaches}
                  onChange={(e) =>
                    setEditForm(
                      (prev) =>
                        prev && {
                          ...prev,
                          allowExternalCoaches: e.target.checked,
                        }
                    )
                  }
                  className="h-4 w-4 rounded"
                />
                Allow external coaches
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
