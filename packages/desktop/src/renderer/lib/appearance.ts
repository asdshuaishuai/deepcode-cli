// Appearance (light/dark) system for the desktop renderer.
//
// The stylesheet is still chosen by OS platform (Aqua on macOS/Linux, Metro on
// Windows) — that split adapts to each system's native look and is intentional.
// On top of that, each theme ships BOTH a light and a dark variant, selected via
// the `data-appearance` attribute on <html> and driven by CSS variable overrides.
//
// Default per platform matches the theme's native tone: Aqua → light, Metro → dark.
// The user's explicit choice is persisted and wins over the platform default.

export type Appearance = "light" | "dark";
export type ReasoningMode = "normal" | "expanded" | "hidden";

const APPEARANCE_KEY = "deepcode.appearance";
const REASONING_KEY = "deepcode.reasoningMode";

/** The native tone for a platform's default stylesheet. */
export function defaultAppearance(platform: string): Appearance {
  return platform === "win32" ? "dark" : "light";
}

export function getStoredAppearance(): Appearance | null {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function resolveAppearance(platform: string): Appearance {
  return getStoredAppearance() ?? defaultAppearance(platform);
}

export function applyAppearance(appearance: Appearance): void {
  document.documentElement.dataset.appearance = appearance;
}

export function setAppearance(appearance: Appearance): void {
  applyAppearance(appearance);
  try {
    localStorage.setItem(APPEARANCE_KEY, appearance);
  } catch {
    // Persisting is best-effort.
  }
}

export function getStoredReasoningMode(): ReasoningMode {
  try {
    const stored = localStorage.getItem(REASONING_KEY);
    if (stored === "normal" || stored === "expanded" || stored === "hidden") {
      return stored;
    }
  } catch {
    // Fall through to default.
  }
  return "normal";
}

export function setReasoningMode(mode: ReasoningMode): void {
  try {
    localStorage.setItem(REASONING_KEY, mode);
  } catch {
    // Persisting is best-effort.
  }
}

/** The next mode when cycling the reasoning-display toggle. */
export function nextReasoningMode(mode: ReasoningMode): ReasoningMode {
  return mode === "normal" ? "expanded" : mode === "expanded" ? "hidden" : "normal";
}
