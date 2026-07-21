// Wraps a Deep Code core `SessionManager` for a single project root and forwards
// its callbacks to the renderer via the provided `emit` function. Mirrors the way
// the CLI's App.tsx constructs and drives the SessionManager.

import {
  createOpenAIClient,
  getProjectSettingsPath,
  getUserSettingsPath,
  readProjectSettings,
  readSettings,
  resolveCurrentSettings,
  SessionManager,
  writeModelConfigSelection,
  writeProjectSettings,
  writeSettings,
} from "@vegamo/deepcode-core";
import type {
  DeepcodingSettings,
  McpServerConfig,
  ModelConfigSelection,
  PermissionDefaultMode,
  PermissionScope,
  PermissionSettings,
  SessionEntry,
  SessionMessage,
  UserPromptContent,
} from "@vegamo/deepcode-core";
import { existsSync } from "node:fs";
import { IpcEvent } from "../shared/ipc.js";
import type { EditableSettings, PermissionDecision, SerializableSessionEntry, SettingsSummary } from "../shared/ipc.js";

type Emit = (channel: string, payload?: unknown) => void;

const PERMISSION_SCOPES: PermissionScope[] = [
  "read-in-cwd",
  "read-out-cwd",
  "write-in-cwd",
  "write-out-cwd",
  "delete-in-cwd",
  "delete-out-cwd",
  "query-git-log",
  "mutate-git-log",
  "network",
  "mcp",
];

function parseArgs(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEnvLines(raw: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (key) {
      env[key] = trimmed.slice(eq + 1).trim();
    }
  }
  return env;
}

function stringifyEnv(env: Record<string, string> | undefined): string {
  return env
    ? Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
    : "";
}

function buildPermissionDecisions(
  perms: PermissionSettings | undefined
): Partial<Record<PermissionScope, PermissionDecision>> {
  const result: Partial<Record<PermissionScope, PermissionDecision>> = {};
  for (const scope of perms?.allow ?? []) {
    result[scope] = "allow";
  }
  for (const scope of perms?.ask ?? []) {
    result[scope] = "ask";
  }
  for (const scope of perms?.deny ?? []) {
    result[scope] = "deny";
  }
  return result;
}

function buildPermissionSettings(
  defaultMode: PermissionDefaultMode,
  decisions: Partial<Record<PermissionScope, PermissionDecision>>
): PermissionSettings {
  const allow: PermissionScope[] = [];
  const ask: PermissionScope[] = [];
  const deny: PermissionScope[] = [];
  for (const scope of PERMISSION_SCOPES) {
    const decision = decisions[scope];
    if (decision === "allow") {
      allow.push(scope);
    } else if (decision === "ask") {
      ask.push(scope);
    } else if (decision === "deny") {
      deny.push(scope);
    }
  }
  return { defaultMode, allow, ask, deny };
}

export function toSerializableEntry(entry: SessionEntry): SerializableSessionEntry {
  const processes = entry.processes
    ? Array.from(entry.processes.entries()).map(([pid, info]) => ({ pid, ...info }))
    : [];
  return { ...entry, processes };
}

export function toSettingsSummary(root: string): SettingsSummary {
  const s = resolveCurrentSettings(root);
  return {
    model: s.model,
    baseURL: s.baseURL,
    thinkingEnabled: s.thinkingEnabled,
    reasoningEffort: s.reasoningEffort,
    hasApiKey: Boolean(s.apiKey),
    statusSeparator: s.statusline?.separator ?? " ",
  };
}

export class SessionBridge {
  private manager: SessionManager;

  constructor(
    public projectRoot: string,
    private readonly emit: Emit
  ) {
    this.manager = this.createManager(projectRoot);
    const settings = resolveCurrentSettings(projectRoot);
    void this.manager.initMcpServers(settings.mcpServers);
  }

  private createManager(projectRoot: string): SessionManager {
    return new SessionManager({
      projectRoot,
      createOpenAIClient: () => createOpenAIClient(projectRoot),
      getResolvedSettings: () => resolveCurrentSettings(projectRoot),
      renderMarkdown: (text) => text,
      onAssistantMessage: (message: SessionMessage) => {
        this.emit(IpcEvent.AssistantMessage, message);
      },
      onSessionEntryUpdated: (entry) => {
        this.emit(IpcEvent.SessionEntryUpdated, toSerializableEntry(entry));
      },
      onLlmStreamProgress: (progress) => {
        this.emit(IpcEvent.LlmStreamProgress, progress);
      },
      onMcpStatusChanged: () => {
        this.emit(IpcEvent.McpStatusChanged);
      },
      onProcessStdout: (pid, chunk) => {
        this.emit(IpcEvent.ProcessStdout, { pid, chunk: typeof chunk === "string" ? chunk : String(chunk) });
      },
    });
  }

