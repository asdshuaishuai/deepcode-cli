import { useEffect, useRef, type JSX } from "react";
import type { SessionMessage } from "../../shared/ipc";
import { Message } from "./Message";
import { useI18n } from "../i18n";

type Props = {
  messages: SessionMessage[];
  hasActiveSession: boolean;
  /** Interactive prompt cards (permission / question / plan) shown after the messages. */
  footer?: React.ReactNode;
};

export function MessageList({ messages, hasActiveSession, footer }: Props): JSX.Element {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, footer]);

  if (!hasActiveSession) {
    return (
      <div className="messages">
        <div className="empty-state">
          <h1>Deep Code</h1>
          <div>{t("empty.subtitle")}</div>
          <div className="tips">{t("empty.tips")}</div>
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
          <Message key={message.id} message={message} />
        ))}
        {footer}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
