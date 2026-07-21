import { useEffect, useRef, type JSX } from "react";
import type { SessionMessage } from "../../shared/ipc";
import type { ReasoningMode } from "../lib/appearance";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, footer]);

  if (!hasActiveSession) {
    const cards: { action: "plan" | "init" | "skills" | "undo"; icon: string; title: string; desc: string }[] = [
      { action: "plan", icon: "◔", title: t("welcome.planTitle"), desc: t("welcome.planDesc") },
      { action: "init", icon: "📄", title: t("welcome.initTitle"), desc: t("welcome.initDesc") },
      { action: "skills", icon: "🧩", title: t("welcome.skillsTitle"), desc: t("welcome.skillsDesc") },
      { action: "undo", icon: "↺", title: t("welcome.undoTitle"), desc: t("welcome.undoDesc") },
    ];
    return (
      <div className="messages">
        <div className="empty-state">
          <div className="welcome-hero">
            <h1>Deep Code</h1>
            <div className="welcome-subtitle">{t("empty.subtitle")}</div>
            <div className="tips">{t("empty.tips")}</div>
          </div>
          <div className="welcome-quickstart">
            <div className="welcome-quickstart-label">{t("welcome.quickStart")}</div>
            <div className="welcome-cards">
              {cards.map((card) => (
                <button
                  key={card.action}
                  type="button"
                  className="welcome-card"
                  onClick={() => onQuickAction?.(card.action)}
                >
                  <span className="welcome-card-icon">{card.icon}</span>
                  <span className="welcome-card-title">{card.title}</span>
                  <span className="welcome-card-desc">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="messages">
      <div className="messages-inner">
        {messages.length === 0 && !footer ? (
          <div className="empty-state" style={{ height: "auto", paddingTop: 60 }}>
            <div>{t("empty.newSession")}</div>
          </div>
        ) : null}
        {messages.map((message) => (
          <Message key={message.id} message={message} reasoningMode={reasoningMode} />
        ))}
        {footer}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
