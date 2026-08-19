"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";

interface BackButtonProps {
  label?: string;
  onClick?: () => void;
  /**
   * Was `"ghost" | "outline" | "default"` against a second, near-duplicate
   * button that this component was the only consumer of. Now typed against the
   * primitive the other 71 call sites use; `"default"` had no equivalent there
   * and no caller passed it.
   */
  variant?: "ghost" | "outline" | "primary";
  className?: string;
}

export function BackButton({
  label = "Back",
  onClick,
  variant = "ghost",
  className,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.back();
    }
  };

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      className={className}
      aria-label={label}
    >
      <ChevronLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
}
