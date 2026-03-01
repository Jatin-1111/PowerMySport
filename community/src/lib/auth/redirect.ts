const normalizeUrl = (value: string): string => value.trim().replace(/\/$/, "");

export const getMainAppUrl = (): string => {
  const configured = process.env.NEXT_PUBLIC_MAIN_APP_URL;
  if (configured) {
    return normalizeUrl(configured);
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname.endsWith("powermysport.com")) {
      return "https://powermysport.com";
    }

    return "http://localhost:3000";
  }

  return "https://powermysport.com";
};

export const redirectToMainLogin = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  const returnTo = encodeURIComponent(window.location.href);
  const loginUrl = `${getMainAppUrl()}/login?next=${returnTo}`;
  window.location.href = loginUrl;
};
