/**
 * Turns a path the server handed back (for example `/api/guidance/abc/whatsapp`)
 * into a link that works from the website.
 *
 * The server writes its own route, `/api/...`, but the website and the API are on
 * different origins and the website does not proxy `/api`, so used as it is the
 * link opens a 404 page on the website. `apiBase` is the API's base URL, which
 * already ends in `/api`. Anything that is already a full URL is left alone.
 */
export function resolveApiPath(path: string, apiBase: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBase.replace(/\/+$/, "");
  const rest = path.replace(/^\/api(?=\/|$)/, "");
  return `${base}${rest.startsWith("/") ? rest : `/${rest}`}`;
}
