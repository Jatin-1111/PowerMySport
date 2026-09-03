import { sanitizeMobileNumber } from "@/modules/coach/utils/verificationFlow";
import ProfilePictureUpload from "@/modules/shared/components/ProfilePictureUpload";
import { Button } from "@/modules/shared/ui/Button";
import { User } from "@/types";
import { Award, Briefcase, Lightbulb, Star, Target, Users } from "lucide-react";

interface VerificationStep1Props {
  user: User | null;
  setUser: (user: User) => void;
  bio: string;
  setBio: (value: string) => void;
  mobileNumber: string;
  setMobileNumber: (value: string) => void;
  isLockedByReview: boolean;
  isStep1Complete: boolean;
  saving: boolean;
  onContinue: () => void;
}

export function VerificationStep1({
  user,
  setUser,
  bio,
  setBio,
  mobileNumber,
  setMobileNumber,
  isLockedByReview,
  isStep1Complete,
  saving,
  onContinue,
}: VerificationStep1Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-900">
          Profile Picture <span className="text-red-600">*</span>
        </label>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <ProfilePictureUpload
            currentPhotoUrl={user?.photoUrl}
            onUploadSuccess={(updatedUser) => {
              setUser(updatedUser);
            }}
            size="lg"
          />
          <div className="text-sm text-slate-600">
            <p className="font-medium">Upload your profile picture</p>
            <p className="text-xs text-slate-500">
              Required for verification. JPG, PNG or WebP (Max 5MB)
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-900">Bio (About You)</label>

        {/* Bio Tips Banner */}
        <div className="mb-4 rounded-lg border-l-4 border-blue-500 bg-indigo-50 p-4">
          <div className="mb-3 flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div className="flex-1">
              <p className="mb-2 font-semibold text-blue-900">Tips to Write a Great Bio</p>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    <strong>Experience:</strong> Years of coaching, sports background
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    <strong>Certifications:</strong> Relevant credentials and achievements
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    <strong>Specialization:</strong> What levels (beginner/advanced)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    <strong>Coaching Style:</strong> Your approach and philosophy
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                  <span>
                    <strong>Track Record:</strong> Success stories or player achievements
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          rows={5}
          disabled={isLockedByReview}
          minLength={20}
          maxLength={2000}
          className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
          placeholder="Tell players about your experience, achievements, and coaching style."
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-900">Mobile Number</label>
        <input
          type="tel"
          value={mobileNumber}
          onChange={(event) => setMobileNumber(sanitizeMobileNumber(event.target.value))}
          disabled={isLockedByReview}
          inputMode="tel"
          pattern="^[+]?[0-9\s().\-]+$"
          maxLength={20}
          className="focus:ring-power-orange/50 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2"
          placeholder="e.g., 9876543210"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={onContinue}
          disabled={isLockedByReview || saving || !isStep1Complete}
          className="w-full sm:w-auto"
        >
          Continue to Sports
        </Button>
      </div>
    </div>
  );
}
