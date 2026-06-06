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
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"
      >
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
        {label}
        {required && <span className="text-power-orange">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
