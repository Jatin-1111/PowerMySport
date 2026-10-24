"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { statsApi } from "@/modules/analytics/services/stats";
import { adminApi } from "@/modules/admin/services/admin";
import { toast } from "@/lib/toast";
import { Venue } from "@/types";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { btn, fieldClass, labelClass } from "@/modules/shared/ui/buttonStyles";
import { Panel } from "@/modules/shared/ui/Panel";
import { StatusBadge } from "@/modules/shared/ui/StatusBadge";
import { ArrowLeft, Image as ImageIcon, Pencil, Star, X } from "lucide-react";
import { ErrorNotice, SkeletonBlock } from "@/modules/shared/ui/States";

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

  const header = (
    <AdminPageHeader
      badge="Commerce"
      title={venue?.name || "Venue"}
      subtitle={venue?.address || (loading ? "Loading venue" : "Venue details")}
      action={
        venue ? (
          <div className="flex items-center gap-3">
            <StatusBadge status={venue.approvalStatus || "PENDING"} />
            <button type="button" onClick={openEdit} className={btn("outline")}>
              <Pencil size={14} aria-hidden /> Edit venue
            </button>
          </div>
        ) : undefined
      }
    />
  );

  const back = (
    <Link
      href="/admin/venues"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
    >
      <ArrowLeft size={16} aria-hidden />
      Venues
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonBlock rows={8} label="Loading venue" />
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="space-y-6">
        {header}
        {back}
        <ErrorNotice message={error || "We couldn't find this venue."} onRetry={fetchVenue} />
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
  const owner =
    typeof venue.ownerId === "object" && venue.ownerId !== null
      ? (venue.ownerId as { name?: string; email?: string; phone?: string })
      : null;

  const facts: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Price per hour", value: <span className="tabular-nums">₹{venue.pricePerHour}</span> },
    {
      label: "Rating",
      value: venue.rating ? (
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Star className="size-4 fill-amber-500 text-amber-500" aria-hidden />
          {venue.rating.toFixed(1)}
          <span className="font-normal text-slate-500">({venue.reviewCount || 0} reviews)</span>
        </span>
      ) : (
        "No reviews yet"
      ),
    },
    { label: "Listed on", value: joinedDate },
    {
      label: "External coaches",
      value: venue.allowExternalCoaches ? "Allowed" : "Not allowed",
    },
    {
      label: "Coordinates",
      value: venue.location?.coordinates ? (
        <span className="font-mono text-xs">
          {venue.location.coordinates[1]}, {venue.location.coordinates[0]}
        </span>
      ) : (
        "Not set"
      ),
    },
    {
      label: "Venue ID",
      value: <span className="break-all font-mono text-xs">{venue.id || venue._id}</span>,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {header}
      {back}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="space-y-6">
          <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-900/5 md:h-72">
            {imageUrl ? (
              <Image src={imageUrl} alt={`Photo of ${venue.name}`} fill className="object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="size-12 text-slate-300" aria-hidden />
              </div>
            )}
          </div>

          <Panel title="About this venue">
            <p className="max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {venue.description || "No description provided."}
            </p>
          </Panel>

          <Panel title="Sports and amenities">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm text-slate-500">Sports</p>
                {venue.sports && venue.sports.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {venue.sports.map((sport) => (
                      <li
                        key={sport}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-800"
                      >
                        {sport}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No sports listed.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-500">Amenities</p>
                {venue.amenities && venue.amenities.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {venue.amenities.map((amenity) => (
                      <li
                        key={amenity}
                        className="rounded-md bg-orange-50 px-2.5 py-1 text-sm font-medium text-orange-900"
                      >
                        {amenity}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No amenities listed.</p>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Details">
            <dl className="divide-y divide-slate-100">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <dt className="shrink-0 text-sm text-slate-500">{fact.label}</dt>
                  <dd className="min-w-0 text-right text-sm font-medium text-slate-900">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Owner">
            {owner ? (
              <div className="text-sm text-slate-900">
                <p className="font-semibold">{owner.name || "Unknown"}</p>
                {owner.email && <p className="mt-1 text-slate-600">{owner.email}</p>}
                {owner.phone && <p className="text-slate-600">{owner.phone}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Owner details aren&apos;t available.</p>
            )}
          </Panel>
        </div>
      </div>

      {isEditing && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={closeEdit}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Edit venue"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_32px_-16px_rgb(15_23_42/0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Edit venue</h2>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Close"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="v-name" className={labelClass}>
                  Name
                </label>
                <input
                  id="v-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => prev && { ...prev, name: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="v-desc" className={labelClass}>
                  Description
                </label>
                <textarea
                  id="v-desc"
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, description: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="v-sports" className={labelClass}>
                  Sports (comma separated)
                </label>
                <input
                  id="v-sports"
                  value={editForm.sports}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, sports: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="v-amen" className={labelClass}>
                  Amenities (comma separated)
                </label>
                <input
                  id="v-amen"
                  value={editForm.amenities}
                  onChange={(e) =>
                    setEditForm((prev) => prev && { ...prev, amenities: e.target.value })
                  }
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="v-price" className={labelClass}>
                    Price per hour (₹)
                  </label>
                  <input
                    id="v-price"
                    type="number"
                    value={editForm.pricePerHour}
                    onChange={(e) =>
                      setEditForm(
                        (prev) => prev && { ...prev, pricePerHour: Number(e.target.value) }
                      )
                    }
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label htmlFor="v-status" className={labelClass}>
                    Approval status
                  </label>
                  <select
                    id="v-status"
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
                    className={fieldClass}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="REVIEW">In review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.allowExternalCoaches}
                  onChange={(e) =>
                    setEditForm(
                      (prev) => prev && { ...prev, allowExternalCoaches: e.target.checked }
                    )
                  }
                  className="size-4 rounded accent-orange-700"
                />
                Allow external coaches
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className={btn("outline")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className={btn("primary")}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
