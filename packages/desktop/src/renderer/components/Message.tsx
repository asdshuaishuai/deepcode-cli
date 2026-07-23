import { useEffect, useRef, useState, type JSX } from "react";
import type { SessionMessage } from "../../shared/ipc";
import type { ReasoningMode } from "../lib/appearance";
import { renderMarkdown } from "../markdown";
import {
  buildThinkingSummary,
  buildToolSummary,
  formatStatusName,
  formatToolParams,
  getDiffLines,
  getPlanLines,
  getResultMd,
} from "../lib/messages";
import { useI18n } from "../i18n";

function Md({ text }: { text: string }): JSX.Element {
  return <div className="ui-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />;
}

/** Map tool name → icon + CSS modifier for visual differentiation. */
function toolVisual(name: string): { icon: string; cls: string } {
  const n = name.toLowerCase();
  if (n === "bash") return { icon: "$", cls: "bash" };
  if (n === "read") return { icon: "📖", cls: "read" };
  if (n === "write") return { icon: "📝", cls: "write" };
  if (n === "edit") return { icon: "✏️", cls: "edit" };
  if (n === "askuserquestion") return { icon: "❓", cls: "ask" };
  if (n === "updateplan") return { icon: "📋", cls: "plan" };
  if (n === "websearch") return { icon: "🔍", cls: "search" };
  if (n.startsWith("mcp__")) return { icon: "🔌", cls: "mcp" };
  return { icon: "⚙", cls: "generic" };
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

// ── User bubble (QQ-style: right-aligned) ─────────────────────────────────────
function UserBubble({ message }: { message: SessionMessage }): JSX.Element {
  const { t } = useI18n();
  const attachments = Array.isArray(message.contentParams) ? message.contentParams.length : 0;
  return (
    <div className="ui-bubble-row user">
      <div className="ui-bubble user">
        <span style={{ whiteSpace: "pre-wrap" }}>{message.content || t("msg.noContent")}</span>
        {attachments > 0 ? <span className="ui-bubble-attach">📎 {attachments}</span> : null}
      </div>
    </div>
  );
}

// ── Thinking block (collapsible) ──────────────────────────────────────────────
function ThinkingBlock({
  content,
  messageParams,
  reasoningMode,
  isLatest,
}: {
  content: string;
  messageParams: unknown;
  reasoningMode: ReasoningMode;
  isLatest: boolean;
}): JSX.Element | null {
  const { t } = useI18n();
  const summary = buildThinkingSummary(content, messageParams);
  // Auto-expand the latest thinking block; older ones auto-collapse.
  const [expanded, setExpanded] = useState(reasoningMode === "expanded" || isLatest);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Sync when a newer thinking block arrives (isLatest changes).
  useEffect(() => {
    if (isLatest && reasoningMode !== "hidden") {
      setExpanded(true);
    } else if (!isLatest) {
      setExpanded(false);
    }
  }, [isLatest, reasoningMode]);

  // When the user expands an older thinking block (or it auto-expands on a
  // new message), scroll the top of the body into view. block: "nearest"
  // avoids hijacking scroll position when the body is already fully on
  // screen, so this is a non-intrusive nudge rather than a forced jump.
  useEffect(() => {
    if (expanded && bodyRef.current) {
      bodyRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [expanded]);

  if (reasoningMode === "hidden") return null;

  return (
    <div className="ui-bubble-row assistant">
      <div className="ui-bubble thinking">
        <button className="ui-thinking-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <span className="ui-thinking-icon">{expanded ? "🧠" : "💭"}</span>
          <span className="ui-thinking-label">{t("msg.thinking")}</span>
          <span className="ui-thinking-summary">{truncate(summary || t("msg.reasoning"), 80)}</span>
          <span className="ui-thinking-chevron">{expanded ? "▾" : "▸"}</span>
        </button>
        {expanded && content ? (
          <div className="ui-thinking-body" ref={bodyRef}>
            <Md text={content} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Assistant bubble ──────────────────────────────────────────────────────────
function AssistantBubble({ message }: { message: SessionMessage }): JSX.Element {
  const content = (message.content || "").trim();
  return (
    <div className="ui-bubble-row assistant">
      <div className="ui-bubble assistant">{content ? <Md text={content} /> : null}</div>
    </div>
  );
}

// ── Tool card (differentiated by tool type) ───────────────────────────────────
// File-targeting tools (read/write/edit) collapse their full body by default
// so the chat stays scannable; the header doubles as an expand toggle and
// surfaces the file path inline so the user can identify the file without
// expanding. Other tools (bash/ask/plan/search/mcp) keep their content
// visible — their result remains individually collapsible as before.
const FILE_TOOLS = new Set(["read", "write", "edit"]);

function ToolCard({ message }: { message: SessionMessage }): JSX.Element {
  const { t } = useI18n();
  const summary = buildToolSummary(message);
  const params = formatToolParams(summary);
  const resultMd = getResultMd(message);
  const diffLines = getDiffLines(summary);
  const planLines = getPlanLines(summary);
  const vis = toolVisual(summary.name);
  const isMcp = summary.name.toLowerCase().startsWith("mcp__");
  const displayName = isMcp ? summary.name.replace(/^mcp__/, "").replace(/__/g, " · ") : formatStatusName(summary.name);
  const isFileTool = FILE_TOOLS.has(summary.name.toLowerCase());
  const [bodyOpen, setBodyOpen] = useState(!isFileTool);
  const [resultOpen, setResultOpen] = useState(false);

  // The header element is a button for file tools (so the whole card is
  // clickable to expand/collapse) and a plain div for other tools, where
  // the header is just visual metadata.
  const headerInner = (
    <>
      <span className="ui-tool-icon">{vis.icon}</span>
      <span className="ui-tool-name">{displayName}</span>
      {/* File tools surface the file path inline so the user can identify
         which file they're looking at without expanding the card. */}
      {isFileTool && params ? <span className="ui-tool-params-inline">{params}</span> : null}
      {summary.ok ? null : <span className="ui-tool-badge err">✗</span>}
      {isFileTool ? <span className="ui-tool-chevron">{bodyOpen ? "▾" : "▸"}</span> : null}
    </>
  );

  return (
    <div
      className={`ui-tool-card ${vis.cls}${summary.ok ? "" : " err"}${isFileTool ? " collapsible" : ""}${isFileTool && bodyOpen ? " open" : ""}`}
    >
      {isFileTool ? (
        <button type="button" className="ui-tool-head" onClick={() => setBodyOpen((v) => !v)}>
          {headerInner}
        </button>
      ) : (
        <div className="ui-tool-head">{headerInner}</div>
      )}
      {/* Non-file tools keep the params on a separate line (current behavior). */}
      {!isFileTool && params ? <div className="ui-tool-params">{params}</div> : null}
      {/* Body — for file tools, only rendered when expanded. */}
      {(!isFileTool || bodyOpen) && (
        <>
          {/* Diff preview for edit/write */}
          {diffLines.length > 0 ? (
            <div className="ui-diff">
              {diffLines.map((line, i) => (
                <div key={i} className={line.kind === "added" ? "add" : line.kind === "removed" ? "del" : "ctx"}>
                  {line.marker}
                  {line.content}
                </div>
              ))}
            </div>
          ) : null}
          {/* Plan lines for UpdatePlan */}
          {planLines.length > 0 ? (
            <div className="ui-tool-plan">
              <div className="ui-tool-plan-label">📋 {t("msg.plan")}</div>
              <div className="ui-tool-plan-body">{planLines.join("\n")}</div>
            </div>
          ) : null}
          {/* Collapsible result */}
          {resultMd ? (
            <div className="ui-tool-result-wrap">
              <button className="ui-tool-result-toggle" onClick={() => setResultOpen((v) => !v)}>
                <span>{resultOpen ? "▾" : "▸"}</span>
                <span>{t("msg.result")}</span>
                {!resultOpen ? (
                  <span className="ui-tool-result-hint"> ({truncate(resultMd.replace(/\s+/g, " "), 60)})</span>
                ) : null}
              </button>
              {resultOpen ? (
                <div className="ui-tool-result">
                  <Md text={resultMd} />
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

// ── System note (centered, muted) ─────────────────────────────────────────────
function SystemNote({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="ui-bubble-row system">
      <div className="ui-system-note">{children}</div>
    </div>
  );
}

// ── Main Message dispatcher ───────────────────────────────────────────────────
export function Message({
  message,
  reasoningMode = "normal",
  expandedThinkingId,
}: {
  message: SessionMessage;
  reasoningMode?: ReasoningMode;
  expandedThinkingId?: string | null;
}): JSX.Element | null {
  const { t } = useI18n();
  if (!message.visible) return null;

  if (message.role === "user") {
    return <UserBubble message={message} />;
  }

  if (message.role === "assistant") {
    if (message.meta?.asThinking) {
      return (
        <ThinkingBlock
          content={(message.content || "").trim()}
          messageParams={message.messageParams}
          reasoningMode={reasoningMode}
          isLatest={message.id === expandedThinkingId}
        />
      );
    }
    return <AssistantBubble message={message} />;
  }

  if (message.role === "tool") {
    return (
      <div className="ui-bubble-row tool">
        <ToolCard message={message} />
      </div>
    );
  }

  if (message.role === "system") {
    if (message.meta?.isModelChange) {
      return <SystemNote>{message.content || ""}</SystemNote>;
    }
    if (message.meta?.skill) {
      return <SystemNote>⚡ {t("msg.loadedSkill", { name: message.meta.skill.name })}</SystemNote>;
    }
    if (message.meta?.isSummary) {
      return <SystemNote>📄 {t("msg.summaryInserted")}</SystemNote>;
    }
    return null;
  }

  return null;
}
