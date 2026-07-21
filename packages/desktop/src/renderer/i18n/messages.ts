// Bilingual (English / Chinese) message catalog for the desktop renderer.
// `en` is the source of truth; `zh` must provide the same keys (enforced by the
// `Record<MessageKey, string>` type). Values may contain `{name}` placeholders
// that are substituted at call time.

export const en = {
  // ── Common ────────────────────────────────────────────────
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.apply": "Apply",
  "common.remove": "Remove",
  "common.show": "Show",
  "common.hide": "Hide",
  "common.submit": "Submit",
  "common.skip": "Skip",
  "common.interrupt": "Interrupt",

  // ── Top bar ───────────────────────────────────────────────
  "topbar.desktop": "Desktop",
  "topbar.mcpTitle": "MCP servers",
  "topbar.modelTitle": "Model settings",
  "topbar.settingsTitle": "Settings",
  "topbar.model": "model",
  "topbar.noApiKey": "⚠ No API key configured",
  "topbar.configureApiKey": "Configure API key",
  "topbar.languageTitle": "Language",
  "window.close": "Close",
  "window.minimize": "Minimize",
  "window.zoom": "Zoom",

  // ── Sidebar ───────────────────────────────────────────────
  "sidebar.sessions": "Sessions",
  "sidebar.new": "+ New",
  "sidebar.none": "No sessions yet.",
  "sidebar.untitled": "Untitled session",
  "sidebar.rename": "Rename",
  "sidebar.delete": "Delete",

  // ── Relative time ─────────────────────────────────────────
  "time.justNow": "just now",
  "time.minutesAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",

  // ── Session status ────────────────────────────────────────
  "status.running": "running",
  "status.completed": "completed",
  "status.error": "error",
  "status.interrupted": "interrupted",
  "status.ask_permission": "awaiting permission",
  "status.waiting_for_user": "waiting for you",
  "status.compacting": "compacting",
  "status.idle": "idle",

  // ── Composer ──────────────────────────────────────────────
  "composer.respondAbove": "Respond to the prompt above…",
  "composer.askPlaceholder": "Ask Deep Code to build, fix, or explain…",
  "composer.stop": "Stop",
  "composer.send": "Send",
  "composer.planMode": "Plan mode",
  "composer.hint": "Enter to send · Shift+Enter for newline",

  // ── Empty states ──────────────────────────────────────────
  "empty.subtitle": "Start a conversation to build, refactor, or explore your codebase.",
  "empty.tips": "Pick a project folder above, then type a request below.",
  "empty.newSession": "New session — send your first message.",

  // ── Message rendering ─────────────────────────────────────
  "msg.noContent": "(no content)",
  "msg.images": "{n} image(s)",
  "msg.thinking": "Thinking",
  "msg.reasoning": "reasoning…",
  "msg.plan": "Plan",
  "msg.result": "Result",
  "msg.loadedSkill": "Loaded skill: {name}",
  "msg.summaryInserted": "(conversation summary inserted)",

  // ── Permission card ───────────────────────────────────────
  "perm.required": "Permission required",
  "perm.proceed": "Do you want to proceed?",
  "perm.yes": "Yes",
  "perm.always": "Yes, and always allow",
  "perm.no": "No",

  // ── Permission scope short descriptions (allow-always tag) ─
  "scope.read-in-cwd": "reads inside this workspace",
  "scope.read-out-cwd": "reads outside this workspace",
  "scope.write-in-cwd": "writes inside this workspace",
  "scope.write-out-cwd": "writes outside this workspace",
  "scope.delete-in-cwd": "deletes inside this workspace",
  "scope.delete-out-cwd": "deletes outside this workspace",
  "scope.query-git-log": "Git history queries",
  "scope.mutate-git-log": "Git history changes",
  "scope.network": "network access",
  "scope.mcp": "MCP tool access",

  // ── Question card ─────────────────────────────────────────
  "question.title": "A question for you",
  "question.selectAny": " (select any)",

  // ── Plan card ─────────────────────────────────────────────
  "plan.ready": "Plan ready",
  "plan.chooseNext": "Choose what to do next:",
  "plan.implement.label": "Implement this plan",
  "plan.implement.desc": "Switch to Default mode and start executing.",
  "plan.stay.label": "Stay in Plan mode",
  "plan.stay.desc": "Keep refining before any changes are made.",
  "plan.default.label": "Switch to Default mode",
  "plan.default.desc": "Leave Plan mode without implementing yet.",

  // ── MCP status modal ──────────────────────────────────────
  "mcp.title": "MCP servers",
  "mcp.none": "No MCP servers configured. Add one from the ⚙ Settings → MCP servers tab.",
  "mcp.reconnect": "Reconnect",
  "mcp.toolsCount": "{n} tools",
  "mcpStatus.ready": "ready",
  "mcpStatus.starting": "starting",
  "mcpStatus.reconnecting": "reconnecting",
  "mcpStatus.failed": "failed",

  // ── Model modal ───────────────────────────────────────────
  "model.title": "Model settings",
  "model.model": "Model",
  "model.custom": "Custom (OpenAI-compatible)…",
  "model.customName": "Custom model name",
  "model.thinking": "Thinking",
  "model.thinkingMax": "Thinking mode [max]",
  "model.thinkingHigh": "Thinking mode [high]",
  "model.noThinking": "No thinking",
  "model.baseUrlKey": "Base URL: {url} · API key: {status}",
  "model.configured": "configured",
  "model.missing": "missing",

  // ── App status / errors ───────────────────────────────────
  "app.requestFailed": "Request failed.",
  "app.permissionDenied": "Permission denied. Add a reply below, then press Enter to continue.",

  // ── Settings modal ────────────────────────────────────────
  "settings.title": "Settings",
  "settings.savingTo": "Saving to",
  "settings.target.user": "user",
  "settings.target.project": "project",
  "settings.tab.connection": "Connection",
  "settings.tab.model": "Model",
  "settings.tab.permissions": "Permissions",
  "settings.tab.mcp": "MCP servers",
  "settings.apiKey": "API key",
  "settings.envOverride":
    "An API key is also set via the DEEPCODE_API_KEY environment variable, which overrides this value.",
  "settings.baseUrl": "Base URL",
  "settings.baseUrlHint": "Leave empty to use the default DeepSeek endpoint.",
  "settings.model": "Model",
  "settings.temperature": "Temperature",
  "settings.temperaturePlaceholder": "unset (0–2)",
  "settings.temperatureHint": "Empty uses the model default. Valid range 0–2.",
  "settings.thinkingMode": "Thinking mode",
  "settings.reasoningEffort": "Reasoning effort",
  "settings.telemetry": "Telemetry enabled",
  "settings.debugLog": "Debug logging",
  "settings.defaultMode": "Default mode",
  "settings.allowAll": "Allow all (ask only where required)",
  "settings.askAll": "Ask for everything",
  "settings.permHint": 'Per-scope choices below override the default. "Default" follows the mode above.',
  "settings.mcpNone": "No MCP servers configured. Add one below.",
  "settings.serverName": "server name",
  "settings.command": "command (e.g. npx)",
  "settings.args": "args (space separated, e.g. -y @playwright/mcp@latest)",
  "settings.envLines": "env, one KEY=VALUE per line",
  "settings.addServer": "+ Add server",
  "decision.default": "default",
  "decision.allow": "allow",
  "decision.ask": "ask",
  "decision.deny": "deny",

  // ── Permission scope editor (Settings › Permissions) ──────
  "permScope.read-in-cwd.label": "Read (in project)",
  "permScope.read-in-cwd.hint": "Read files inside the project",
  "permScope.read-out-cwd.label": "Read (outside project)",
  "permScope.read-out-cwd.hint": "Read files outside the project",
  "permScope.write-in-cwd.label": "Write (in project)",
  "permScope.write-in-cwd.hint": "Create or modify files in the project",
  "permScope.write-out-cwd.label": "Write (outside project)",
  "permScope.write-out-cwd.hint": "Create or modify files outside the project",
  "permScope.delete-in-cwd.label": "Delete (in project)",
  "permScope.delete-in-cwd.hint": "Delete files inside the project",
  "permScope.delete-out-cwd.label": "Delete (outside project)",
  "permScope.delete-out-cwd.hint": "Delete files outside the project",
  "permScope.query-git-log.label": "Read git history",
  "permScope.query-git-log.hint": "Query git log and status",
  "permScope.mutate-git-log.label": "Rewrite git history",
  "permScope.mutate-git-log.hint": "Amend, rebase, or reset commits",
  "permScope.network.label": "Network access",
  "permScope.network.hint": "Outbound network requests",
  "permScope.mcp.label": "MCP tools",
  "permScope.mcp.hint": "Invoke tools from MCP servers",
} as const;

