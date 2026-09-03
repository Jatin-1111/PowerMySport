import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { Booking, CoachVerificationDocument, User } from "@/types";
import { formatDate, formatTime } from "@/utils/format";
import { CheckCircle, LogOut, LucideIcon } from "lucide-react";
import Link from "next/link";

interface CheckInCardProps {
  checkInCode: string;
  setCheckInCode: (value: string) => void;
  checkInLoading: boolean;
  checkInMessage: string | null;
  checkedInBooking: Booking | null;
  onCheckIn: () => void;
}

export function CheckInCard({
  checkInCode,
  setCheckInCode,
  checkInLoading,
  checkInMessage,
  checkedInBooking,
  onCheckIn,
}: CheckInCardProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <h3 className="mb-2 text-lg font-semibold text-slate-900">Session Check-in</h3>
      <p className="mb-3 text-xs text-slate-500">
        Enter the player&#39;s 8-character code to start the session.
      </p>
      <div className="space-y-3">
        <input
          type="text"
          value={checkInCode}
          maxLength={8}
          onChange={(event) => {
            const nextValue = event.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 8);
            setCheckInCode(nextValue);
          }}
          placeholder="Enter 8-character code"
          className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-[0.35em] text-slate-900 focus:outline-none"
          autoComplete="one-time-code"
        />
        <Button type="button" onClick={onCheckIn} disabled={checkInLoading} className="w-full">
          {checkInLoading ? "Verifying..." : "Confirm Check-in"}
        </Button>
      </div>
      {checkInMessage && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${
            checkedInBooking
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {checkInMessage}
        </div>
      )}
      {checkedInBooking && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <p className="font-semibold">Session started</p>
          <p className="mt-1">
            {checkedInBooking.sport} - {formatDate(checkedInBooking.date)}
          </p>
          <p>
            {formatTime(checkedInBooking.startTime)} - {formatTime(checkedInBooking.endTime)}
          </p>
          {checkedInBooking.participantName && (
            <p className="mt-1">Player: {checkedInBooking.participantName}</p>
          )}
        </div>
      )}
      <Link
        href="/coach/my-bookings"
        className="text-power-orange mt-3 inline-flex text-xs font-semibold hover:text-orange-600"
      >
        View upcoming bookings
      </Link>
    </Card>
  );
}

interface VerificationStatusCardProps {
  badge: { label: string; className: string; icon: LucideIcon };
  guidance: string;
  status: string;
}

export function VerificationStatusCard({ badge, guidance, status }: VerificationStatusCardProps) {
  const BadgeIcon = badge.icon;

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Verification Status</h3>
      <div className="space-y-3 text-sm">
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Status</p>
          <span
            className={`inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-semibold ${badge.className}`}
          >
            <BadgeIcon size={12} />
            {badge.label}
          </span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
          {guidance}
        </div>
        {status === "VERIFIED" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle size={13} />
              Profile verified and visible to players
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

interface ProfileInfoCardProps {
  user: User | null;
  isEditing: boolean;
  isSaving: boolean;
  profileForm: { name: string; email: string; phone: string };
  setProfileForm: (
    updater: (prev: { name: string; email: string; phone: string }) => {
      name: string;
      email: string;
      phone: string;
    }
  ) => void;
  onEditClick: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function ProfileInfoCard({
  user,
  isEditing,
  isSaving,
  profileForm,
  setProfileForm,
  onEditClick,
  onSave,
  onCancel,
}: ProfileInfoCardProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-lg font-semibold text-slate-900">Profile Info</h3>
        {!isEditing && (
          <button
            type="button"
            onClick={onEditClick}
            className="bg-power-orange rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Name
            </label>
            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
              className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
              className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              placeholder="Your email"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
              Phone
            </label>
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="focus:border-power-orange w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none"
              placeholder="Your phone number"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="bg-power-orange flex-1 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Name</p>
            <p className="font-medium text-slate-900">{user?.name || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
            <p className="break-all font-medium text-slate-900">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Phone</p>
            <p className="font-medium text-slate-900">{user?.phone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
            <p className="font-medium text-slate-900">Coach</p>
          </div>
        </div>
      )}
    </Card>
  );
}

export function QuickActionsCard({ onLogout }: { onLogout: () => void }) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Quick Actions</h3>
      <div className="space-y-2">
        <Button
          type="button"
          onClick={onLogout}
          variant="secondary"
          className="flex w-full items-center justify-center gap-2"
        >
          <LogOut size={18} />
          Logout
        </Button>
      </div>
    </Card>
  );
}

export function VerificationDocumentsCard({
  documents,
}: {
  documents: CoachVerificationDocument[];
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-slate-900">Verification Documents</h3>
      <div className="space-y-2">
        {documents.map((doc, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <div>
              <p className="text-sm font-medium text-slate-900">{doc.type}</p>
              <p className="text-xs text-slate-500">{doc.fileName}</p>
            </div>
            <CheckCircle size={16} className="text-emerald-600" />
          </div>
        ))}
      </div>
    </Card>
  );
}
