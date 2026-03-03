import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-slate-100 p-6 mb-4">
        <Icon size={48} className="text-slate-400" />
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 mb-6 max-w-sm">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex gap-3">
          {actionLabel && onAction && (
            <Button onClick={onAction} variant="primary">
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button onClick={onSecondaryAction} variant="outline">
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
