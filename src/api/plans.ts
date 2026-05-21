import { apiConfig, apiJson } from "@/api/client";
import { constraints as mockConstraints, initialPlan } from "@/mock";
import {
  agentMessageForRisk,
  createRiskSignalForDemoTrigger,
  resolveAffectedCardIds,
} from "@/mock/riskPresets";
import { demoTriggerFromRiskType, mergeLocalReplanSegment } from "@/mock/localReplan";
import type {
  AgentLogEntry,
  Card,
  Constraints,
  MachineState,
  RiskKind,
  RiskSignal,
  TimelineConfig,
} from "@/types/plan";

export interface PlanResponse {
  plan_id: string;
  session_id?: string;
  user_id?: string | null;
  city?: string;
  status: MachineState;
  version: number;
  constraints: Constraints;
  timeline: TimelineConfig;
  cards: Card[];
  active_risk: RiskSignal | null;
  agent_logs: AgentLogEntry[];
  summary: {
    title: string;
    subtitle: string;
  };
  created_at: string;
  updated_at: string;
  source?: "api" | "mock";
}

export interface RiskScanResponse {
  plan_id: string;
  status: "RISK_DETECTED" | "EXECUTING";
  risks: RiskSignal[];
  agent_logs: AgentLogEntry[];
  source?: "api" | "mock";
}

export interface ReplanResponse {
  plan_id: string;
  status: "EXECUTING";
  version: number;
  cards: Card[];
  inserted_card_ids: string[];
  removed_card_ids: string[];
  agent_message: string;
  agent_logs: AgentLogEntry[];
  source?: "api" | "mock";
}

export interface RequirementResponse {
  plan_id: string;
  requires_replan: boolean;
  risk: RiskSignal | null;
  agent_logs: AgentLogEntry[];
  message: string;
  source?: "api" | "mock";
}

export type PlanActionType =
  | "reserve_activity"
  | "reserve_restaurant"
  | "generate_route"
  | "share_plan"
  | "set_reminder";

export interface NextAction {
  action_id: PlanActionType;
  label: string;
  enabled: boolean;
}

export interface ConfirmPlanResponse {
  plan_id: string;
  status: "CONFIRMED";
  next_actions: NextAction[];
  agent_logs: AgentLogEntry[];
  source?: "api" | "mock";
}

export interface PlanActionResponse {
  action_id: string;
  action_type: PlanActionType;
  status: "pending" | "success" | "failed";
  message: string;
  agent_logs: AgentLogEntry[];
  source?: "api" | "mock";
}

export interface CreatePlanInput {
  prompt: string;
  sessionId?: string;
  userId?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeLog(message: string): AgentLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: Date.now(),
    message,
  };
}

function mockPlan(prompt: string, sessionId?: string): PlanResponse {
  const now = nowIso();
  return {
    plan_id: `mock_plan_${Date.now()}`,
    session_id: sessionId,
    status: "EXECUTING",
    version: 1,
    constraints: {
      ...mockConstraints,
      goal: prompt.trim() || mockConstraints.goal,
    },
    timeline: structuredClone(initialPlan.timeline),
    cards: structuredClone(initialPlan.cards),
    active_risk: null,
    agent_logs: [makeLog("方案已生成，正在为你关注排队、时间和预算变化。")],
    summary: {
      title: "周末下午亲子轻松路线",
      subtitle: "少排队、预算内、20:00 前回家",
    },
    created_at: now,
    updated_at: now,
    source: "mock",
  };
}

function demoTriggerFromRiskKind(riskKind: RiskKind): "queue" | "rain" | "fatigue" | null {
  if (riskKind === "queue") return "queue";
  if (riskKind === "weather") return "rain";
  if (riskKind === "fatigue") return "fatigue";
  return null;
}

