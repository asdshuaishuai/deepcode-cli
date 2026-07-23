import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { api } from "./api";
import type {
  AskPermissionRequest,
  EditableSettings,
  McpServerStatus,
  ModelConfigSelection,
  SerializableProcess,
  SerializableSessionEntry,
  SessionMessage,
  SettingsSummary,
  SkillInfo,
  UserPromptContent,
} from "../shared/ipc";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { MessageList } from "./components/MessageList";
import { Composer } from "./components/Composer";
import { PermissionCard } from "./components/PermissionCard";
import { QuestionCard } from "./components/QuestionCard";
import { PlanCard } from "./components/PlanCard";
import { SettingsPanel } from "./components/SettingsPanel";
import { TaskPanel } from "./components/TaskPanel";
import { SourceControlPanel } from "./components/SourceControlPanel";
import { PluginMcpPanel } from "./components/PluginMcpPanel";
import { PluginDetail, type PluginSelection } from "./components/PluginDetail";
import { ContextProgress } from "./components/ContextProgress";
import { TokenStatsPanel } from "./components/TokenStatsPanel";
import { IndexLibraryPanel } from "./components/IndexLibraryPanel";
import { DiffOverlay, type DiffTarget } from "./components/DiffOverlay";
import { UndoModal } from "./components/UndoModal";
import { ProcessOutputPanel, accumulateStdout } from "./components/ProcessOutputPanel";
import { aggregateUsage } from "./lib/token-usage";
import { buildToolSummary, getPlanLines } from "./lib/messages";
import type { PermissionResult } from "./lib/permissions";
import {
  findPendingAskUserQuestion,
  formatAskUserQuestionAnswers,
  type AskUserQuestionAnswers,
} from "./lib/ask-question";
import { extractProposedPlan, getImplementationPrompt, type PlanImplementationChoice } from "./lib/plan";
import {
  getStoredReasoningMode,
  nextReasoningMode,
  resolveAppearance,
  resolveTheme,
  baseTheme,
  setAppearance as persistAppearance,
  setTheme as persistTheme,
  setReasoningMode as persistReasoningMode,
  type Appearance,
  type ReasoningMode,
  type Theme,
} from "./lib/appearance";
import { useI18n } from "./i18n";
import { CommandPalette, Rail, RailButton, RailSpacer, type CommandItem } from "./ui/index";

type PendingPermissionReply = {
  sessionId: string;
  permissions: PermissionResult["permissions"];
  alwaysAllows: PermissionResult["alwaysAllows"];
};

/** Extract the markdown plan from the newest UpdatePlan tool message, if any. */
function findLatestPlan(messages: SessionMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "tool") continue;
    const lines = getPlanLines(buildToolSummary(message));
    if (lines.length > 0) return lines.join("\n");
  }
  return null;
}

function syntheticUserMessage(sessionId: string, content: string): SessionMessage {
  const now = new Date().toISOString();
  return {
    id: `synthetic-${Date.now()}`,
    sessionId,
    role: "user",
    content,
    contentParams: null,
    messageParams: null,
    compacted: false,
    visible: true,
    createTime: now,
    updateTime: now,
  };
}

