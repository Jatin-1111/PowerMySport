import { cn } from "@/utils/cn";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

type ProfileEditFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function ProfileEditField({
  label,
  htmlFor,
  required = false,
  hint,
  icon: Icon,
  children,
  className,
}: ProfileEditFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-ink flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="text-ink-muted h-4 w-4" aria-hidden="true" />}
        {label}
        {required && <span aria-hidden="true">*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {children}
      {hint && <p className="text-ink-muted text-pretty text-sm">{hint}</p>}
    </div>
  );
}
