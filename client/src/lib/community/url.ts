const normalizeUrl = (value: string): string => value.trim().replace(/\/$/, "");

type CommunityUrlOptions = {
  path?: string;
  searchParams?: Record<string, string | number | boolean | null | undefined>;
};

const buildCommunityUrl = (baseUrl: string, options: CommunityUrlOptions) => {
  const path = options.path?.trim().replace(/^\//, "") || "";
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(options.searchParams || {})) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    query.set(key, String(value));
  }

  const queryString = query.toString();
  return `${baseUrl}${path ? `/${path}` : ""}${queryString ? `?${queryString}` : ""}`;
};

export const getCommunityAppUrl = (
  options: CommunityUrlOptions = {},
): string => {
  const configured = process.env.NEXT_PUBLIC_COMMUNITY_APP_URL;
  const baseUrl = configured
    ? normalizeUrl(configured)
    : process.env.NODE_ENV === "development"
      ? "http://localhost:3002"
      : "https://community.powermysport.com";

  return buildCommunityUrl(baseUrl, options);
};