  /** Swap to a new project root, disposing the previous SessionManager. */
  setProjectRoot(root: string): void {
    if (root === this.projectRoot) {
      return;
    }
    this.manager.dispose();
    this.projectRoot = root;
    this.manager = this.createManager(root);
    const settings = resolveCurrentSettings(root);
    void this.manager.initMcpServers(settings.mcpServers);
  }

  /**
   * Recreate the SessionManager for the current root so freshly written settings
   * (notably MCP servers, whose init is one-shot) take effect. The active session
   * id is preserved; sessions themselves are re-read from disk.
   */
  private reload(): void {
    const active = this.manager.getActiveSessionId();
    this.manager.dispose();
    this.manager = this.createManager(this.projectRoot);
    const settings = resolveCurrentSettings(this.projectRoot);
    void this.manager.initMcpServers(settings.mcpServers);
    if (active) {
      this.manager.setActiveSessionId(active);
    }
  }

  dispose(): void {
    this.manager.dispose();
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  listSessions(): SerializableSessionEntry[] {
    return this.manager.listSessions().map(toSerializableEntry);
  }

  getSession(id: string): SerializableSessionEntry | null {
    const entry = this.manager.getSession(id);
    return entry ? toSerializableEntry(entry) : null;
  }

  listMessages(id: string): SessionMessage[] {
    return this.manager.listSessionMessages(id).filter((m) => m.visible);
  }

  setActiveSession(id: string | null): void {
    this.manager.setActiveSessionId(id);
  }

  getActiveSession(): string | null {
    return this.manager.getActiveSessionId();
  }

  deleteSession(id: string): boolean {
    return this.manager.deleteSession(id);
  }

  renameSession(id: string, summary: string): boolean {
    return this.manager.renameSession(id, summary);
  }

  // ── Turn lifecycle ──────────────────────────────────────────────────────────
  async sendPrompt(prompt: UserPromptContent): Promise<void> {
    await this.manager.handleUserPrompt(prompt);
  }

  interrupt(): void {
    this.manager.interruptActiveSession();
  }

  denyPermission(reason?: string): void {
    const id = this.manager.getActiveSessionId();
    if (id) {
      this.manager.denySessionPermission(id, reason);
    }
  }

  // ── Skills / settings / model ─────────────────────────────────────────────
  async listSkills(sessionId?: string) {
    return this.manager.listSkills(sessionId ?? this.manager.getActiveSessionId() ?? undefined);
  }

  getSettings(): SettingsSummary {
    return toSettingsSummary(this.projectRoot);
  }

  private resolveSaveTarget(): "user" | "project" {
    return existsSync(getProjectSettingsPath(this.projectRoot)) ? "project" : "user";
  }

  private readTargetSettings(target: "user" | "project"): DeepcodingSettings {
    return (target === "project" ? readProjectSettings(this.projectRoot) : readSettings()) ?? {};
  }

  getEditableSettings(): EditableSettings {
    const target = this.resolveSaveTarget();
    const raw = this.readTargetSettings(target);
    const env = raw.env ?? {};
    const resolved = resolveCurrentSettings(this.projectRoot);
    return {
      saveTarget: target,
      saveTargetPath: target === "project" ? getProjectSettingsPath(this.projectRoot) : getUserSettingsPath(),
      hasEnvApiKey: Boolean(process.env.DEEPCODE_API_KEY),
      apiKey: env.API_KEY ?? "",
      baseURL: env.BASE_URL ?? "",
      model: raw.model ?? "",
      temperature: raw.temperature != null ? String(raw.temperature) : "",
      thinkingEnabled: raw.thinkingEnabled ?? resolved.thinkingEnabled,
      reasoningEffort: raw.reasoningEffort ?? resolved.reasoningEffort,
      telemetryEnabled: raw.telemetryEnabled ?? true,
      debugLogEnabled: raw.debugLogEnabled ?? false,
      permissionDefaultMode: raw.permissions?.defaultMode ?? "allowAll",
      permissions: buildPermissionDecisions(raw.permissions),
      mcpServers: Object.entries(raw.mcpServers ?? {}).map(([name, cfg]) => ({
        name,
        command: cfg.command,
        args: (cfg.args ?? []).join(" "),
        env: stringifyEnv(cfg.env),
      })),
    };
  }

  updateSettings(patch: EditableSettings): { summary: SettingsSummary; editable: EditableSettings } {
    const target = patch.saveTarget;
    const raw = this.readTargetSettings(target);
    const next: DeepcodingSettings = { ...raw };

    const env: Record<string, string | undefined> = { ...(raw.env ?? {}) };
    const apiKey = patch.apiKey.trim();
    if (apiKey) {
      env.API_KEY = apiKey;
    } else {
      delete env.API_KEY;
    }
    const baseURL = patch.baseURL.trim();
    if (baseURL) {
      env.BASE_URL = baseURL;
    } else {
      delete env.BASE_URL;
    }
    if (Object.keys(env).length > 0) {
      next.env = env;
    } else {
      delete next.env;
    }

    const model = patch.model.trim();
    if (model) {
      next.model = model;
    } else {
      delete next.model;
    }

    const temperature = Number(patch.temperature);
    if (patch.temperature.trim() && Number.isFinite(temperature)) {
      next.temperature = temperature;
    } else {
      delete next.temperature;
    }

    next.thinkingEnabled = patch.thinkingEnabled;
    if (patch.thinkingEnabled) {
      next.reasoningEffort = patch.reasoningEffort;
    } else {
      delete next.reasoningEffort;
    }

    next.telemetryEnabled = patch.telemetryEnabled;
    next.debugLogEnabled = patch.debugLogEnabled;
    next.permissions = buildPermissionSettings(patch.permissionDefaultMode, patch.permissions);

    const servers: Record<string, McpServerConfig> = {};
    for (const server of patch.mcpServers) {
      const name = server.name.trim();
      const command = server.command.trim();
      if (!name || !command) {
        continue;
      }
      const config: McpServerConfig = { command };
      const args = parseArgs(server.args);
      if (args.length > 0) {
        config.args = args;
      }
      const parsedEnv = parseEnvLines(server.env);
      if (Object.keys(parsedEnv).length > 0) {
        config.env = parsedEnv;
      }
      servers[name] = config;
    }
    if (Object.keys(servers).length > 0) {
      next.mcpServers = servers;
    } else {
      delete next.mcpServers;
    }

    if (target === "project") {
      writeProjectSettings(next, this.projectRoot);
    } else {
      writeSettings(next);
    }

    this.reload();
    this.emit(IpcEvent.McpStatusChanged);
    return { summary: toSettingsSummary(this.projectRoot), editable: this.getEditableSettings() };
  }

  setModel(selection: ModelConfigSelection): SettingsSummary {
    const current = resolveCurrentSettings(this.projectRoot);
    const { changed } = writeModelConfigSelection(selection, current, this.projectRoot);
    if (changed) {
      const content = `/model\n└ Set model to ${selection.model} (${selection.thinkingEnabled ? selection.reasoningEffort : "no thinking"})`;
      const active = this.manager.getActiveSessionId();
      if (active) {
        this.manager.addSessionSystemMessage(active, content, true, { isModelChange: true });
      }
    }
    return toSettingsSummary(this.projectRoot);
  }

  // ── MCP ─────────────────────────────────────────────────────────────────────
  mcpStatus() {
    return this.manager.getMcpStatus();
  }

  async mcpReconnect(name: string): Promise<void> {
    const latest = resolveCurrentSettings(this.projectRoot);
    const config: McpServerConfig | undefined = latest.mcpServers?.[name];
    await this.manager.reconnectMcpServer(name, config);
  }

  // ── Undo ─────────────────────────────────────────────────────────────────────
  listUndoTargets(sessionId: string) {
    return this.manager.listUndoTargets(sessionId);
  }

  restoreUndo(sessionId: string, messageId: string, mode: "conversation" | "code-and-conversation"): void {
    if (mode === "code-and-conversation") {
      this.manager.restoreSessionCode(sessionId, messageId);
    }
    this.manager.restoreSessionConversation(sessionId, messageId);
  }
}
