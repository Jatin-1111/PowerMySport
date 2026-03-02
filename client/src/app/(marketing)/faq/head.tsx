const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "FAQ | PowerMySport Help & Common Questions";
  const description =
    "Find answers to common questions about bookings, payments, coaches, venues, and account management on PowerMySport.";
  const canonical = `${siteUrl}/faq`;

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
