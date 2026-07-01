import WriterProfileClient from "@/modules/community/components/blog/WriterProfileClient";

export default async function WriterProfilePage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  return <WriterProfileClient identifier={identifier} />;
}
