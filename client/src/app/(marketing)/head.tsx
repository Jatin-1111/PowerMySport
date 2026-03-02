const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "PowerMySport | Book Sports Venues & Find Coaches";
  const description =
    "Book sports venues, discover certified coaches, and manage your complete sports journey on PowerMySport.";
  const canonical = `${siteUrl}/`;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={`${siteUrl}/icon.svg`} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}/icon.svg`} />
    </>
  );
}
