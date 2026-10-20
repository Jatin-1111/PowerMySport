import { useEffect, useState } from "react";

/** One curve for every movement in the "My Child" options: a fast start that settles. */
export const EASE = [0.32, 0.72, 0, 1] as const;

export const LEAD =
  "Their profile, goals, progress, decisions and what is still open, kept together in one place.";

/** Dimmed text still has to be readable if the script never runs, so it never goes below this. */
export const DIM = 0.62;

/** True from the `lg` breakpoint up. False on the server and on the first client render. */
export function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}
