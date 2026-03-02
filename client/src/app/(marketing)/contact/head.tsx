const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

export default function Head() {
  const title = "Contact PowerMySport | Support & Enquiries";
  const description =
    "Get in touch with PowerMySport for support, partnerships, and business enquiries.";
  const canonical = `${siteUrl}/contact`;

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