function mockRiskScan(
  planId: string,
  cards: Card[],
  riskTypes: RiskKind[] = ["queue"],
): RiskScanResponse {
  const trigger = riskTypes.map(demoTriggerFromRiskKind).find((item) => item !== null);
  if (!trigger) {
    return {
      plan_id: planId,
      status: "EXECUTING",
      risks: [],
      agent_logs: [],
      source: "mock",
    };
  }

  const affected = resolveAffectedCardIds(cards, trigger);
  const risk = createRiskSignalForDemoTrigger(trigger, affected);
  return {
    plan_id: planId,
    status: "RISK_DETECTED",
    risks: [risk],
    agent_logs: [makeLog(agentMessageForRisk(risk))],
    source: "mock",
  };
}

function mockReplan(
  planId: string,
  version: number,
  cards: Card[],
  risk: RiskSignal,
): ReplanResponse {
  const trigger = demoTriggerFromRiskType(risk.type);
  const nextCards = trigger ? mergeLocalReplanSegment(cards, trigger) : null;
  const fallbackCards = structuredClone(cards);
  const resultCards = nextCards ?? fallbackCards;
  const oldIds = new Set(cards.map((card) => card.card_id));
  const newIds = new Set(resultCards.map((card) => card.card_id));

  return {
    plan_id: planId,
    status: "EXECUTING",
    version: version + 1,
    cards: resultCards,
    inserted_card_ids: resultCards
      .filter((card) => !oldIds.has(card.card_id))
      .map((card) => card.card_id),
    removed_card_ids: cards
      .filter((card) => !newIds.has(card.card_id))
      .map((card) => card.card_id),
    agent_message: agentMessageForRisk(risk),
    agent_logs: [makeLog("已按你的选择调整方案。")],
    source: "mock",
  };
}

function mockRequirement(planId: string, text: string, cards: Card[]): RequirementResponse {
  const normalized = text.trim();
  const trigger = normalized.includes("累")
    ? "fatigue"
    : normalized.includes("下雨") || normalized.includes("室内")
      ? "rain"
      : normalized.includes("排队") || normalized.includes("人多")
        ? "queue"
        : null;

  if (trigger) {
    const affected = resolveAffectedCardIds(cards, trigger);
    const risk = createRiskSignalForDemoTrigger(trigger, affected);
    return {
      plan_id: planId,
      requires_replan: true,
      risk,
      agent_logs: [makeLog(agentMessageForRisk(risk))],
      message: risk.description,
      source: "mock",
    };
  }

  const message = normalized.includes("预算")
    ? "收到：预算希望再省一点。后续会优先推荐更高性价比的选择。"
    : `收到：${normalized}。我会按这个偏好继续微调安排。`;
  return {
    plan_id: planId,
    requires_replan: false,
    risk: null,
    agent_logs: [makeLog(message)],
    message,
    source: "mock",
  };
}

function mockConfirm(planId: string): ConfirmPlanResponse {
  return {
    plan_id: planId,
    status: "CONFIRMED",
    next_actions: [
      { action_id: "reserve_activity", label: "预约亲子乐园", enabled: true },
      { action_id: "reserve_restaurant", label: "预约晚餐", enabled: true },
      { action_id: "generate_route", label: "生成路线", enabled: true },
      { action_id: "share_plan", label: "发送给同行人", enabled: true },
      { action_id: "set_reminder", label: "设置提醒", enabled: true },
    ],
    agent_logs: [makeLog("方案已确认，可以继续执行下一步动作。")],
    source: "mock",
  };
}

function mockAction(actionType: PlanActionType): PlanActionResponse {
  const labels: Record<PlanActionType, string> = {
    reserve_activity: "已开始尝试预约亲子活动，当前为演示结果。",
    reserve_restaurant: "已开始尝试预约餐厅，当前为演示结果。",
    generate_route: "已生成适合当前路线的出行指引。",
    share_plan: "已生成分享链接，可发送给同行人确认。",
    set_reminder: "已设置出发和返程提醒。",
  };
  return {
    action_id: `mock_act_${Date.now()}`,
    action_type: actionType,
    status: "success",
    message: labels[actionType],
    agent_logs: [makeLog(labels[actionType])],
    source: "mock",
  };
}

