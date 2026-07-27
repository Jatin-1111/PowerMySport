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
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <p className="font-title text-2xl font-bold text-slate-900 leading-snug mb-2">{text}</p>
      <p className="text-sm text-slate-500 mb-8">{sub}</p>
      <button
        type="button"
        onClick={onContinue}
        className="bg-power-orange text-white rounded-xl px-8 py-3 text-sm font-semibold hover:bg-power-orange/90 transition-colors"
      >
        Continue
      </button>
    </div>
  );
}
