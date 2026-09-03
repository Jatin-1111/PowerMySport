import { Card } from "@/modules/shared/ui/Card";
import ProfilePictureUpload from "@/modules/shared/components/ProfilePictureUpload";
import { Coach, User } from "@/types";
import { LucideIcon } from "lucide-react";

interface ProfileHeaderCardProps {
  user: User | null;
  setUser: (user: User) => void;
  coachProfile: Coach | null;
  badge: { label: string; className: string; icon: LucideIcon };
  guidance: string;
  sportsCount: number;
  basePrice: number;
  totalSlots: number;
}

export function ProfileHeaderCard({
  user,
  setUser,
  coachProfile,
  badge,
  guidance,
  sportsCount,
  basePrice,
  totalSlots,
}: ProfileHeaderCardProps) {
  const BadgeIcon = badge.icon;

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className="bg-linear-to-r from-slate-50 to-white px-4 py-5 sm:px-6 md:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <ProfilePictureUpload
              currentPhotoUrl={user?.photoUrl}
              onUploadSuccess={(updatedUser) => {
                setUser(updatedUser);
              }}
              size="xl"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Coach Dashboard
              </p>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl md:text-4xl">
                {user?.name || "Coach"}
              </h2>
              <div className="mt-2 space-y-1">
                {user?.email && (
                  <p className="break-all text-sm font-medium text-slate-600">{user.email}</p>
                )}
                {user?.phone && <p className="text-sm text-slate-600">{user.phone}</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
            >
              <BadgeIcon size={14} />
              {badge.label}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          {guidance}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sports</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{sportsCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Starting Price
            </p>
            <p className="text-power-orange mt-1 text-xl font-bold sm:text-2xl">
              ₹{basePrice || 0}/hr
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Service Mode
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {coachProfile?.serviceMode === "OWN_VENUE"
                ? "Own Venue"
                : coachProfile?.serviceMode === "HYBRID"
                  ? "Hybrid"
                  : "Freelance"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Time Slots
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalSlots}</p>
          </div>
        </div>

        {coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-semibold">Rejection Notes:</p>
            {coachProfile.verificationNotes}
          </div>
        )}
      </div>
    </Card>
  );
}
