// Electron main process for the Deep Code Desktop client.
// Boots a BrowserWindow, wires the SessionBridge to IPC, and forwards engine
// events to the renderer.

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setShellIfWindows } from "@vegamo/deepcode-core";
import type { ModelConfigSelection, UserPromptContent } from "@vegamo/deepcode-core";
import { IpcEvent, IpcRequest } from "../shared/ipc.js";
import type { EditableSettings, UndoRestoreMode } from "../shared/ipc.js";
import { SessionBridge } from "./session-bridge.js";
import { PluginManager, type PluginEventCallback } from "./plugin-manager.js";
import { scanFiles } from "./file-scanner.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Deep Code's bash tool relies on a POSIX shell; on Windows this resolves Git Bash.
process.env.NoDefaultCurrentDirectoryInExePath = "1";
try {
  setShellIfWindows();
} catch (error) {
  // Surfaced later in the UI as a failed bash call rather than crashing at boot.
  console.error("[desktop] shell setup:", error instanceof Error ? error.message : String(error));
}

let mainWindow: BrowserWindow | null = null;
let bridge: SessionBridge | null = null;
let pluginManager: PluginManager | null = null;

function emit(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function getBridge(): SessionBridge {
  if (!bridge) {
    bridge = new SessionBridge(app.getPath("home"), emit);
  }
  return bridge;
}

function getPluginManager(): PluginManager {
  if (!pluginManager) {
    const b = getBridge();
    pluginManager = new PluginManager(
      () => b.getSessionManager(),
      () => {
        // De-typed access to resolveCurrentSettings via the bridge's own method
        const settings = b.getRawSettings();
        return {
          mcpServers: settings.mcpServers,
          enabledSkills: settings.enabledSkills,
        };
      }
    );
    const onEvent: PluginEventCallback = (event) => {
      emit(IpcEvent.PluginEvent, event);
    };
    pluginManager.setOnEvent(onEvent);
    void pluginManager.initialize();
  }
  return pluginManager;
}

function createWindow(): void {
  const isWin = process.platform === "win32";
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: isWin ? "#1d1d1d" : "#e7ecf2",
    title: "Deep Code",
    autoHideMenuBar: true,
    // frame:false 已隐藏原生标题栏和红绿灯(macOS)/标题栏(Windows)。
    // 不再设置 titleBarStyle — 它会导致 macOS 原生 traffic lights 仍然显示。
    frame: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  void mainWindow.loadFile(join(__dirname, "renderer/index.html"));

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function registerIpc(): void {
  const handle = <T>(channel: string, fn: (...args: never[]) => T | Promise<T>): void => {
    ipcMain.handle(channel, (_event, ...args) => fn(...(args as never[])));
  };

  handle(IpcRequest.Ready, () => ({
    projectRoot: getBridge().projectRoot,
    platform: process.platform,
  }));
  handle(IpcRequest.GetProjectRoot, () => getBridge().projectRoot);

  handle(IpcRequest.WindowMinimize, () => {
    mainWindow?.minimize();
  });
  handle(IpcRequest.WindowToggleMaximize, () => {
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  handle(IpcRequest.WindowClose, () => {
    mainWindow?.close();
  });

  handle(IpcRequest.PickFolder, async () => {
    if (!mainWindow) {
      return null;
    }
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Select project folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0] ?? null;
  });

  handle(IpcRequest.SetProjectRoot, (root: string) => {
    getBridge().setProjectRoot(root);
    emit(IpcEvent.ProjectRootChanged, getBridge().projectRoot);
    return { projectRoot: getBridge().projectRoot };
  });

  handle(IpcRequest.SessionList, () => getBridge().listSessions());
  handle(IpcRequest.SessionGet, (id: string) => getBridge().getSession(id));
  handle(IpcRequest.SessionMessages, (id: string) => getBridge().listMessages(id));
  handle(IpcRequest.SessionSetActive, (id: string | null) => getBridge().setActiveSession(id));
  handle(IpcRequest.SessionGetActive, () => getBridge().getActiveSession());
  handle(IpcRequest.SessionDelete, (id: string) => getBridge().deleteSession(id));
  handle(IpcRequest.SessionRename, (id: string, summary: string) => getBridge().renameSession(id, summary));

  handle(IpcRequest.PromptSend, async (prompt: UserPromptContent) => {
    try {
      await getBridge().sendPrompt(prompt);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  handle(IpcRequest.PromptInterrupt, () => getBridge().interrupt());
  handle(IpcRequest.PermissionDeny, (reason?: string) => getBridge().denyPermission(reason));

  handle(IpcRequest.SkillsList, (sessionId?: string) => getPluginManager().listSkills(sessionId));
  handle(IpcRequest.SettingsGet, () => getBridge().getSettings());
  handle(IpcRequest.SettingsGetEditable, () => getBridge().getEditableSettings());
  handle(IpcRequest.SettingsUpdate, (patch: EditableSettings) => getBridge().updateSettings(patch));
  handle(IpcRequest.ModelSet, (selection: ModelConfigSelection) => getBridge().setModel(selection));

  handle(IpcRequest.McpStatus, () => getPluginManager().getMcpStatus());
  handle(IpcRequest.McpReconnect, (name: string) => getPluginManager().reconnectMcp(name));

  handle(IpcRequest.UndoList, (sessionId: string) => getBridge().listUndoTargets(sessionId));
  handle(IpcRequest.UndoRestore, (sessionId: string, messageId: string, mode: UndoRestoreMode) => {
    try {
      getBridge().restoreUndo(sessionId, messageId, mode);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── Plugin IPC handlers ───────────────────────────────────────────────────
  handle(IpcRequest.PluginSearchSkills, (query: string, sessionId?: string) =>
    getPluginManager().searchSkills(query, sessionId)
  );
  handle(IpcRequest.PluginRefreshSkills, (sessionId?: string) => getPluginManager().refreshSkills(sessionId));
  handle(
    IpcRequest.PluginUpsertMcpServer,
    async (name: string, command: string, args?: string[], env?: Record<string, string>) => {
      const config = { command, args, env };
      await getPluginManager().upsertMcpServer(name, config);
    }
  );
  handle(IpcRequest.PluginRemoveMcpServer, async (name: string) => {
    await getPluginManager().removeMcpServer(name);
  });

  // ── File scanner (for @file mentions) ────────────────────────────────────
  handle(IpcRequest.ScanFiles, (query: string) => {
    return scanFiles(getBridge().projectRoot, query);
  });
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  bridge?.dispose();
  bridge = null;
  pluginManager?.dispose();
  pluginManager = null;
  if (process.platform !== "darwin") {
    app.quit();
  }
});
