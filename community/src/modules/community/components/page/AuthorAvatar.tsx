import { CommunityAuthorSummary } from "@/modules/community/types";

const PALETTE = [
  "bg-rose-100 text-rose-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-violet-100 text-violet-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-indigo-100 text-indigo-700",
];

const colorFor = (name: string): string => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
};

const initialsFor = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return initials || "?";
};

interface AuthorAvatarProps {
  author: Pick<CommunityAuthorSummary, "displayName" | "photoUrl">;
  size?: number;
  className?: string;
}

export default function AuthorAvatar({
  author,
  size = 32,
  className = "",
}: AuthorAvatarProps) {
  const name = (author.displayName || "?").trim();
  const dimension = { width: size, height: size };
  const fontSize = Math.max(10, Math.round(size * 0.4));

  if (author.photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={author.photoUrl}
        alt={name}
        style={dimension}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white shadow-sm ${className}`}
      />
    );
  }

  return (
    <span
      style={{ ...dimension, fontSize }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ring-2 ring-white shadow-sm ${colorFor(
        name,
      )} ${className}`}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}
