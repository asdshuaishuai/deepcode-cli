import type { JSX } from "react";
import type { McpServerStatus } from "../../shared/ipc";
import { useI18n, type MessageKey } from "../i18n";

type Props = {
  servers: McpServerStatus[];
  onReconnect: (name: string) => void;
  onClose: () => void;
};

const STATUS_COLOR: Record<string, string> = {
  ready: "var(--green)",
  starting: "var(--yellow)",
  reconnecting: "var(--yellow)",
  failed: "var(--red)",
};

export function McpModal({ servers, onReconnect, onClose }: Props): JSX.Element {
  const { t } = useI18n();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t("mcp.title")}</h2>
        {servers.length === 0 ? <div style={{ color: "var(--text-faint)", fontSize: 13 }}>{t("mcp.none")}</div> : null}
        {servers.map((server) => (
          <div key={server.name} className="mcp-item">
            <div className="row">
              <span style={{ fontWeight: 600 }}>
                <span
                  className="status-dot"
                  style={{ background: STATUS_COLOR[server.status] ?? "var(--text-faint)", marginRight: 8 }}
                />
                {server.name}
              </span>
              <button
                onClick={() => onReconnect(server.name)}
                style={{
                  background: "var(--bg-elev-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 6,
                  padding: "3px 10px",
                  fontSize: 12,
                }}
              >
                {t("mcp.reconnect")}
              </button>
            </div>
            <div className="mcp-tools">
              {t(`mcpStatus.${server.status}` as MessageKey)}
              {server.connected ? ` · ${t("mcp.toolsCount", { n: server.toolCount })}` : ""}
              {server.error ? <span style={{ color: "var(--red)" }}> · {server.error}</span> : null}
            </div>
            {server.tools.length > 0 ? (
              <div className="mcp-tools" style={{ color: "var(--text-faint)" }}>
                {server.tools.join(", ")}
              </div>
            ) : null}
          </div>
        ))}
        <div className="card-actions">
          <button onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
