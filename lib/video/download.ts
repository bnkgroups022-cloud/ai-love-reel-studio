/** A safe, readable MP4 file name, e.g. "baarish-mein-mulaqat-1a2b3c4d.mp4". */
export function downloadFileName(title: string | null, projectId: string): string {
  const slug = (title ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "love-reel"}-${projectId.slice(0, 8)}.mp4`;
}