export function App(): JSX.Element {
  const { t } = useI18n();
  const [projectRoot, setProjectRoot] = useState("");
  const [settings, setSettings] = useState<SettingsSummary | null>(null);
  const [platform, setPlatform] = useState<string>("");
  const [sessions, setSessions] = useState<SerializableSessionEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [, setMcpStatuses] = useState<McpServerStatus[]>([]);

  const [draft, setDraft] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const [streamProgress, setStreamProgress] = useState<{ startedAt: string; formattedTokens: string } | null>(null);
  const [nowTick, setNowTick] = useState(0);

  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [askPermissions, setAskPermissions] = useState<AskPermissionRequest[] | undefined>(undefined);
  const [pendingPermissionReply, setPendingPermissionReply] = useState<PendingPermissionReply | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<Set<string>>(() => new Set());

  const [modal, setModal] = useState<"undo" | null>(null);
  const [editable, setEditable] = useState<EditableSettings | null>(null);
  const [settingsInitialTab, setSettingsInitialTab] = useState<string | undefined>(undefined);

  const [mainView, setMainView] = useState<"chat" | "settings" | "plugins">("chat");
  const [selectedPlugin, setSelectedPlugin] = useState<PluginSelection | null>(null);
  const [sidebarView, setSidebarView] = useState<"explorer" | "scm" | "tasks" | "tokens" | "index" | "plugins">(
    "explorer"
  );
  const [treeRefreshKey, setTreeRefreshKey] = useState(0);
  const [diffTarget, setDiffTarget] = useState<DiffTarget | null>(null);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<string[]>([]);

  const [appearance, setAppearanceState] = useState<Appearance>("light");
  const [theme, setThemeState] = useState<Theme>("aqua");
  const [reasoningMode, setReasoningModeState] = useState<ReasoningMode>(() => getStoredReasoningMode());

  const [panelOpen, setPanelOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showProcessPanel, setShowProcessPanel] = useState(false);
  const [runningProcesses, setRunningProcesses] = useState<SerializableProcess[]>([]);
  const processStdoutRef = useRef<Map<number, string>>(new Map());

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;
  const projectRootRef = useRef<string>("");
  projectRootRef.current = projectRoot;
  const pendingSelectRef = useRef<string | null>(null);

  const bumpTree = useCallback(() => setTreeRefreshKey((k) => k + 1), []);
  // VSCode-style activity bar: selecting a rail view swaps the left panel while
  // the main area stays put. Re-selecting the active view toggles the panel.
  const selectView = useCallback((view: "explorer" | "scm" | "tasks" | "tokens" | "index" | "plugins") => {
    setSidebarView((prev) => {
      if (prev === view) {
        setPanelOpen((wasOpen) => !wasOpen);
        return view;
      }
      setPanelOpen(true);
      return view;
    });
  }, []);
  const openTokensView = useCallback(() => selectView("tokens"), [selectView]);

  // ── Data loading ────────────────────────────────────────────────────────────
  const refreshSessions = useCallback(async () => {
    setSessions(await api.listSessions());
  }, []);

  const refreshSkills = useCallback(async (sessionId?: string) => {
    setSkills(await api.listSkills(sessionId));
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await api.getSettings());
  }, []);

  const refreshMcp = useCallback(async () => {
    setMcpStatuses(await api.mcpStatus());
  }, []);

  const refreshGit = useCallback(async () => {
    const [current, list] = await Promise.all([api.gitCurrentBranch(), api.gitListBranches()]);
    setBranch(current);
    setBranches(list);
  }, []);

  const loadSession = useCallback(
    async (id: string | null) => {
      await api.setActiveSession(id);
      setActiveId(id);
      setPendingPlan(null);
      setErrorLine(null);
      setPendingPermissionReply((prev) => (prev && prev.sessionId !== id ? null : prev));
      if (!id) {
        setMessages([]);
        setActiveStatus(null);
        setAskPermissions(undefined);
        setPlanMode(false);
        await refreshSkills();
        return;
      }
      const [entry, msgs] = await Promise.all([api.getSession(id), api.listMessages(id)]);
      setMessages(msgs);
      setActiveStatus(entry?.status ?? null);
      setAskPermissions(entry?.askPermissions);
      setPlanMode(entry?.planMode === true);
      await refreshSkills(id);
    },
    [refreshSkills]
  );

  // ── Startup + event wiring ───────────────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    void (async () => {
      const { projectRoot: root, platform: plat } = await api.ready();
      if (disposed) return;
      setProjectRoot(root);
      setPlatform(plat);
      setAppearanceState(resolveAppearance(plat));
      setThemeState(resolveTheme(plat));
      await Promise.all([refreshSessions(), refreshSettings(), refreshSkills(), refreshMcp(), refreshGit()]);
      const active = await api.getActiveSession();
      if (!disposed && active) {
        await loadSession(active);
      }
    })();

    const offMessage = api.onAssistantMessage((message) => {
      if (activeIdRef.current === null) {
        // A brand-new session is being created by the in-flight prompt; adopt it.
        activeIdRef.current = message.sessionId;
        setActiveId(message.sessionId);
      }
      if (message.sessionId === activeIdRef.current) {
        setMessages((prev) => [...prev, message]);
      }
    });

    const offEntry = api.onSessionEntryUpdated((entry) => {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === entry.id);
        if (idx === -1) return [entry, ...prev];
        const next = [...prev];
        next[idx] = entry;
        return next;
      });
      if (entry.id === activeIdRef.current) {
        setActiveStatus(entry.status);
        setAskPermissions(entry.askPermissions);
        setRunningProcesses(entry.processes ?? []);
      }
      bumpTree();
    });

    const offProcessStdout = api.onProcessStdout((event) => {
      accumulateStdout(processStdoutRef.current, event.pid, event.chunk);
    });

    const offStreamProgress = api.onLlmStreamProgress((progress) => {
      const p = progress as { phase?: string; startedAt?: string; formattedTokens?: string };
      if (p.phase === "end") {
        setStreamProgress(null);
        return;
      }
      if (p.startedAt) {
        setStreamProgress({ startedAt: p.startedAt, formattedTokens: p.formattedTokens ?? "0" });
      }
    });

    // Periodic tick for loading animation (500ms)
    const tickTimer = setInterval(() => {
      setNowTick((v) => v + 1);
    }, 500);

    const offMcp = api.onMcpStatusChanged(() => void refreshMcp());
    const offRoot = api.onProjectRootChanged((root) => {
      setProjectRoot(root);
      void (async () => {
        await Promise.all([refreshSessions(), refreshSettings(), refreshSkills(), refreshMcp(), refreshGit()]);
        const pending = pendingSelectRef.current;
        pendingSelectRef.current = null;
        await loadSession(pending);
        bumpTree();
      })();
    });

    return () => {
      disposed = true;
      offMessage();
      offEntry();
      offProcessStdout();
      offStreamProgress();
      offMcp();
      offRoot();
      clearInterval(tickTimer);
    };
  }, [bumpTree, loadSession, refreshGit, refreshMcp, refreshSessions, refreshSettings, refreshSkills]);

  // ── Prompt lifecycle ─────────────────────────────────────────────────────────
  const runPrompt = useCallback(
    async (prompt: UserPromptContent, opts: { showUser?: boolean; isContinue?: boolean } = {}) => {
      const activeSessionId = await api.getActiveSession();
      const reply =
        pendingPermissionReply && activeSessionId === pendingPermissionReply.sessionId ? pendingPermissionReply : null;
      if (reply) {
        prompt.permissions = prompt.permissions ?? reply.permissions;
        prompt.alwaysAllows = prompt.alwaysAllows ?? reply.alwaysAllows;
      }

      if (opts.showUser !== false && !opts.isContinue) {
        const display =
          (prompt.text ?? "").trim() ||
          (prompt.skills && prompt.skills.length > 0
            ? `Use skills: ${prompt.skills.map((s) => s.name).join(", ")}`
            : "");
        if (display) {
          setMessages((prev) => [...prev, syntheticUserMessage(activeSessionId ?? "", display)]);
        }
      }

      setBusy(true);
      setErrorLine(null);
      setStatusLine(null);
      try {
        const result = await api.sendPrompt(prompt);
        if (!result.ok) {
          setErrorLine(result.error ?? t("app.requestFailed"));
        }
        if (reply) {
          setPendingPermissionReply(null);
        }
        const finalId = await api.getActiveSession();
        if (finalId) {
          activeIdRef.current = finalId;
          setActiveId(finalId);
          setMessages(await api.listMessages(finalId));
          const entry = await api.getSession(finalId);
          setActiveStatus(entry?.status ?? null);
          setAskPermissions(entry?.askPermissions);
          const plan =
            prompt.planMode && entry?.status === "completed" ? extractProposedPlan(entry.assistantReply) : null;
          setPendingPlan(plan);
        }
        await Promise.all([refreshSessions(), refreshSkills(finalId ?? undefined)]);
      } catch (error) {
        setErrorLine(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
        setStreamProgress(null);
      }
    },
    [pendingPermissionReply, refreshSessions, refreshSkills, t]
  );

  const handleSend = useCallback(() => {
    const text = draft.trim();
    const skillObjs = skills.filter((s) => selectedSkills.includes(s.name));
    if (!text && skillObjs.length === 0 && imageUrls.length === 0) {
      return;
    }
    setDraft("");
    setSelectedSkills([]);
    setImageUrls([]);
    void runPrompt({
      text: text || undefined,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      skills: skillObjs.length > 0 ? skillObjs : undefined,
      planMode,
    });
  }, [draft, imageUrls, planMode, runPrompt, selectedSkills, skills]);

  const handleStop = useCallback(() => {
    void api.interrupt();
  }, []);

  const handlePermissionResult = useCallback(
    (result: PermissionResult) => {
      const sessionId = activeIdRef.current;
      if (!sessionId) return;
      if (result.hasDeny) {
        setPendingPermissionReply({
          sessionId,
          permissions: result.permissions,
          alwaysAllows: result.alwaysAllows,
        });
        setStatusLine(t("app.permissionDenied"));
        setAskPermissions(undefined);
        void api.denyPermission();
        return;
      }
      void runPrompt(
        { text: "/continue", permissions: result.permissions, alwaysAllows: result.alwaysAllows },
        { isContinue: true }
      );
    },
    [runPrompt, t]
  );

  const handlePermissionCancel = useCallback(() => {
    void api.interrupt();
    setActiveStatus("interrupted");
    setAskPermissions(undefined);
    void refreshSessions();
  }, [refreshSessions]);

  const handleQuestionAnswers = useCallback(
    (answers: AskUserQuestionAnswers) => {
      void runPrompt({ text: formatAskUserQuestionAnswers(answers) }, { showUser: false });
    },
    [runPrompt]
  );

  const handlePlanChoice = useCallback(
    (choice: PlanImplementationChoice) => {
      const plan = pendingPlan;
      setPendingPlan(null);
      if (choice === "stay") return;
      setPlanMode(false);
      if (choice === "implement" && plan) {
        void runPrompt({ text: getImplementationPrompt(plan), planMode: false });
      }
    },
    [pendingPlan, runPrompt]
  );

  // New workspace: pick a folder, switch root; the project-root-changed handler
  // resets to a fresh session slate (a session is created lazily on first prompt).
  const handleNewWorkspace = useCallback(async () => {
    const picked = await api.pickFolder();
    if (picked) {
      pendingSelectRef.current = null;
      setMainView("chat");
      await api.setProjectRoot(picked);
    }
  }, []);

  // New session within a workspace: switch root if needed (fresh slate follows),
  // else just reset the current workspace to a fresh session.
  const handleNewSessionInWorkspace = useCallback(
    async (root: string) => {
      setMainView("chat");
      if (root && root !== projectRootRef.current) {
        pendingSelectRef.current = null;
        await api.setProjectRoot(root);
        return;
      }
      await loadSession(null);
    },
    [loadSession]
  );

  const handleSwitchBranch = useCallback(
    async (next: string) => {
      const result = await api.gitCheckout(next);
      if (result.ok) {
        await refreshGit();
        await refreshSessions();
        bumpTree();
      } else {
        setErrorLine(result.error ?? t("app.requestFailed"));
        // Keep the dropdown in sync with the real branch after a failed switch.
        await refreshGit();
      }
    },
    [bumpTree, refreshGit, refreshSessions, t]
  );

  const handleSetModel = useCallback(async (selection: ModelConfigSelection) => {
    setSettings(await api.setModel(selection));
    const id = activeIdRef.current;
    if (id) {
      setMessages(await api.listMessages(id));
    }
  }, []);

  const handleOpenSettings = useCallback(async () => {
    setEditable(await api.getEditableSettings());
    setSettingsInitialTab(undefined);
    setMainView("settings");
  }, []);

  const handleToggleAppearance = useCallback(() => {
    setAppearanceState((prev) => {
      const next: Appearance = prev === "dark" ? "light" : "dark";
      persistAppearance(next);
      return next;
    });
  }, []);

  const handleToggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "glass" ? baseTheme(platform) : "glass";
      persistTheme(next);
      return next;
    });
  }, [platform]);

  // Theme selection from the settings panel (General tab). Applies immediately
  // (swaps the stylesheet link) and persists — no reload needed.
  const handleSelectTheme = useCallback((next: Theme) => {
    setThemeState(next);
    persistTheme(next);
  }, []);

  const handleCycleReasoning = useCallback(() => {
    setReasoningModeState((prev) => {
      const next = nextReasoningMode(prev);
      persistReasoningMode(next);
      return next;
    });
  }, []);

  const handleUndoRestored = useCallback(async () => {
    const id = activeIdRef.current;
    if (id) {
      setMessages(await api.listMessages(id));
      const entry = await api.getSession(id);
      setActiveStatus(entry?.status ?? null);
    }
    await refreshSessions();
  }, [refreshSessions]);

  const handleSaveSettings = useCallback(
    async (next: EditableSettings) => {
      const { summary, editable: fresh } = await api.updateSettings(next);
      setSettings(summary);
      setEditable(fresh);
      setMainView("chat");
      await Promise.all([refreshMcp(), refreshSkills(activeIdRef.current ?? undefined)]);
    },
    [refreshMcp, refreshSkills]
  );

  const handleNewSession = useCallback(() => {
    setMainView("chat");
    void loadSession(null);
  }, [loadSession]);
  const handleDeleteSession = useCallback(
    async (id: string) => {
      await api.deleteSession(id);
      await refreshSessions();
      bumpTree();
      if (id === activeIdRef.current) {
        await loadSession(null);
      }
    },
    [bumpTree, loadSession, refreshSessions]
  );
  const handleRenameSession = useCallback(
    async (id: string, summary: string) => {
      await api.renameSession(id, summary);
      await refreshSessions();
      bumpTree();
    },
    [bumpTree, refreshSessions]
  );
  const handleArchiveSession = useCallback(
    async (id: string) => {
      await api.archiveSession(id);
      await refreshSessions();
      bumpTree();
      if (id === activeIdRef.current) {
        await loadSession(null);
      }
    },
    [bumpTree, loadSession, refreshSessions]
  );
  const handleUnarchiveSession = useCallback(
    async (id: string) => {
      await api.unarchiveSession(id);
      await refreshSessions();
      bumpTree();
    },
    [bumpTree, refreshSessions]
  );
  const handleSelectSession = useCallback(
    async (root: string, id: string) => {
      if (root && root !== projectRootRef.current) {
        pendingSelectRef.current = id;
        await api.setProjectRoot(root);
        setMainView("chat");
        return;
      }
      setMainView("chat");
      await loadSession(id);
    },
    [loadSession]
  );
  const handleOpenDiff = useCallback((target: DiffTarget) => setDiffTarget(target), []);

  // ── ⌘K command palette + Ctrl+O process panel ────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        setShowProcessPanel((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const commandItems = useMemo<CommandItem[]>(
    () => [
      { id: "new", label: t("command.new.label"), keywords: "new session", run: handleNewSession },
      { id: "plan", label: t("command.plan.label"), keywords: "plan", run: () => setPlanMode((v) => !v) },
      {
        id: "plugins",
        label: t("command.plugins.label"),
        keywords: "plugins mcp skills",
        run: () => selectView("plugins"),
      },
      {
        id: "settings",
        label: t("command.settings.label"),
        keywords: "settings config",
        run: () => void handleOpenSettings(),
      },
      { id: "undo", label: t("command.undo.label"), keywords: "undo restore", run: () => setModal("undo") },
      {
        id: "tokens",
        label: t("command.tokens.label"),
        keywords: "token usage cost consumption",
        run: openTokensView,
      },
      {
        id: "init",
        label: t("command.init.label"),
        keywords: "init agents",
        run: () => void runPrompt({ text: "/init" }),
      },
      { id: "raw", label: t("command.raw.label"), keywords: "reasoning raw", run: handleCycleReasoning },
    ],
    [handleCycleReasoning, handleNewSession, handleOpenSettings, openTokensView, runPrompt, selectView, t]
  );

  // ── Derived UI ────────────────────────────────────────────────────────────────
  const pendingQuestion = useMemo(() => {
    const found = findPendingAskUserQuestion(messages, activeStatus);
    return found && !dismissedQuestionIds.has(found.messageId) ? found : null;
  }, [activeStatus, dismissedQuestionIds, messages]);

  const showQuestion = Boolean(pendingQuestion) && !busy;
  const showPermission =
    activeStatus === "ask_permission" &&
    !!askPermissions &&
    askPermissions.length > 0 &&
    !pendingPermissionReply &&
    !busy;
  const showPlan = Boolean(pendingPlan) && !busy;
  const hasPlan = useMemo(() => findLatestPlan(messages) !== null, [messages]);

  // Build loading text from stream progress + running processes (ported from CLI buildLoadingText).
  const loadingText = useMemo(() => {
    if (!busy) return null;
    // nowTick forces periodic recalculation for elapsed time display
    void nowTick;
    // Show running process info if any
    if (runningProcesses.length > 0) {
      const proc = runningProcesses[0];
      const elapsed = proc ? Math.max(0, Date.now() - new Date(proc.startTime).getTime()) : 0;
      const secs = Math.floor(elapsed / 1000);
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      const elapsedStr = mins > 0 ? `${mins}m${s}s` : `${secs}s`;
      return `(${elapsedStr}) ${proc?.command ?? ""}`;
    }
    if (!streamProgress) return t("composer.thinking");
    const startedAt = Date.parse(streamProgress.startedAt);
    if (Number.isNaN(startedAt)) return t("composer.thinking");
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    if (elapsedMs < 3000) return t("composer.thinking");
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    return `${t("composer.thinking")} (${elapsedSeconds}s) · \u2193 ${streamProgress.formattedTokens} tokens`;
  }, [busy, streamProgress, runningProcesses, nowTick, t]);

  // Auto-show process panel when processes start running.
  useEffect(() => {
    if (runningProcesses.length > 0 && busy) {
      setShowProcessPanel(true);
    }
  }, [runningProcesses, busy]);

  // Keep the conversation's bottom padding in sync with the floating
  // composer-dock's actual height so the last message can never sit
  // underneath the input. We measure the dock and write a CSS variable
  // consumed by .ui-conversation's padding-bottom. The +12px gap is a
  // small breathing buffer so the last line doesn't kiss the composer.
  const composerDockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = composerDockRef.current;
    if (!el) return;
    const apply = () => {
      const h = el.offsetHeight;
      document.documentElement.style.setProperty("--ui-composer-reserved", `${h + 12}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--ui-composer-reserved");
    };
  }, [mainView]);

  const footer = showQuestion ? (
    <QuestionCard
      questions={pendingQuestion!.questions}
      onSubmit={handleQuestionAnswers}
      onCancel={() => setDismissedQuestionIds((prev) => new Set(prev).add(pendingQuestion!.messageId))}
    />
  ) : showPermission ? (
    <PermissionCard requests={askPermissions!} onSubmit={handlePermissionResult} onCancel={handlePermissionCancel} />
  ) : showPlan ? (
    <PlanCard onSelect={handlePlanChoice} />
  ) : null;

  const composerDisabled = showQuestion || showPermission || showPlan;

  // Token mini-panel figures: active session context + workspace grand total.
  const workspaceUsage = useMemo(() => aggregateUsage(sessions), [sessions]);
  const activeContextTokens = useMemo(() => {
    const s = activeId ? sessions.find((x) => x.id === activeId) : null;
    return s ? s.activeTokens : 0;
  }, [activeId, sessions]);

  const reasoningIcon = reasoningMode === "hidden" ? "◌" : reasoningMode === "expanded" ? "◉" : "◎";
  const reasoningTitle =
    reasoningMode === "hidden"
      ? t("topbar.reasoningHidden")
      : reasoningMode === "expanded"
        ? t("topbar.reasoningExpanded")
        : t("topbar.reasoningNormal");
  const appearanceTitle = appearance === "dark" ? t("topbar.appearanceDark") : t("topbar.appearanceLight");
  const themeTitle = theme === "glass" ? t("topbar.themeGlass") : t("topbar.themeNative");

  return (
    <div className={`ui-shell${panelOpen ? " panel-open" : ""}`}>
      <Rail>
        <RailButton title={t("rail.newSession")} aria-label={t("rail.newSession")} onClick={handleNewSession}>
          ✎
        </RailButton>
        <RailButton
          active={panelOpen && sidebarView === "explorer"}
          title={t("rail.sessions")}
          aria-label={t("rail.sessions")}
          onClick={() => selectView("explorer")}
        >
          ☰
        </RailButton>
        <RailButton
          active={panelOpen && sidebarView === "scm"}
          title={t("rail.git")}
          aria-label={t("rail.git")}
          onClick={() => selectView("scm")}
        >
          ⑂
        </RailButton>
        {hasPlan ? (
          <RailButton
            active={panelOpen && sidebarView === "tasks"}
            title={t("rail.tasks")}
            aria-label={t("rail.tasks")}
            onClick={() => selectView("tasks")}
          >
            ✓
          </RailButton>
        ) : null}
        <RailButton title={t("rail.commands")} aria-label={t("rail.commands")} onClick={() => setPaletteOpen(true)}>
          ⌘
        </RailButton>
        <RailButton
          active={panelOpen && sidebarView === "plugins"}
          title={t("rail.plugins")}
          aria-label={t("rail.plugins")}
          onClick={() => selectView("plugins")}
        >
          ⧉
        </RailButton>
        <RailButton
          active={panelOpen && sidebarView === "tokens"}
          title={t("rail.tokens")}
          aria-label={t("rail.tokens")}
          onClick={openTokensView}
        >
          ▦
        </RailButton>
        <RailButton
          active={panelOpen && sidebarView === "index"}
          title={t("rail.index")}
          aria-label={t("rail.index")}
          onClick={() => selectView("index")}
        >
          📚
        </RailButton>
        <RailSpacer />
        <RailButton title={reasoningTitle} aria-label={reasoningTitle} onClick={handleCycleReasoning}>
          {reasoningIcon}
        </RailButton>
        <RailButton title={appearanceTitle} aria-label={appearanceTitle} onClick={handleToggleAppearance}>
          {appearance === "dark" ? "☾" : "☀"}
        </RailButton>
        {platform !== "win32" ? (
          <RailButton active={theme === "glass"} title={themeTitle} aria-label={themeTitle} onClick={handleToggleTheme}>
            ❖
          </RailButton>
        ) : null}
        <RailButton title={t("rail.undo")} aria-label={t("rail.undo")} onClick={() => setModal("undo")}>
          ↺
        </RailButton>
        <RailButton
          active={mainView === "settings"}
          title={t("rail.settings")}
          aria-label={t("rail.settings")}
          onClick={() => void handleOpenSettings()}
        >
          ⚙
        </RailButton>
      </Rail>

      {sidebarView === "explorer" ? (
        <Sidebar
          activeId={activeId}
          currentRoot={projectRoot}
          refreshKey={treeRefreshKey}
          sessions={sessions}
          onSelectSession={(root, id) => void handleSelectSession(root, id)}
          onDelete={(id) => void handleDeleteSession(id)}
          onRename={(id, summary) => void handleRenameSession(id, summary)}
          onArchive={(id) => void handleArchiveSession(id)}
          onUnarchive={(id) => void handleUnarchiveSession(id)}
          onCollapse={() => setPanelOpen(false)}
          onNewWorkspace={() => void handleNewWorkspace()}
          onNewSessionInWorkspace={(root) => void handleNewSessionInWorkspace(root)}
          onOpenTokens={openTokensView}
        />
      ) : sidebarView === "scm" ? (
        <SourceControlPanel refreshKey={treeRefreshKey} sessionId={activeId} onOpenDiff={handleOpenDiff} />
      ) : sidebarView === "tasks" ? (
        <TaskPanel messages={messages} />
      ) : sidebarView === "tokens" ? (
        <TokenStatsPanel sessions={sessions} />
      ) : sidebarView === "index" ? (
        <IndexLibraryPanel />
      ) : (
        <PluginMcpPanel
          skills={skills}
          selectedSkills={selectedSkills}
          onToggleSkill={(name) =>
            setSelectedSkills((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
          }
          onRefreshSkills={async () => {
            await api.pluginRefreshSkills(activeId ?? undefined);
            await refreshSkills(activeId ?? undefined);
          }}
          selected={selectedPlugin}
          onSelect={(sel) => {
            setSelectedPlugin(sel);
            setMainView("plugins");
          }}
        />
      )}

      <TopBar
        platform={platform}
        projectRoot={projectRoot}
        settings={settings}
        branch={branch}
        branches={branches}
        onSwitchBranch={(b) => void handleSwitchBranch(b)}
        onSetModel={(sel) => void handleSetModel(sel)}
        onOpenSettings={() => void handleOpenSettings()}
        onOpenTokens={openTokensView}
        activeTokens={activeContextTokens}
        totalTokens={workspaceUsage.totals.total}
      />

      <div className="ui-main">
        {mainView === "settings" && editable ? (
          <SettingsPanel
            initial={editable}
            initialTab={settingsInitialTab}
            sessions={sessions}
            onSave={(next) => void handleSaveSettings(next)}
            onClose={() => setMainView("chat")}
            platform={platform}
            theme={theme}
            onSelectTheme={handleSelectTheme}
          />
        ) : mainView === "plugins" ? (
          <PluginDetail
            selection={selectedPlugin}
            skills={skills}
            selectedSkills={selectedSkills}
            onToggleSkill={(name) =>
              setSelectedSkills((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
            }
            onBack={() => setMainView("chat")}
          />
        ) : (
          <>
            <MessageList
              messages={messages}
              hasActiveSession={activeId !== null || messages.length > 0}
              reasoningMode={reasoningMode}
              onQuickAction={(action) => {
                if (action === "plan") {
                  setPlanMode((v) => !v);
                } else if (action === "init") {
                  void runPrompt({ text: "/init" });
                } else if (action === "skills") {
                  selectView("plugins");
                } else if (action === "undo") {
                  setModal("undo");
                }
              }}
              footer={footer}
            />
            {showProcessPanel ? (
              <ProcessOutputPanel
                processes={runningProcesses}
                stdoutRef={processStdoutRef}
                onDismiss={() => setShowProcessPanel(false)}
              />
            ) : null}
            <div className="ui-composer-dock" ref={composerDockRef}>
              <Composer
                value={draft}
                onChange={setDraft}
                onSend={handleSend}
                onStop={handleStop}
                busy={busy}
                disabled={composerDisabled}
                planMode={planMode}
                onTogglePlan={() => setPlanMode((v) => !v)}
                skills={skills}
                selectedSkills={selectedSkills}
                onToggleSkill={(name) =>
                  setSelectedSkills((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
                }
                statusText={loadingText ?? statusLine}
                errorText={errorLine}
                imageUrls={imageUrls}
                onRemoveImage={(i) => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                onAddImage={(dataUrl) => setImageUrls((prev) => [...prev, dataUrl])}
                onSlashCommand={(cmd) => {
                  if (cmd === "new") {
                    handleNewSession();
                  } else if (cmd === "plan") {
                    setPlanMode((v) => !v);
                  } else if (cmd === "mcp" || cmd === "plugins") {
                    selectView("plugins");
                  } else if (cmd === "skills") {
                    // Skills are shown as chips already, nothing extra needed
                  } else if (cmd === "settings") {
                    void handleOpenSettings();
                  } else if (cmd === "undo") {
                    setModal("undo");
                  } else if (cmd === "init") {
                    void runPrompt({ text: "/init" });
                  } else if (cmd === "raw") {
                    handleCycleReasoning();
                  } else if (cmd === "continue") {
                    handleSend();
                  } else if (cmd === "resume") {
                    selectView("explorer");
                  } else if (cmd === "exit") {
                    void api.closeWindow();
                  }
                }}
              />
              <ContextProgress activeTokens={activeContextTokens} model={settings?.model ?? ""} />
            </div>
          </>
        )}
      </div>

      {diffTarget ? <DiffOverlay target={diffTarget} onClose={() => setDiffTarget(null)} /> : null}

      {modal === "undo" ? (
        <UndoModal sessionId={activeId} onClose={() => setModal(null)} onRestored={() => void handleUndoRestored()} />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        items={commandItems}
        placeholder={t("command.placeholder")}
        emptyLabel={t("command.empty")}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
