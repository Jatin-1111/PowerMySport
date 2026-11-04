import { LucideIcon } from "lucide-react";
import React from "react";
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
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="bg-paper-deep text-ink-muted mb-5 flex h-12 w-12 items-center justify-center rounded-lg">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="font-editorial text-ink mb-2 text-balance text-2xl font-light tracking-tight">
        {title}
      </h3>
      <p className="text-ink-muted mb-6 max-w-sm text-pretty">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap justify-center gap-3">
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
