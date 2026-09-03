"use client";

import { toast } from "@/lib/toast";
import { Mail, X } from "lucide-react";
import { KeyboardEvent, useEffect, useRef, useState } from "react";

interface EmailVerificationModalProps {
  email: string;
  venueId: string;
  onVerified: () => void;
  onClose: () => void;
  showCloseButton?: boolean;
}

export default function EmailVerificationModal({
  email,
  venueId,
  onVerified,
  onClose,
  showCloseButton = true,
}: EmailVerificationModalProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take last digit
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join("");
      handleVerify(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "");
    const newCode = [...code];

    for (let i = 0; i < Math.min(pastedData.length, 6); i++) {
      newCode[i] = pastedData[i];
    }

    setCode(newCode);

    // Focus last filled input or first empty
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();

    // Auto-submit if all 6 digits pasted
    if (pastedData.length >= 6) {
      handleVerify(pastedData.slice(0, 6));
    }
  };

  const handleVerify = async (codeToVerify?: string) => {
    const verificationCode = codeToVerify || code.join("");

    if (verificationCode.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/venues/onboarding/verify-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            code: verificationCode,
            venueId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Verification failed");
      }

      // Success!
      onVerified();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/venues/onboarding/send-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            name: "Venue Lister", // We don't have name here, but it's ok
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to resend code");
      }

      // Reset timer and cooldown
      setTimeLeft(300);
      setCanResend(false);
      setResendCooldown(60); // 1 minute cooldown
      setCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            disabled={loading}
          >
            <X size={24} />
          </button>
        )}

        {/* Header */}
        <div className="mb-6 text-center">
          <div className="bg-power-orange/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
            <Mail size={30} className="text-power-orange" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-slate-900">Verify Your Email</h2>
          <p className="text-sm text-slate-600">
            We've sent a 6-digit code to
            <br />
            <span className="font-semibold text-slate-900">{email}</span>
          </p>
        </div>

        {/* OTP Input */}
        <div className="mb-6">
          <div className="mb-4 flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="focus:border-power-orange h-14 w-12 rounded-lg border-2 border-slate-300 text-center text-2xl font-bold transition focus:outline-none"
                disabled={loading}
              />
            ))}
          </div>

          {/* Timer */}
          <div className="mb-4 text-center text-sm text-slate-600">
            {timeLeft > 0 ? (
              <span>Code expires in {formatTime(timeLeft)}</span>
            ) : (
              <span className="text-error-red">Code expired</span>
            )}
          </div>
        </div>

        {/* Verify Button */}
        <button
          onClick={() => handleVerify()}
          disabled={loading || code.join("").length !== 6}
          className="bg-power-orange mb-4 w-full rounded-lg py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify Email"}
        </button>

        {/* Resend */}
        <div className="text-center text-sm">
          <span className="text-slate-600">Didn't receive the code? </span>
          {resendCooldown > 0 ? (
            <span className="text-slate-400">Resend in {resendCooldown}s</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-power-orange font-semibold hover:text-orange-600 disabled:opacity-50"
            >
              Resend Code
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
