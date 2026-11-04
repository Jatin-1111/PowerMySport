"use client";

interface AuthorAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

const gradientFor = (seed: string): string => {
  const palettes = [
    "bg-ink",
    "bg-ink-body",
    "bg-power-orange-solid",
    "bg-indigo-800",
    "bg-slate-700",
    "bg-indigo-700",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
};

/** Circular author avatar: photo if present, otherwise a solid warm initial. */
export default function AuthorAvatar({
  name,
  photoUrl,
  size = 40,
  className = "",
}: AuthorAvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${gradientFor(
        name || "?"
      )} font-semibold text-white ring-2 ring-white ${className}`}
    >
      {initial}
    </span>
  );
}
