import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { api } from "./api";
import type {
  AskPermissionRequest,
  EditableSettings,
  McpServerStatus,
  ModelConfigSelection,
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
import { ModelModal } from "./components/ModelModal";
import { McpModal } from "./components/McpModal";
import { SettingsModal } from "./components/SettingsModal";
import type { PermissionResult } from "./lib/permissions";
import {
  findPendingAskUserQuestion,
  formatAskUserQuestionAnswers,
  type AskUserQuestionAnswers,
} from "./lib/ask-question";
import { extractProposedPlan, getImplementationPrompt, type PlanImplementationChoice } from "./lib/plan";
import { useI18n } from "./i18n";

type PendingPermissionReply = {
  sessionId: string;
  permissions: PermissionResult["permissions"];
  alwaysAllows: PermissionResult["alwaysAllows"];
};

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
  const [sessions, setSessions] = useState<SerializableSessionEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([]);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [planMode, setPlanMode] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [askPermissions, setAskPermissions] = useState<AskPermissionRequest[] | undefined>(undefined);
  const [pendingPermissionReply, setPendingPermissionReply] = useState<PendingPermissionReply | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [dismissedQuestionIds, setDismissedQuestionIds] = useState<Set<string>>(() => new Set());

  const [modal, setModal] = useState<"model" | "mcp" | "settings" | null>(null);
  const [editable, setEditable] = useState<EditableSettings | null>(null);

  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

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
      const { projectRoot: root } = await api.ready();
      if (disposed) return;
      setProjectRoot(root);
      await Promise.all([refreshSessions(), refreshSettings(), refreshSkills(), refreshMcp()]);
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
      }
    });

    const offMcp = api.onMcpStatusChanged(() => void refreshMcp());
    const offRoot = api.onProjectRootChanged((root) => {
      setProjectRoot(root);
      void (async () => {
        await Promise.all([refreshSessions(), refreshSettings(), refreshSkills(), refreshMcp()]);
        await loadSession(null);
      })();
    });

    return () => {
      disposed = true;
      offMessage();
      offEntry();
      offMcp();
      offRoot();
    };
  }, [loadSession, refreshMcp, refreshSessions, refreshSettings, refreshSkills]);

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
      }
    },
    [pendingPermissionReply, refreshSessions, refreshSkills, t]
  );

  const handleSend = useCallback(() => {
    const text = draft.trim();
    const skillObjs = skills.filter((s) => selectedSkills.includes(s.name));
    if (!text && skillObjs.length === 0) {
      return;
    }
    setDraft("");
    setSelectedSkills([]);
    void runPrompt({
      text: text || undefined,
      skills: skillObjs.length > 0 ? skillObjs : undefined,
      planMode,
    });
  }, [draft, planMode, runPrompt, selectedSkills, skills]);

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

  const handlePickFolder = useCallback(async () => {
    const picked = await api.pickFolder();
    if (picked) {
      await api.setProjectRoot(picked);
    }
  }, []);

  const handleSetModel = useCallback(async (selection: ModelConfigSelection) => {
    setSettings(await api.setModel(selection));
    setModal(null);
    const id = activeIdRef.current;
    if (id) {
      setMessages(await api.listMessages(id));
    }
  }, []);

  const handleOpenSettings = useCallback(async () => {
    setEditable(await api.getEditableSettings());
    setModal("settings");
  }, []);

  const handleSaveSettings = useCallback(
    async (next: EditableSettings) => {
      const { summary, editable: fresh } = await api.updateSettings(next);
      setSettings(summary);
      setEditable(fresh);
      setModal(null);
      await Promise.all([refreshMcp(), refreshSkills(activeIdRef.current ?? undefined)]);
    },
    [refreshMcp, refreshSkills]
  );

  const handleNewSession = useCallback(() => void loadSession(null), [loadSession]);
  const handleDeleteSession = useCallback(
    async (id: string) => {
      await api.deleteSession(id);
      await refreshSessions();
      if (id === activeIdRef.current) {
        await loadSession(null);
      }
    },
    [loadSession, refreshSessions]
  );
  const handleRenameSession = useCallback(
    async (id: string, summary: string) => {
      await api.renameSession(id, summary);
      await refreshSessions();
    },
    [refreshSessions]
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

  return (
    <div className="app">
      <TopBar
        projectRoot={projectRoot}
        settings={settings}
        mcpCount={mcpStatuses.length}
        onPickFolder={() => void handlePickFolder()}
        onOpenModel={() => setModal("model")}
        onOpenMcp={() => setModal("mcp")}
        onOpenSettings={() => void handleOpenSettings()}
      />
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelect={(id) => void loadSession(id)}
        onNew={handleNewSession}
        onDelete={(id) => void handleDeleteSession(id)}
        onRename={(id, summary) => void handleRenameSession(id, summary)}
      />
      <div className="main">
        <MessageList messages={messages} hasActiveSession={activeId !== null || messages.length > 0} footer={footer} />
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
          statusText={statusLine}
          errorText={errorLine}
        />
      </div>

      {modal === "model" && settings ? (
        <ModelModal settings={settings} onApply={(sel) => void handleSetModel(sel)} onClose={() => setModal(null)} />
      ) : null}
      {modal === "mcp" ? (
        <McpModal
          servers={mcpStatuses}
          onReconnect={(name) => void api.mcpReconnect(name)}
          onClose={() => setModal(null)}
        />
      ) : null}
      {modal === "settings" && editable ? (
        <SettingsModal
          initial={editable}
          onSave={(next) => void handleSaveSettings(next)}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}
