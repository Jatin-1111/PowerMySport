const matchesPath = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

/**
 * The one navigation item that is current, as its href, or undefined when none fits.
 *
 * "/dashboard" is a prefix of every other dashboard page, so testing each item on its own marked
 * Dashboard active beside the page the visitor was really on. The most specific match wins
 * instead: the longest href that fits the path. Items that leave the app are never current.
 */
export function findActiveHref(
  items: ReadonlyArray<{ href: string; external?: boolean }>,
  pathname: string
): string | undefined {
  return items
    .filter((item) => !item.external && matchesPath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}
