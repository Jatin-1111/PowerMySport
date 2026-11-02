import { StatTile } from "@/modules/shared/ui/StatTile";
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
    <section aria-label="Profile summary">
      <div>
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
              <p className="text-sm text-slate-600">Profile</p>
              <h1 className="font-editorial text-3xl font-light tracking-tight text-slate-900 sm:text-4xl">
                {user?.name || "Coach"}
              </h1>
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
              className={`inline-flex items-center gap-2 rounded-sm px-3 py-1 text-xs font-semibold ${badge.className}`}
            >
              <BadgeIcon size={14} />
              {badge.label}
            </span>
          </div>
        </div>

        <div className="bg-paper-deep text-ink-body mt-6 rounded-xl px-4 py-3 text-sm">
          {guidance}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Sports" value={sportsCount} />
          <StatTile label="Starting price" value={`₹${basePrice || 0}/hr`} />
          <StatTile
            label="Service mode"
            value={
              <span className="text-2xl sm:text-3xl">
                {coachProfile?.serviceMode === "OWN_VENUE"
                  ? "Own venue"
                  : coachProfile?.serviceMode === "HYBRID"
                    ? "Hybrid"
                    : "Freelance"}
              </span>
            }
          />
          <StatTile label="Time slots" value={totalSlots} />
        </div>

        {coachProfile?.verificationNotes && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="mb-1 font-semibold">Rejection notes</p>
            {coachProfile.verificationNotes}
          </div>
        )}
      </div>
    </section>
  );
}
