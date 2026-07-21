// Ported from the CLI's PlanImplementationPrompt so the desktop UI can detect a
// finished plan and offer the same implement / stay / default choices.

export type PlanImplementationChoice = "implement" | "stay" | "default";

/** Return only a complete proposed plan, so partial/historic tags cannot trigger the chooser. */
export function extractProposedPlan(reply: string | null | undefined): string | null {
  if (!reply) {
    return null;
  }
  const match = reply.match(/<proposed_plan>\s*([\s\S]*?\S[\s\S]*?)\s*<\/proposed_plan>/);
  return match?.[1] ?? null;
}

export function getImplementationPrompt(plan: string): string {
  const fullWidthPunctuationCount = (plan.match(/[，、；。]/g) ?? []).length;
  return fullWidthPunctuationCount > 5 ? "实现此方案。" : "Implement the plan.";
}
