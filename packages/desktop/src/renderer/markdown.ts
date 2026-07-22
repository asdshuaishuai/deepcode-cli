import { marked, type Tokens, type RendererObject } from "marked";

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

/**
 * Custom renderer: adds `data-lang` attribute and language-specific CSS class
 * to fenced code blocks so the UI can show a language label and apply
 * specialised styling (e.g. JSON amber border, HTML purple border).
 */
const customRenderer: RendererObject = {
  code({ text, lang: rawLang }: Tokens.Code): string {
    const lang = (rawLang ?? "").trim().toLowerCase();
    const langClass = lang ? ` code-${lang}` : "";
    const dataLang = lang ? ` data-lang="${lang}"` : "";
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    return `<pre class="code-block${langClass}"${dataLang}><code class="language-${lang || "text"}">${escaped}</code></pre>\n`;
  },
};

marked.setOptions({
  gfm: true,
  breaks: true,
});

marked.use({ walkTokens: prettyPrintJsonBlocks, renderer: customRenderer });

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
