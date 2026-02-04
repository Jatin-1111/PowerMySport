import React, { useEffect, useState } from "react";

interface BookingTimerProps {
  expiresAt: string;
  onExpire?: () => void;
}

export default function BookingTimer({
  expiresAt,
  onExpire,
}: BookingTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (timeLeft === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600 font-semibold">⏰ Booking Expired</p>
        <p className="text-sm text-red-500 mt-1">
          This booking has expired. Please create a new booking.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
      <p className="text-sm text-muted-foreground mb-2">
        Complete payment within:
      </p>
      <p className="text-3xl font-bold text-power-orange">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        Booking will expire after 10 minutes
      </p>
    </div>
  );
}
