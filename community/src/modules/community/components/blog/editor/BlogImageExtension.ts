import Image from "@tiptap/extension-image";

/**
 * Blog content images live in a private S3 bucket. The `src` shown while
 * editing/reading is a short-lived presigned URL, but only `data-key` is
 * meant to persist — the server blanks `src` on save and re-signs it fresh
 * from `data-key` on every read (see BlogService's content image helpers).
 */
export const BlogImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      key: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-key"),
        renderHTML: (attributes: { key?: string | null }) => {
          if (!attributes.key) return {};
          return { "data-key": attributes.key };
        },
      },
    };
  },
});
