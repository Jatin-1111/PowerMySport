const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "Find Sports Coaches Near You | PowerMySport";
  const description =
    "Discover verified sports coaches, compare profiles, and book sessions online with PowerMySport.";
  const canonical = `${siteUrl}/coaches`;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
    </>
  );
}
