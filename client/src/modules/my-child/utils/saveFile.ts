/**
 * Hands a file the browser already holds to the person as a download.
 *
 * The address is made for the file and thrown away straight after, so nothing is left pointing
 * at it. Done with a temporary link because that is the one way a browser saves a blob under a
 * name of our choosing.
 */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let go of the address on the next turn, once the browser has taken the file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** A file name made of the child's name, with only letters and digits, for the saved CV. */
export const cvFileNameFor = (childName: string): string => {
  const slug = childName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return `${slug || "child"}-sporting-profile.pdf`;
};
