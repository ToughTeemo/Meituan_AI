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
  ApplyReplanProposalResponse,
  Card,
  ExecutionCheckResponse,
  ExecutionLatestResponse,
  ExecutionRiskFlag,
  PlanApiSnapshot,
  ReplanProposalListResponse,
  ReplanProposalResponse,
  RiskKind,
  RiskSignal,
} from "@/types/plan";

export interface PlanResponse extends PlanApiSnapshot {
  source?: "api" | "mock";
}

export interface RiskScanResponse {
  plan_id: string;
  status: "RISK_DETECTED" | "EXECUTING";
  risks: RiskSignal[];
  agent_logs: AgentLogEntry[];
  summary?: string;
  latest_proposal?: ReplanProposalResponse | null;
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
  updated_plan?: PlanResponse;
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

function riskKindFromBackendRiskType(riskType: string): RiskKind {
  const normalized = riskType.trim().toUpperCase();
  if (normalized === "WEATHER_RISK") return "weather";
  if (normalized === "QUEUE_RISK") return "queue";
  if (normalized === "PRICE_RISK") return "budget";
  if (normalized === "CLOSED_RISK" || normalized === "BOOKING_RISK") {
    return "closure";
  }
  return "time";
}

function severityForFrontend(severity: string): RiskSignal["severity"] {
  return severity.trim().toLowerCase() === "medium" ? "medium" : "high";
}

function levelForFrontend(severity: string): RiskSignal["level"] {
  const normalized = severity.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  if (normalized === "critical") return "high";
  return "medium";
}

function affectedCardIdsForRisk(cards: Card[], flag: ExecutionRiskFlag): string[] {
  const poiId = flag.poi_id?.trim();
  if (poiId) {
    const matched = cards
      .filter((card) => card.poi?.poi_id === poiId)
      .map((card) => card.card_id);
    if (matched.length > 0) return matched;
  }

  const active = cards.find((card) => card.status === "active" || card.status === "current");
  if (active) return [active.card_id];
  return cards[0] ? [cards[0].card_id] : [];
}

function riskSignalFromExecution(
  flag: ExecutionRiskFlag,
  index: number,
  cards: Card[],
  execution: ExecutionCheckResponse,
  proposal: ReplanProposalResponse | null,
): RiskSignal {
  const proposalPayload = proposal?.proposal;
  const riskType = proposal?.risk_type ?? flag.type;
  const summary = proposalPayload?.proposal_summary || execution.summary || flag.message;
  const reason = proposalPayload?.reason || flag.message || execution.summary;
  const affectedCardIds = affectedCardIdsForRisk(cards, flag);

  return {
    risk_id: `${flag.type}_${flag.source}_${flag.poi_id ?? index}`,
    type: riskKindFromBackendRiskType(riskType),
    level: levelForFrontend(flag.severity),
    title: riskType,
    description: summary,
    affectedCardIds,
    detectedAt: new Date().toISOString(),
    suggestedAction: reason,
    requiresUserConfirm: flag.can_replan,
    severity: severityForFrontend(flag.severity),
    affected_card_ids: affectedCardIds,
  };
}

function shouldLoadLatestProposal(execution: ExecutionCheckResponse): boolean {
  return (
    execution.status === "NEEDS_REPLAN" ||
    execution.risk_flags.some((flag) => flag.can_replan)
  );
}

function executionToRiskScanResponse(
  planId: string,
  cards: Card[],
  execution: ExecutionCheckResponse,
  proposal: ReplanProposalResponse | null,
): RiskScanResponse {
  const risks = execution.risk_flags.map((flag, index) =>
    riskSignalFromExecution(flag, index, cards, execution, proposal),
  );
  const summaryMessage =
    proposal?.proposal.proposal_summary ||
    proposal?.proposal.reason ||
    execution.summary;

  return {
    plan_id: planId,
    status: risks.length > 0 ? "RISK_DETECTED" : "EXECUTING",
    risks,
    agent_logs: summaryMessage ? [makeLog(summaryMessage)] : [],
    summary: execution.summary,
    latest_proposal: proposal,
    source: "api",
  };
}

function planWithApiSource(plan: PlanApiSnapshot): PlanResponse {
  return { ...plan, source: "api" };
}

function replanResponseFromApply(
  input: {
    version: number;
    cards: Card[];
  },
  response: ApplyReplanProposalResponse,
): ReplanResponse {
  if (!response.updated_plan) {
    throw new Error("Apply replan response did not include updated_plan.");
  }

  const updatedPlan = planWithApiSource(response.updated_plan);
  const oldIds = new Set(input.cards.map((card) => card.card_id));
  const newIds = new Set(updatedPlan.cards.map((card) => card.card_id));
  const agentMessage =
    response.proposal.proposal_summary ||
    response.proposal.reason ||
    "Replan proposal applied.";

  return {
    plan_id: updatedPlan.plan_id,
    status: "EXECUTING",
    version: updatedPlan.version,
    cards: updatedPlan.cards,
    inserted_card_ids: updatedPlan.cards
      .filter((card) => !oldIds.has(card.card_id))
      .map((card) => card.card_id),
    removed_card_ids: input.cards
      .filter((card) => !newIds.has(card.card_id))
      .map((card) => card.card_id),
    agent_message: agentMessage,
    agent_logs: [makeLog(response.proposal.reason || agentMessage)],
    updated_plan: updatedPlan,
    source: "api",
  };
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

export function checkExecution(planId: string): Promise<ExecutionCheckResponse> {
  return apiJson<ExecutionCheckResponse>(`/api/plans/${planId}/execution/check`, {
    method: "POST",
  });
}

export function getLatestExecution(planId: string): Promise<ExecutionLatestResponse> {
  return apiJson<ExecutionLatestResponse>(`/api/plans/${planId}/execution/latest`);
}

export function getLatestReplanProposal(planId: string): Promise<ReplanProposalResponse> {
  return apiJson<ReplanProposalResponse>(`/api/plans/${planId}/replan/latest`);
}

export function listReplanProposals(planId: string): Promise<ReplanProposalListResponse> {
  return apiJson<ReplanProposalListResponse>(`/api/plans/${planId}/replans`);
}

export function applyReplanProposal(
  planId: string,
  proposalId: string,
): Promise<ApplyReplanProposalResponse> {
  return apiJson<ApplyReplanProposalResponse>(
    `/api/plans/${planId}/replan/${proposalId}/apply`,
    {
      method: "POST",
    },
  );
}

export function scanRisks(input: {
  planId: string;
  cards: Card[];
  riskTypes?: RiskKind[];
}): Promise<RiskScanResponse> {
  return withFallback(
    async () => {
      const execution = await checkExecution(input.planId);
      let proposal: ReplanProposalResponse | null = null;
      if (shouldLoadLatestProposal(execution)) {
        try {
          proposal = await getLatestReplanProposal(input.planId);
        } catch {
          proposal = null;
        }
      }
      return executionToRiskScanResponse(input.planId, input.cards, execution, proposal);
    },
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
    async () => {
      const latest = await getLatestReplanProposal(input.planId);
      const applied = await applyReplanProposal(input.planId, latest.proposal_id);
      return replanResponseFromApply(input, applied);
    },
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
