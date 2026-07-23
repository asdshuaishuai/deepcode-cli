import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type { SessionMessage } from "../../shared/ipc";
import type { ReasoningMode } from "../lib/appearance";
import { findExpandedThinkingId } from "../lib/messages";
import { Message } from "./Message";
import { useI18n } from "../i18n";

type Props = {
  messages: SessionMessage[];
  hasActiveSession: boolean;
  /** How assistant reasoning/thinking blocks are displayed. */
  reasoningMode: ReasoningMode;
  /** Quick-start actions surfaced on the welcome screen. */
  onQuickAction?: (action: "plan" | "init" | "skills" | "undo") => void;
  /** Interactive prompt cards (permission / question / plan) shown after the messages. */
  footer?: React.ReactNode;
};

export function MessageList({ messages, hasActiveSession, reasoningMode, onQuickAction, footer }: Props): JSX.Element {
  const { t } = useI18n();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const expandedThinkingId = useMemo(() => findExpandedThinkingId(messages), [messages]);
  // Stickiness tracks whether the user is parked at the bottom of the
  // conversation. The auto-scroll effect only follows the stream when
  // they are; if they've scrolled up to read something, new content
  // arrives silently instead of yanking them back down.
  const [stuckToBottom, setStuckToBottom] = useState(true);

  // Recompute stuck-state on scroll, on resize, and on content changes
  // (because the scroll position is now in a different "place" relative
  // to the new content height). 80px of slack matches how the rest of
  // the UI (slack toasts, jump-to-bottom buttons) treats "near the end".
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setStuckToBottom(distance < 80);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [hasActiveSession]);

  useEffect(() => {
    if (!stuckToBottom) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, footer, stuckToBottom]);

  // If the user clicks into the conversation from elsewhere (or expands
  // a thinking block and then scrolls back), keep them pinned by
  // manually forcing a re-evaluation. A dedicated "jump to latest" pill
  // is rendered in the JSX below; clicking it re-engages follow mode.
  const handleJumpToLatest = (): void => {
    setStuckToBottom(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  if (!hasActiveSession) {
    const cards: { action: "plan" | "init" | "skills" | "undo"; icon: string; title: string; desc: string }[] = [
      { action: "plan", icon: "◔", title: t("welcome.planTitle"), desc: t("welcome.planDesc") },
      { action: "init", icon: "📄", title: t("welcome.initTitle"), desc: t("welcome.initDesc") },
      { action: "skills", icon: "🧩", title: t("welcome.skillsTitle"), desc: t("welcome.skillsDesc") },
      { action: "undo", icon: "↺", title: t("welcome.undoTitle"), desc: t("welcome.undoDesc") },
    ];
    return (
      <div className="ui-conversation">
        <div className="ui-welcome">
          <h1>{t("app.name")}</h1>
          <div className="ui-welcome-subtitle">{t("empty.subtitle")}</div>
          <div className="ui-welcome-tips">{t("empty.tips")}</div>
          <div className="ui-welcome-quickstart">
            <div className="ui-welcome-quickstart-label">{t("welcome.quickStart")}</div>
            <div className="ui-welcome-cards">
              {cards.map((card) => (
                <button
                  key={card.action}
                  type="button"
                  className="ui-welcome-card"
                  onClick={() => onQuickAction?.(card.action)}
                >
                  <span className="ui-welcome-card-icon">{card.icon}</span>
                  <span className="ui-welcome-card-title">{card.title}</span>
                  <span className="ui-welcome-card-desc">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-conversation" ref={scrollerRef}>
      <div className="ui-conversation-inner">
        {messages.length === 0 && !footer ? (
          <div className="ui-empty" style={{ padding: "60px 0" }}>
            {t("empty.newSession")}
          </div>
        ) : null}
        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            reasoningMode={reasoningMode}
            expandedThinkingId={expandedThinkingId}
          />
        ))}
        {footer}
        <div ref={bottomRef} />
      </div>
      {/* Floating jump-to-latest pill — appears when the user has scrolled
         up to read something and the stream keeps producing. Clicking it
         re-engages follow mode and snaps back to the bottom. */}
      {stuckToBottom || messages.length === 0 ? null : (
        <button
          type="button"
          className="ui-jump-to-latest"
          onClick={handleJumpToLatest}
          aria-label={t("msg.jumpToLatest")}
        >
          <span className="ui-jump-to-latest-arrow" aria-hidden="true">
            ↓
          </span>
          <span>{t("msg.jumpToLatest")}</span>
        </button>
      )}
    </div>
  );
}
