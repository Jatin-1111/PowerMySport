const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "Services | Venue Booking, Coaching & Sports Management";
  const description =
    "Explore PowerMySport services for players, coaches, and venue owners including venue booking, coach discovery, and secure payments.";
  const canonical = `${siteUrl}/services`;

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
