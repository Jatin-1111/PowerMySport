const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "How It Works | Book Sports Venues in Easy Steps";
  const description =
    "See how PowerMySport helps players book venues, connect with coaches, and manage sports activities in a few simple steps.";
  const canonical = `${siteUrl}/how-it-works`;

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
