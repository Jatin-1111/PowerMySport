const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "About PowerMySport | Our Mission & Story";
  const description =
    "Learn about PowerMySport’s mission to simplify sports venue booking and coach discovery across India.";
  const canonical = `${siteUrl}/about`;

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