async function withFallback<T>(request: () => Promise<T>, fallback: () => T): Promise<T> {
  if (apiConfig.mode === "mock") return fallback();

  try {
    return await request();
  } catch (error) {
    if (!apiConfig.useMockFallback) throw error;
    return fallback();
  }
}

export function createPlan(input: CreatePlanInput | string): Promise<PlanResponse> {
  const normalizedInput =
    typeof input === "string"
      ? { prompt: input, sessionId: undefined, userId: undefined }
      : input;
  const { prompt, sessionId, userId } = normalizedInput;

  return withFallback(
    () =>
      apiJson<PlanResponse>("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          session_id: sessionId,
          user_id: userId,
        }),
      }).then((plan) => ({ ...plan, source: "api" as const })),
    () => mockPlan(prompt, sessionId),
  );
}

export function listPlans(sessionId: string): Promise<PlanResponse[]> {
  const params = new URLSearchParams({ session_id: sessionId });

  return withFallback(
    () =>
      apiJson<PlanResponse[]>(`/api/plans?${params.toString()}`).then((plans) =>
        plans.map((plan) => ({ ...plan, source: "api" as const })),
      ),
    () => [],
  );
}

export function scanRisks(input: {
  planId: string;
  cards: Card[];
  riskTypes?: RiskKind[];
}): Promise<RiskScanResponse> {
  return withFallback(
    () =>
      apiJson<RiskScanResponse>(`/api/plans/${input.planId}/risks/scan`, {
        method: "POST",
        body: JSON.stringify({
          risk_types: input.riskTypes ?? ["queue"],
        }),
      }).then((response) => ({ ...response, source: "api" as const })),
    () => mockRiskScan(input.planId, input.cards, input.riskTypes),
  );
}

export function replanRisk(input: {
  planId: string;
  riskId: string;
  risk: RiskSignal;
  version: number;
  cards: Card[];
}): Promise<ReplanResponse> {
  return withFallback(
    () =>
      apiJson<ReplanResponse>(
        `/api/plans/${input.planId}/risks/${input.riskId}/replan`,
        {
          method: "POST",
          body: JSON.stringify({
            strategy: "balanced",
            base_version: input.version,
          }),
        },
      ).then((response) => ({ ...response, source: "api" as const })),
    () => mockReplan(input.planId, input.version, input.cards, input.risk),
  );
}

export function submitRequirement(input: {
  planId: string;
  text: string;
  cards: Card[];
}): Promise<RequirementResponse> {
  return withFallback(
    () =>
      apiJson<RequirementResponse>(`/api/plans/${input.planId}/requirements`, {
        method: "POST",
        body: JSON.stringify({
          text: input.text,
          source: "user_input",
        }),
      }).then((response) => ({ ...response, source: "api" as const })),
    () => mockRequirement(input.planId, input.text, input.cards),
  );
}

export function confirmPlan(planId: string): Promise<ConfirmPlanResponse> {
  return withFallback(
    () =>
      apiJson<ConfirmPlanResponse>(`/api/plans/${planId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmed_by: "current_user" }),
      }).then((response) => ({ ...response, source: "api" as const })),
    () => mockConfirm(planId),
  );
}

export function runPlanAction(input: {
  planId: string;
  actionType: PlanActionType;
  cardId?: string;
}): Promise<PlanActionResponse> {
  return withFallback(
    () =>
      apiJson<PlanActionResponse>(`/api/plans/${input.planId}/actions`, {
        method: "POST",
        body: JSON.stringify({
          action_type: input.actionType,
          card_id: input.cardId,
        }),
      }).then((response) => ({ ...response, source: "api" as const })),
    () => mockAction(input.actionType),
  );
}
