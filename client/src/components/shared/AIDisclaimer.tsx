import { Info, Sparkles } from "lucide-react";
import React from "react";

export type AIDisclaimerVariant = "roadmap" | "guidance" | "chat" | "sportmatch" | "pdf";

interface AIDisclaimerProps {
  variant?: AIDisclaimerVariant;
  className?: string;
}

export function AIDisclaimer({ variant, className = "" }: AIDisclaimerProps) {
  let message = "AI-generated guidance. Verify details with a coach or academy before making decisions.";

  if (variant === "chat") {
    message = "AI-generated conversational coach. Verify advice with a professional.";
  } else if (variant === "sportmatch") {
    message = "AI-powered sport match. Verify with a coach before deciding.";
  } else if (variant === "roadmap") {
    message = "Pathway data sourced from India's sports development records. Verify milestones with a local academy.";
  }

  const Icon = variant === "chat" ? Info : Sparkles;

  return (
    <div className={`flex items-start gap-1.5 text-xs text-slate-400 ${className}`}>
      <Icon className="mt-[2px] h-3 w-3 shrink-0" />
      <p className="leading-snug">{message}</p>
    </div>
  );
}
