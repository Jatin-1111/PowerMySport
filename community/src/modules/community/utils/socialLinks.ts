import {
  Facebook,
  Github,
  Globe,
  Instagram,
  Twitter,
  Youtube,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SocialLinks } from "@/modules/community/types";

export type SocialPlatform = keyof SocialLinks;

export const SOCIAL_META: Array<{
  key: SocialPlatform;
  label: string;
  Icon: LucideIcon;
  placeholder: string;
  hover: string;
}> = [
  {
    key: "youtube",
    label: "YouTube",
    Icon: Youtube,
    placeholder: "channel or URL",
    hover: "hover:text-red-600 hover:border-red-200 hover:bg-red-50",
  },
  {
    key: "instagram",
    label: "Instagram",
    Icon: Instagram,
    placeholder: "handle or URL",
    hover: "hover:text-pink-600 hover:border-pink-200 hover:bg-pink-50",
  },
  {
    key: "facebook",
    label: "Facebook",
    Icon: Facebook,
    placeholder: "profile or URL",
    hover: "hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50",
  },
  {
    key: "twitter",
    label: "Twitter",
    Icon: Twitter,
    placeholder: "handle or URL",
    hover: "hover:text-sky-600 hover:border-sky-200 hover:bg-sky-50",
  },
  {
    key: "github",
    label: "GitHub",
    Icon: Github,
    placeholder: "username or URL",
    hover: "hover:text-slate-900 hover:border-slate-300 hover:bg-slate-100",
  },
  {
    key: "website",
    label: "Website",
    Icon: Globe,
    placeholder: "https://...",
    hover:
      "hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50",
  },
];

/** Build a full URL from a stored handle/URL for a given platform. */
export const buildSocialUrl = (
  platform: SocialPlatform,
  value: string,
): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  switch (platform) {
    case "youtube":
      return `https://youtube.com/@${handle}`;
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "facebook":
      return `https://facebook.com/${handle}`;
    case "twitter":
      return `https://twitter.com/${handle}`;
    case "github":
      return `https://github.com/${handle}`;
    case "website":
    default:
      return `https://${handle}`;
  }
};
