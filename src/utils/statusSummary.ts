import type { Card, Constraints, MachineState, RiskSignal } from "@/types/plan";
import { planWindowMinutes } from "@/utils/timeline";

export type RiskTone = "neutral" | "warn" | "alert";

export interface StatusSummaryViewModel {
  risk_badge_label: string;
  risk_tone: RiskTone;
  time_progress_percent: number;
  budget_used_percent: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function estimatedSpendForCard(
  card: Card,
  constraints: Constraints,
  mode: "full" | "partial60",
): number {
  const headcount = Math.max(1, constraints.adults + constraints.children);
  const base = card.poi?.price_per_person ?? 0;
  const factor = mode === "partial60" ? 0.6 : 1;
  return base * headcount * factor;
}

export function computeStatusSummary(input: {
  cards: Card[];
  constraints: Constraints;
  machine: MachineState;
  activeRisk: RiskSignal | null;
}): StatusSummaryViewModel {
  const windowMin = planWindowMinutes(
    input.constraints.time_start,
    input.constraints.time_end,
  );
  const safeWindow = Math.max(1, windowMin);

  let spentMinutes = 0;
  for (const c of input.cards) {
    if (c.status === "done") spentMinutes += c.duration_minutes;
    if (c.status === "active") spentMinutes += c.duration_minutes * 0.6;
    if (c.status === "risk") spentMinutes += c.duration_minutes * 0.35;
  }

  let spentBudget = 0;
  for (const c of input.cards) {
    if (c.status === "done")
      spentBudget += estimatedSpendForCard(c, input.constraints, "full");
    if (c.status === "active")
      spentBudget += estimatedSpendForCard(c, input.constraints, "partial60");
    if (c.status === "risk")
      spentBudget += estimatedSpendForCard(c, input.constraints, "partial60");
  }

  const time_progress_percent = clamp(
    Math.round((spentMinutes / safeWindow) * 100),
    0,
    100,
  );

  const budget_used_percent = clamp(
    Math.round((spentBudget / Math.max(1, input.constraints.budget)) * 100),
    0,
    100,
  );

  const hasRiskUi =
    input.machine === "RISK_DETECTED" && input.activeRisk != null;

  if (!hasRiskUi) {
    return {
      risk_badge_label: "正常",
      risk_tone: "neutral",
      time_progress_percent,
      budget_used_percent,
    };
  }

  const risk = input.activeRisk!;
  const tone: RiskTone = risk.severity === "high" ? "alert" : "warn";

  return {
    risk_badge_label: risk.title,
    risk_tone: tone,
    time_progress_percent,
    budget_used_percent,
  };
}
