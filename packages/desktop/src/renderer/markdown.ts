import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Render markdown to a sanitized-enough HTML string for our trusted CSP.
 * The renderer runs with a strict CSP (no inline scripts, no remote origins),
 * and content originates from the local model session, so we allow inline HTML
 * off but strip nothing beyond what `marked` produces.
 */
export function renderMarkdown(text: string): string {
  if (!text) {
    return "";
  }
  const html = marked.parse(text, { async: false }) as string;
  // Defensive: neutralise any javascript: URLs that could slip through.
  return html.replace(/javascript:/gi, "");
}
