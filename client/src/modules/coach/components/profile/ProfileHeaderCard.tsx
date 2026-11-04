import ProfilePictureUpload from "@/modules/shared/components/ProfilePictureUpload";
import { StatusTag } from "@/modules/shared/ui/StatusTag";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { Coach, User } from "@/types";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { VerificationView } from "../../utils/overview";

interface ProfileHeaderCardProps {
  user: User | null;
  setUser: (user: User) => void;
  coachProfile: Coach | null;
  view: VerificationView;
}

/**
 * Who this profile is: photo, name, how to reach them, and where verification
 * stands. The figures that used to sit here as tiles (sports, rate, mode,
 * slots) are on the overview and in the sections below, so they are not
 * repeated.
 */
export function ProfileHeaderCard({ user, setUser, coachProfile, view }: ProfileHeaderCardProps) {
  const publicId = coachProfile?.id || coachProfile?._id;
  const contact = [user?.email, user?.phone].filter(Boolean).join(", ");

  return (
    <header className="flex flex-col gap-6 pb-10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-5">
        <ProfilePictureUpload
          currentPhotoUrl={user?.photoUrl}
          onUploadSuccess={(updatedUser) => setUser(updatedUser)}
          variant="compact"
        />
        <div className="min-w-0">
          <p className="text-ink-body text-sm">Profile</p>
          <h1 className="font-editorial text-ink mt-1 text-balance text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl">
            {user?.name || "Your profile"}
          </h1>
          {contact && <p className="text-ink-body mt-2 break-words">{contact}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <StatusTag tone={view.tone}>{view.tag}</StatusTag>
        {view.tone === "live" && publicId && (
          <Link href={`/coaches/${publicId}`} className={`${TEXT_LINK} ring-offset-paper`}>
            View public profile
            <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        )}
      </div>
    </header>
  );
}
