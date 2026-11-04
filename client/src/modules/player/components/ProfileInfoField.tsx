import { cn } from "@/utils/cn";
import { ReactNode } from "react";

type ProfileInfoFieldProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

/** One label and value pair, read as a definition list entry. */
export function ProfileInfoField({ label, children, className }: ProfileInfoFieldProps) {
  return (
    <div className={cn("border-hairline min-w-0 border-t pt-3", className)}>
      <dt className="text-ink-muted text-sm">{label}</dt>
      <dd className="text-ink mt-1 break-words text-base">{children}</dd>
    </div>
  );
}
