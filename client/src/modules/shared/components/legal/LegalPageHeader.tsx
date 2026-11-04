import { PageHeader, type PageHeaderProps } from "@/modules/shared/ui/PageHeader";

interface LegalPageHeaderProps {
  title: string;
  lastUpdated: string;
  effective?: string;
  /** Match the document column: 6xl beside a table of contents, 4xl for plain prose. */
  width?: PageHeaderProps["width"];
}

/**
 * Header for every legal and policy page: the shared PageHeader in its compact
 * size, so the documents look like part of the same site rather than a dark
 * banner of their own.
 */
export function LegalPageHeader({
  title,
  lastUpdated,
  effective,
  width = "6xl",
}: LegalPageHeaderProps) {
  return (
    <PageHeader
      eyebrow="Legal"
      title={title}
      size="compact"
      width={width}
      meta={
        <>
          Last updated {lastUpdated}
          {effective ? ` · Effective ${effective}` : ""}
        </>
      }
    />
  );
}
