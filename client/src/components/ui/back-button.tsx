"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./button";

interface BackButtonProps {
  label?: string;
  onClick?: () => void;
  variant?: "ghost" | "outline" | "default";
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
