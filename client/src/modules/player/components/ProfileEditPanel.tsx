import { cn } from "@/utils/cn";
import { ReactNode } from "react";

type ProfileEditPanelProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** The surface an edit form sits on: a plain white panel with a short lead-in. */
export function ProfileEditPanel({
  title,
  description,
  children,
  className,
}: ProfileEditPanelProps) {
  return (
    <div className={cn("border-hairline rounded-xl border bg-white p-4 sm:p-6", className)}>
      {(title || description) && (
        <div className="mb-5">
          {title && <p className="text-ink font-medium">{title}</p>}
          {description && (
            <p className="text-ink-muted mt-0.5 text-pretty text-sm">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-5">{children}</div>
    </div>
  );
}
