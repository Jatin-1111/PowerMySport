"use client";

interface AuthorAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

const gradientFor = (seed: string): string => {
  const palettes = [
    "from-orange-400 to-rose-400",
    "from-sky-400 to-indigo-400",
    "from-emerald-400 to-teal-400",
    "from-violet-400 to-fuchsia-400",
    "from-amber-400 to-orange-500",
    "from-cyan-400 to-blue-500",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
};

/** Circular author avatar: photo if present, otherwise a gradient initial. */
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
        name || "?",
      )} font-bold text-white ring-2 ring-white ${className}`}
    >
      {initial}
    </span>
  );
}
