/**
 * Minimal parser for the HTML subset found in Goodreads reviews and Google Books
 * descriptions (<br>, <p>, <blockquote>, <i>/<em>, <b>/<strong>). Produces plain
 * data so it can be rendered as React elements without dangerouslySetInnerHTML.
 */

export interface Span {
  text: string;
  italic?: boolean;
  bold?: boolean;
}

export interface Block {
  kind: "paragraph" | "quote";
  spans: Span[];
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

export function parseRichText(html: string): Block[] {
  const blocks: Block[] = [];
  let spans: Span[] = [];
  let kind: Block["kind"] = "paragraph";
  let italic = 0;
  let bold = 0;

  const flush = () => {
    // Trim the block's outer whitespace and collapse internal runs
    const cleaned = spans
      .map((s) => ({ ...s, text: s.text.replace(/\s+/g, " ") }))
      .filter((s) => s.text.length > 0);
    if (cleaned.length > 0) {
      cleaned[0].text = cleaned[0].text.trimStart();
      cleaned[cleaned.length - 1].text = cleaned[cleaned.length - 1].text.trimEnd();
      const nonEmpty = cleaned.filter((s) => s.text.length > 0);
      if (nonEmpty.length > 0) blocks.push({ kind, spans: nonEmpty });
    }
    spans = [];
  };

  // Google Books sometimes truncates descriptions mid-tag ("…—Esquire</…")
  const input = html.replace(/<\/[^>]*$|<[a-z][^>]*$/i, "");
  // Only "<" followed by a letter (or "/letter") is a tag, so "<3" and "a < b > c" stay text
  for (const token of input.split(/(<\/?[a-z][^>]*>)/i)) {
    const tag = token.match(/^<(\/?)([a-z][a-z0-9]*)/i);
    if (!tag) {
      if (token) spans.push({ text: decodeEntities(token), italic: italic > 0 || undefined, bold: bold > 0 || undefined });
      continue;
    }
    const closing = tag[1] === "/";
    const name = tag[2].toLowerCase();
    switch (name) {
      case "br":
      case "p":
      case "div":
        flush();
        break;
      case "blockquote":
        flush();
        kind = closing ? "paragraph" : "quote";
        break;
      case "i":
      case "em":
        italic = Math.max(0, italic + (closing ? -1 : 1));
        break;
      case "b":
      case "strong":
        bold = Math.max(0, bold + (closing ? -1 : 1));
        break;
      // Any other tag is dropped, keeping its text content
    }
  }
  flush();
  return blocks;
}

export function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => b.spans.map((s) => s.text).join("")).join("\n\n");
}

/** Strip markup and decode entities, e.g. for tokenising descriptions */
export function htmlToText(html: string): string {
  return blocksToText(parseRichText(html));
}
