"use client";

export function SectionTransition({
  text,
  sub,
  onContinue,
}: {
  text: string;
  sub: string;
  onContinue: () => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center justify-center px-4 py-16 text-center duration-300">
      <p className="font-title mb-2 text-2xl leading-snug font-bold text-slate-900">{text}</p>
      <p className="mb-8 text-sm text-slate-500">{sub}</p>
      <button
        type="button"
        onClick={onContinue}
        className="bg-power-orange hover:bg-power-orange/90 rounded-xl px-8 py-3 text-sm font-semibold text-white transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
