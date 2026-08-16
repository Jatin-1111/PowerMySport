/**
 * The soft out-of-focus colour wash behind the marketing sections.
 *
 * Purely decorative and `aria-hidden`; sizing and placement come in through
 * `className` so a section can position it without another component.
 */
export function AmbientBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl will-change-transform ${className}`}
    />
  );
}
