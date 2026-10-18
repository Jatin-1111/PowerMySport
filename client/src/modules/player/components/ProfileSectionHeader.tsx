import { Button } from "@/modules/shared/ui/Button";
import { cn } from "@/utils/cn";
import { LucideIcon, Pencil, X } from "lucide-react";
import { ReactNode } from "react";
import { ProfileCompletionRing } from "./ProfileCompletionRing";

type ProfileSectionHeaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  isEditing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  action?: ReactNode;
  className?: string;
  /** 0-100. When provided, wraps the icon in a profile-completion ring. */
  completionPercent?: number;
  /** Id of the heading, so the section can be labelled by it. */
  headingId?: string;
};

/**
 * The heading row of a profile section: a serif title with a one-line
 * description, and the section's edit controls on the right.
 */
export function ProfileSectionHeader({
  icon: Icon,
  title,
  description,
  isEditing = false,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  saveLabel = "Save changes",
  action,
  className,
  completionPercent,
  headingId,
}: ProfileSectionHeaderProps) {
  // Inside a completion ring the tile is a circle that clears the ring's stroke.
  const icon = (
    <div
      className={cn(
        "bg-paper-deep text-ink flex shrink-0 items-center justify-center",
        completionPercent !== undefined ? "h-9 w-9 rounded-full" : "h-10 w-10 rounded-lg"
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </div>
  );
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="flex items-start gap-4">
        {completionPercent !== undefined ? (
          <ProfileCompletionRing percent={completionPercent} size={48} strokeWidth={3}>
            {icon}
          </ProfileCompletionRing>
        ) : (
          icon
        )}
        <div>
          <h2
            id={headingId}
            className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
          >
            {title}
          </h2>
          <p className="text-ink-muted mt-1 text-pretty text-sm">
            {isEditing ? "Make your changes below, then save or cancel." : description}
            {!isEditing && completionPercent !== undefined && completionPercent < 100 && (
              <span className="text-ink tabular-nums"> {completionPercent}% complete.</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!isEditing && action}
        {isEditing ? (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={saving}
              icon={<X size={14} />}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={onSave} loading={saving}>
              {saveLabel}
            </Button>
          </>
        ) : (
          onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onEdit}
              icon={<Pencil size={14} />}
            >
              Edit
            </Button>
          )
        )}
      </div>
    </div>
  );
}
