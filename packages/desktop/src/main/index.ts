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

function emit(channel: string, payload?: unknown): void {
  mainWindow?.webContents.send(channel, payload);
}

function getBridge(): SessionBridge {
  if (!bridge) {
    bridge = new SessionBridge(app.getPath("home"), emit);
  }
  return bridge;
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: "#e7ecf2",
    title: "Deep Code",
    autoHideMenuBar: true,
    // Frameless so the renderer can draw the period-correct Aqua title bar with
    // its own gumdrop (traffic-light) window controls in the top-left.
    frame: false,
    titleBarStyle: "hidden",
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

  handle(IpcRequest.Ready, () => ({ projectRoot: getBridge().projectRoot }));
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

  handle(IpcRequest.SkillsList, (sessionId?: string) => getBridge().listSkills(sessionId));
  handle(IpcRequest.SettingsGet, () => getBridge().getSettings());
  handle(IpcRequest.SettingsGetEditable, () => getBridge().getEditableSettings());
  handle(IpcRequest.SettingsUpdate, (patch: EditableSettings) => getBridge().updateSettings(patch));
  handle(IpcRequest.ModelSet, (selection: ModelConfigSelection) => getBridge().setModel(selection));

  handle(IpcRequest.McpStatus, () => getBridge().mcpStatus());
  handle(IpcRequest.McpReconnect, (name: string) => getBridge().mcpReconnect(name));

  handle(IpcRequest.UndoList, (sessionId: string) => getBridge().listUndoTargets(sessionId));
  handle(IpcRequest.UndoRestore, (sessionId: string, messageId: string, mode: UndoRestoreMode) => {
    try {
      getBridge().restoreUndo(sessionId, messageId, mode);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
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
  if (process.platform !== "darwin") {
    app.quit();
  }
});
