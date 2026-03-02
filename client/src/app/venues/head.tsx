const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "Book Sports Venues Online | Badminton, Cricket, Football";
  const description =
    "Browse and book sports venues with real-time availability. Find badminton courts, cricket grounds, football turfs and more on PowerMySport.";
  const canonical = `${siteUrl}/venues`;

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
