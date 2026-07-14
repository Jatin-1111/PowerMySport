"use client";

export function SectionTransition({ text, sub }: { text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <p className="font-title text-2xl font-bold text-slate-900 leading-snug mb-2">{text}</p>
      <p className="text-sm text-slate-500">{sub}</p>
    </div>
  );
}
