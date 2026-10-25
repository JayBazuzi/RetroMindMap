export interface TextPart {
  text: string;
  /** Set when this part is a URL. Only http(s), so a node can't carry javascript: links. */
  href?: string;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"]+/g;

/** Splits text into plain parts and URL parts. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimTrailing(match[0]);
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href: url });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** Leaves sentence punctuation and unbalanced closing parens out of the URL. */
function trimTrailing(url: string): string {
  for (;;) {
    const end = url[url.length - 1];
    const unbalancedParen =
      end === ")" && url.split("(").length < url.split(")").length;
    if (!".,;:!?'".includes(end) && !unbalancedParen) return url;
    url = url.slice(0, -1);
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Text as HTML with its URLs as links; newlines become <br>. */
export function toLinkedHtml(text: string): string {
  return linkify(text)
    .map((p) =>
      p.href
        ? `<a href="${escapeHtml(p.href)}">${escapeHtml(p.text)}</a>`
        : escapeHtml(p.text),
    )
    .join("")
    .replace(/\n/g, "<br>");
}
