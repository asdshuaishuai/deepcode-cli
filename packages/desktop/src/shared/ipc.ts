// Shared IPC contract between the Electron main process and the renderer.
// Kept dependency-free (type-only imports) so it can be bundled into both sides.

import type {
  ModelConfigSelection,
  PermissionDefaultMode,
  PermissionScope,
  ReasoningEffort,
  SessionEntry,
  SessionMessage,
  SkillInfo,
  UndoTarget,
  UserPromptContent,
} from "@vegamo/deepcode-core";
import type { McpServerStatus } from "@vegamo/deepcode-core";
import type { AskPermissionRequest, UserToolPermission } from "@vegamo/deepcode-core";

/** Request/response channels (renderer -> main via ipcRenderer.invoke). */
export const IpcRequest = {
  Ready: "app:ready",
  PickFolder: "app:pickFolder",
  SetProjectRoot: "app:setProjectRoot",
  GetProjectRoot: "app:getProjectRoot",

  WindowMinimize: "window:minimize",
  WindowToggleMaximize: "window:toggleMaximize",
  WindowClose: "window:close",

  SessionList: "session:list",
  SessionGet: "session:get",
  SessionMessages: "session:messages",
  SessionSetActive: "session:setActive",
  SessionGetActive: "session:getActive",
  SessionDelete: "session:delete",
  SessionRename: "session:rename",

  PromptSend: "prompt:send",
  PromptInterrupt: "prompt:interrupt",
  PermissionDeny: "permission:deny",

  SkillsList: "skills:list",
  SettingsGet: "settings:get",
  SettingsGetEditable: "settings:getEditable",
  SettingsUpdate: "settings:update",
  ModelSet: "model:set",

  McpStatus: "mcp:status",
  McpReconnect: "mcp:reconnect",

  UndoList: "undo:list",
  UndoRestore: "undo:restore",
} as const;

/** Event channels (main -> renderer via webContents.send). */
export const IpcEvent = {
  AssistantMessage: "event:assistantMessage",
  SessionEntryUpdated: "event:sessionEntryUpdated",
  LlmStreamProgress: "event:llmStreamProgress",
  McpStatusChanged: "event:mcpStatusChanged",
  ProcessStdout: "event:processStdout",
  ProjectRootChanged: "event:projectRootChanged",
} as const;

export type UndoRestoreMode = "conversation" | "code-and-conversation";

/** A JSON-safe SessionEntry: the `processes` Map is flattened to an array. */
export type SerializableProcess = {
  pid: string;
  startTime: string;
  command: string;
  timeoutMs?: number;
  deadlineAt?: string;
};

export type SerializableSessionEntry = Omit<SessionEntry, "processes"> & {
  processes: SerializableProcess[];
};

/** Resolved settings summary surfaced to the renderer (never leaks the API key). */
export type SettingsSummary = {
  model: string;
  baseURL: string;
  thinkingEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  hasApiKey: boolean;
  statusSeparator: string;
};

/** A per-scope permission decision as edited in the GUI. */
export type PermissionDecision = "allow" | "ask" | "deny" | "default";

/** A single MCP server as edited in the GUI (strings are parsed on save). */
export type EditableMcpServer = {
  name: string;
  command: string;
  /** Whitespace/newline separated argv tokens. */
  args: string;
  /** One KEY=VALUE per line. */
  env: string;
};

/**
 * The raw, editable settings surfaced to the GUI config panel. Read directly from
 * the target settings file (never the env-resolved values), so saving cannot bake
 * environment-provided secrets into the file.
 */
export type EditableSettings = {
  /** Which file the panel reads from and writes to (project if it exists, else user). */
  saveTarget: "user" | "project";
  saveTargetPath: string;
  /** True when an API key is provided via environment and would override the file value. */
  hasEnvApiKey: boolean;
  apiKey: string;
  baseURL: string;
  model: string;
  /** Empty string means "unset". */
  temperature: string;
  thinkingEnabled: boolean;
  reasoningEffort: ReasoningEffort;
  telemetryEnabled: boolean;
  debugLogEnabled: boolean;
  permissionDefaultMode: PermissionDefaultMode;
  permissions: Partial<Record<PermissionScope, PermissionDecision>>;
  mcpServers: EditableMcpServer[];
};

export type ProcessStdoutEvent = { pid: number; chunk: string };

/** The typed surface exposed on `window.deepcode` from the preload script. */
export type DesktopApi = {
  ready(): Promise<{ projectRoot: string }>;
  pickFolder(): Promise<string | null>;
  setProjectRoot(root: string): Promise<{ projectRoot: string }>;
  getProjectRoot(): Promise<string>;

  minimizeWindow(): Promise<void>;
  toggleMaximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;

  listSessions(): Promise<SerializableSessionEntry[]>;
  getSession(id: string): Promise<SerializableSessionEntry | null>;
  listMessages(id: string): Promise<SessionMessage[]>;
  setActiveSession(id: string | null): Promise<void>;
  getActiveSession(): Promise<string | null>;
  deleteSession(id: string): Promise<boolean>;
  renameSession(id: string, summary: string): Promise<boolean>;

  sendPrompt(prompt: UserPromptContent): Promise<{ ok: boolean; error?: string }>;
  interrupt(): Promise<void>;
  denyPermission(reason?: string): Promise<void>;

  listSkills(sessionId?: string): Promise<SkillInfo[]>;
  getSettings(): Promise<SettingsSummary>;
  getEditableSettings(): Promise<EditableSettings>;
  updateSettings(patch: EditableSettings): Promise<{ summary: SettingsSummary; editable: EditableSettings }>;
  setModel(selection: ModelConfigSelection): Promise<SettingsSummary>;

  mcpStatus(): Promise<McpServerStatus[]>;
  mcpReconnect(name: string): Promise<void>;

  listUndoTargets(sessionId: string): Promise<UndoTarget[]>;
  restoreUndo(sessionId: string, messageId: string, mode: UndoRestoreMode): Promise<{ ok: boolean; error?: string }>;

  onAssistantMessage(cb: (message: SessionMessage) => void): () => void;
  onSessionEntryUpdated(cb: (entry: SerializableSessionEntry) => void): () => void;
  onLlmStreamProgress(cb: (progress: unknown) => void): () => void;
  onMcpStatusChanged(cb: () => void): () => void;
  onProcessStdout(cb: (event: ProcessStdoutEvent) => void): () => void;
  onProjectRootChanged(cb: (root: string) => void): () => void;
};

export type {
  AskPermissionRequest,
  McpServerStatus,
  ModelConfigSelection,
  PermissionDefaultMode,
  PermissionScope,
  ReasoningEffort,
  SessionMessage,
  SkillInfo,
  UndoTarget,
  UserPromptContent,
  UserToolPermission,
};
