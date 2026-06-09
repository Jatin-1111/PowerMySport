import { cn } from "@/utils/cn";
import { PencilLine } from "lucide-react";
import { ReactNode } from "react";

type ProfileEditPanelProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function ProfileEditPanel({
  title = "Editing",
  description,
  children,
  className,
}: ProfileEditPanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-power-orange/20 bg-gradient-to-br from-orange-50/80 to-white p-4 ring-1 ring-power-orange/10 sm:p-5",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-power-orange/10 text-power-orange">
          <PencilLine className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {description && (
            <p className="mt-0.5 text-xs text-slate-600">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
