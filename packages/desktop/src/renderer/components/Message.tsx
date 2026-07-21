import type { JSX } from "react";
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

export function Message({
  message,
  reasoningMode = "normal",
}: {
  message: SessionMessage;
  reasoningMode?: ReasoningMode;
}): JSX.Element | null {
  const { t } = useI18n();
  if (!message.visible) {
    return null;
  }

  if (message.role === "user") {
    const attachments = Array.isArray(message.contentParams) ? message.contentParams.length : 0;
    return (
      <div className="ui-msg user">
        <div className="ui-msg-gutter">›</div>
        <div className="ui-msg-body">
          <span style={{ whiteSpace: "pre-wrap" }}>{message.content || t("msg.noContent")}</span>
          {attachments > 0 ? <span> 📎 {t("msg.images", { n: attachments })}</span> : null}
        </div>
      </div>
    );
  }

  if (message.role === "assistant") {
    const content = (message.content || "").trim();
    if (message.meta?.asThinking) {
      if (reasoningMode === "hidden") {
        return null;
      }
      const summary = buildThinkingSummary(content, message.messageParams);
      return (
        <div className="ui-msg assistant">
          <div className="ui-msg-gutter">✧</div>
          <div className="ui-msg-body">
            <details className="ui-thinking" open={reasoningMode === "expanded"}>
              <summary>
                {t("msg.thinking")} — {summary || t("msg.reasoning")}
              </summary>
              {content ? <Md text={content} /> : null}
            </details>
          </div>
        </div>
      );
    }
    return (
      <div className="ui-msg assistant">
        <div className="ui-msg-gutter">✦</div>
        <div className="ui-msg-body">{content ? <Md text={content} /> : null}</div>
      </div>
    );
  }

  if (message.role === "tool") {
    const summary = buildToolSummary(message);
    const params = formatToolParams(summary);
    const resultMd = getResultMd(message);
    const diffLines = getDiffLines(summary);
    const planLines = getPlanLines(summary);
    return (
      <div className={`ui-msg tool${summary.ok ? "" : " err"}`}>
        <div className="ui-msg-gutter">✧</div>
        <div className="ui-msg-body">
          <div className="ui-tool-line">
            <span className="ui-tool-name">{formatStatusName(summary.name)}</span>
            {params ? <span className="ui-tool-params">{params}</span> : null}
          </div>
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
          {planLines.length > 0 ? (
            <div className="ui-tool-result">
              <div className="label">└ {t("msg.plan")}</div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{planLines.join("\n")}</div>
            </div>
          ) : null}
          {resultMd ? (
            <div className="ui-tool-result">
              <div className="label">└ {t("msg.result")}</div>
              <Md text={resultMd} />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (message.role === "system") {
    if (message.meta?.isModelChange) {
      return (
        <div className="ui-msg user">
          <div className="ui-msg-gutter">›</div>
          <div className="ui-msg-body" style={{ whiteSpace: "pre-wrap" }}>
            {message.content || ""}
          </div>
        </div>
      );
    }
    if (message.meta?.skill) {
      return (
        <div className="ui-msg">
          <div className="ui-msg-gutter" />
          <div className="ui-msg-body ui-system-note">⚡ {t("msg.loadedSkill", { name: message.meta.skill.name })}</div>
        </div>
      );
    }
    if (message.meta?.isSummary) {
      return (
        <div className="ui-msg">
          <div className="ui-msg-gutter" />
          <div className="ui-msg-body ui-system-note" style={{ fontStyle: "italic" }}>
            {t("msg.summaryInserted")}
          </div>
        </div>
      );
    }
    return null;
  }

  return null;
}