export type MessageKey = keyof typeof en;
export type Locale = "en" | "zh";

export const zh: Record<MessageKey, string> = {
  // ── Common ────────────────────────────────────────────────
  "common.save": "保存",
  "common.cancel": "取消",
  "common.close": "关闭",
  "common.apply": "应用",
  "common.remove": "移除",
  "common.show": "显示",
  "common.hide": "隐藏",
  "common.submit": "提交",
  "common.skip": "跳过",
  "common.interrupt": "中断",

  // ── Top bar ───────────────────────────────────────────────
  "topbar.desktop": "桌面版",
  "topbar.mcpTitle": "MCP 服务器",
  "topbar.modelTitle": "模型设置",
  "topbar.settingsTitle": "设置",
  "topbar.model": "模型",
  "topbar.noApiKey": "⚠ 未配置 API Key",
  "topbar.configureApiKey": "配置 API Key",
  "topbar.languageTitle": "语言",
  "window.close": "关闭",
  "window.minimize": "最小化",
  "window.zoom": "缩放",

  // ── Sidebar ───────────────────────────────────────────────
  "sidebar.sessions": "会话",
  "sidebar.new": "+ 新建",
  "sidebar.none": "暂无会话。",
  "sidebar.untitled": "未命名会话",
  "sidebar.rename": "重命名",
  "sidebar.delete": "删除",

  // ── Relative time ─────────────────────────────────────────
  "time.justNow": "刚刚",
  "time.minutesAgo": "{n} 分钟前",
  "time.hoursAgo": "{n} 小时前",
  "time.daysAgo": "{n} 天前",

  // ── Session status ────────────────────────────────────────
  "status.running": "运行中",
  "status.completed": "已完成",
  "status.error": "错误",
  "status.interrupted": "已中断",
  "status.ask_permission": "等待授权",
  "status.waiting_for_user": "等待你的输入",
  "status.compacting": "压缩中",
  "status.idle": "空闲",

  // ── Composer ──────────────────────────────────────────────
  "composer.respondAbove": "请先回应上方的提示…",
  "composer.askPlaceholder": "让 Deep Code 构建、修复或解释…",
  "composer.stop": "停止",
  "composer.send": "发送",
  "composer.planMode": "计划模式",
  "composer.hint": "回车发送 · Shift+回车换行",

  // ── Empty states ──────────────────────────────────────────
  "empty.subtitle": "开始对话，构建、重构或探索你的代码库。",
  "empty.tips": "先在上方选择项目文件夹，然后在下方输入需求。",
  "empty.newSession": "新会话 —— 发送你的第一条消息。",

  // ── Message rendering ─────────────────────────────────────
  "msg.noContent": "（无内容）",
  "msg.images": "{n} 张图片",
  "msg.thinking": "思考",
  "msg.reasoning": "推理中…",
  "msg.plan": "计划",
  "msg.result": "结果",
  "msg.loadedSkill": "已加载技能：{name}",
  "msg.summaryInserted": "（已插入对话摘要）",

  // ── Permission card ───────────────────────────────────────
  "perm.required": "需要授权",
  "perm.proceed": "是否继续？",
  "perm.yes": "允许",
  "perm.always": "允许，并始终允许",
  "perm.no": "拒绝",

  // ── Permission scope short descriptions ───────────────────
  "scope.read-in-cwd": "读取此工作区内的文件",
  "scope.read-out-cwd": "读取此工作区外的文件",
  "scope.write-in-cwd": "写入此工作区内的文件",
  "scope.write-out-cwd": "写入此工作区外的文件",
  "scope.delete-in-cwd": "删除此工作区内的文件",
  "scope.delete-out-cwd": "删除此工作区外的文件",
  "scope.query-git-log": "查询 Git 历史",
  "scope.mutate-git-log": "修改 Git 历史",
  "scope.network": "网络访问",
  "scope.mcp": "MCP 工具访问",

  // ── Question card ─────────────────────────────────────────
  "question.title": "有一个问题需要你确认",
  "question.selectAny": "（可多选）",

  // ── Plan card ─────────────────────────────────────────────
  "plan.ready": "计划已就绪",
  "plan.chooseNext": "选择接下来的操作：",
  "plan.implement.label": "实施此计划",
  "plan.implement.desc": "切换到默认模式并开始执行。",
  "plan.stay.label": "保持计划模式",
  "plan.stay.desc": "在做出更改前继续完善。",
  "plan.default.label": "切换到默认模式",
  "plan.default.desc": "退出计划模式，暂不实施。",

  // ── MCP status modal ──────────────────────────────────────
  "mcp.title": "MCP 服务器",
  "mcp.none": "尚未配置 MCP 服务器。可在 ⚙ 设置 → MCP 服务器 标签页中添加。",
  "mcp.reconnect": "重连",
  "mcp.toolsCount": "{n} 个工具",
  "mcpStatus.ready": "就绪",
  "mcpStatus.starting": "启动中",
  "mcpStatus.reconnecting": "重连中",
  "mcpStatus.failed": "失败",

  // ── Model modal ───────────────────────────────────────────
  "model.title": "模型设置",
  "model.model": "模型",
  "model.custom": "自定义（OpenAI 兼容）…",
  "model.customName": "自定义模型名称",
  "model.thinking": "思考",
  "model.thinkingMax": "思考模式 [max]",
  "model.thinkingHigh": "思考模式 [high]",
  "model.noThinking": "不思考",
  "model.baseUrlKey": "Base URL：{url} · API Key：{status}",
  "model.configured": "已配置",
  "model.missing": "未配置",

  // ── App status / errors ───────────────────────────────────
  "app.requestFailed": "请求失败。",
  "app.permissionDenied": "已拒绝授权。请在下方补充说明后按回车继续。",

  // ── Settings modal ────────────────────────────────────────
  "settings.title": "设置",
  "settings.savingTo": "保存到",
  "settings.target.user": "用户级",
  "settings.target.project": "项目级",
  "settings.tab.connection": "连接",
  "settings.tab.model": "模型",
  "settings.tab.permissions": "权限",
  "settings.tab.mcp": "MCP 服务器",
  "settings.apiKey": "API Key",
  "settings.envOverride": "环境变量 DEEPCODE_API_KEY 也设置了 API Key，会覆盖此处的值。",
  "settings.baseUrl": "Base URL",
  "settings.baseUrlHint": "留空则使用默认的 DeepSeek 端点。",
  "settings.model": "模型",
  "settings.temperature": "温度",
  "settings.temperaturePlaceholder": "未设置（0–2）",
  "settings.temperatureHint": "留空使用模型默认值。有效范围 0–2。",
  "settings.thinkingMode": "思考模式",
  "settings.reasoningEffort": "推理强度",
  "settings.telemetry": "启用遥测",
  "settings.debugLog": "调试日志",
  "settings.defaultMode": "默认模式",
  "settings.allowAll": "全部允许（仅必要时询问）",
  "settings.askAll": "全部询问",
  "settings.permHint": "下方各作用域的选择会覆盖默认模式。“默认”表示跟随上面的模式。",
  "settings.mcpNone": "尚未配置 MCP 服务器，可在下方添加。",
  "settings.serverName": "服务器名称",
  "settings.command": "命令（如 npx）",
  "settings.args": "参数（空格分隔，如 -y @playwright/mcp@latest）",
  "settings.envLines": "环境变量，每行一条 KEY=VALUE",
  "settings.addServer": "+ 添加服务器",
  "decision.default": "默认",
  "decision.allow": "允许",
  "decision.ask": "询问",
  "decision.deny": "拒绝",

  // ── Permission scope editor ───────────────────────────────
  "permScope.read-in-cwd.label": "读取（项目内）",
  "permScope.read-in-cwd.hint": "读取项目内的文件",
  "permScope.read-out-cwd.label": "读取（项目外）",
  "permScope.read-out-cwd.hint": "读取项目外的文件",
  "permScope.write-in-cwd.label": "写入（项目内）",
  "permScope.write-in-cwd.hint": "创建或修改项目内的文件",
  "permScope.write-out-cwd.label": "写入（项目外）",
  "permScope.write-out-cwd.hint": "创建或修改项目外的文件",
  "permScope.delete-in-cwd.label": "删除（项目内）",
  "permScope.delete-in-cwd.hint": "删除项目内的文件",
  "permScope.delete-out-cwd.label": "删除（项目外）",
  "permScope.delete-out-cwd.hint": "删除项目外的文件",
  "permScope.query-git-log.label": "读取 Git 历史",
  "permScope.query-git-log.hint": "查询 git log 和状态",
  "permScope.mutate-git-log.label": "重写 Git 历史",
  "permScope.mutate-git-log.hint": "amend、rebase 或 reset 提交",
  "permScope.network.label": "网络访问",
  "permScope.network.hint": "对外网络请求",
  "permScope.mcp.label": "MCP 工具",
  "permScope.mcp.hint": "调用 MCP 服务器的工具",
};

export const messages: Record<Locale, Record<MessageKey, string>> = { en, zh };
