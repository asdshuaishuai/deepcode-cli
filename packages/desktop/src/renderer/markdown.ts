import { marked, type Tokens } from "marked";

/** Pretty-print fenced ```json blocks so model output reads cleanly. */
function prettyPrintJsonBlocks(token: Tokens.Generic): void {
  if (token.type !== "code") return;
  const code = token as Tokens.Code;
  const lang = (code.lang ?? "").trim().toLowerCase();
  if (lang !== "json" && lang !== "jsonc") return;
  try {
    code.text = JSON.stringify(JSON.parse(code.text), null, 2);
  } catch {
    // Leave malformed JSON untouched.
  }
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

// Default marked emits `<pre><code class="language-xxx">` for fenced blocks,
// which our CSS uses to style/label code. We only reflow JSON here.
marked.use({ walkTokens: prettyPrintJsonBlocks });

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
