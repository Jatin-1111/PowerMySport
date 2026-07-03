import { Badge } from "@/components/ui/badge";
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
};

export function ProfileSectionHeader({
  icon: Icon,
  title,
  description,
  isEditing = false,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  saveLabel = "Save Changes",
  action,
  className,
  completionPercent,
}: ProfileSectionHeaderProps) {
  const iconBox = (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
        isEditing
          ? "bg-power-orange text-white"
          : "bg-power-orange/10 text-power-orange",
      )}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-start sm:justify-between",
        isEditing
          ? "border-power-orange/20 bg-orange-50/40"
          : "border-slate-200/60",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {completionPercent !== undefined ? (
          <ProfileCompletionRing percent={completionPercent} size={48} strokeWidth={3}>
            {iconBox}
          </ProfileCompletionRing>
        ) : (
          iconBox
        )}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              {title}
            </h2>
            {isEditing && (
              <Badge className="border-orange-200 bg-white text-orange-700 hover:bg-white">
                Editing
              </Badge>
            )}
            {!isEditing && completionPercent !== undefined && completionPercent < 100 && (
              <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                {completionPercent}% complete
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {isEditing
              ? "Make your changes below, then save or cancel."
              : description}
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
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              loading={saving}
            >
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
