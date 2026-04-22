"use client";

import { useEffect } from "react";

const alphabetRegex = /[A-Za-z]/;

const isGuardedInput = (
  target: EventTarget | null,
): target is HTMLInputElement => {
  return (
    target instanceof HTMLInputElement &&
    (target.type === "number" || target.type === "tel")
  );
};

export function NumericInputGuard() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isGuardedInput(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key.length === 1 && alphabetRegex.test(event.key)) {
        event.preventDefault();
      }
    };

    const handleInput = (event: Event) => {
      if (!isGuardedInput(event.target)) return;

      const sanitized = event.target.value.replace(/[A-Za-z]/g, "");
      if (sanitized !== event.target.value) {
        event.target.value = sanitized;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("input", handleInput, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("input", handleInput, true);
    };
  }, []);

  return null;
}
