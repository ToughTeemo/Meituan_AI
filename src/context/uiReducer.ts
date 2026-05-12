import type {
  AgentLogEntry,
  CardStatus,
  ReplanPhase,
  RiskSignal,
  UIState,
} from "@/types/plan";

export type UIAction =
  | { type: "FOCUS_CARD"; cardId: string }
  | {
      type: "OPEN_RISK";
      risk: RiskSignal;
      snapshot: Record<string, CardStatus>;
      agentMessage: string;
    }
  | { type: "CLEAR_RISK_UI" }
  | { type: "APPEND_LOG"; message: string }
  | { type: "SET_REPLAN_PHASE"; phase: ReplanPhase }
  | { type: "SET_REPLAN_INSERTED_ORDER"; ids: string[] | null }
  | { type: "CLEAR_AGENT_MESSAGE" }
  | { type: "RESOLVE_REPLAN_COMPLETE"; agentMessage: string }
  | { type: "SET_AUTO_RISK_ENABLED"; enabled: boolean }
  | { type: "MARK_AUTO_RISK_CONSUMED" }
  | { type: "DEMO_RESET"; focusedCardId: string };

function makeLog(message: string): AgentLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: Date.now(),
    message,
  };
}

export function createInitialUiState(focusedCardId: string): UIState {
  return {
    focusedCardId,
    activeRisk: null,
    agentMessage: null,
    agentLogs: [makeLog("方案已加载：进入执行态（EXECUTING）。")],
    riskStatusSnapshot: null,
    replanPhase: "idle",
    replanInsertedOrder: null,
    autoRiskEnabled: true,
    riskAutoConsumed: false,
  };
}

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "FOCUS_CARD":
      return { ...state, focusedCardId: action.cardId };
    case "OPEN_RISK":
      return {
        ...state,
        activeRisk: action.risk,
        riskStatusSnapshot: action.snapshot,
        agentMessage: action.agentMessage,
        agentLogs: state.agentLogs,
        replanPhase: "idle",
        replanInsertedOrder: null,
      };
    case "CLEAR_RISK_UI":
      return {
        ...state,
        activeRisk: null,
        agentMessage: null,
        riskStatusSnapshot: null,
        replanPhase: "idle",
        replanInsertedOrder: null,
      };
    case "APPEND_LOG":
      return {
        ...state,
        agentLogs: [...state.agentLogs, makeLog(action.message)],
      };
    case "SET_REPLAN_PHASE":
      return { ...state, replanPhase: action.phase };
    case "SET_REPLAN_INSERTED_ORDER":
      return { ...state, replanInsertedOrder: action.ids };
    case "CLEAR_AGENT_MESSAGE":
      return { ...state, agentMessage: null };
    case "RESOLVE_REPLAN_COMPLETE":
      return {
        ...state,
        activeRisk: null,
        riskStatusSnapshot: null,
        replanPhase: "idle",
        replanInsertedOrder: null,
        agentMessage: action.agentMessage,
      };
    case "SET_AUTO_RISK_ENABLED":
      return {
        ...state,
        autoRiskEnabled: action.enabled,
        riskAutoConsumed: action.enabled ? false : state.riskAutoConsumed,
      };
    case "MARK_AUTO_RISK_CONSUMED":
      return { ...state, riskAutoConsumed: true };
    case "DEMO_RESET":
      return {
        ...state,
        focusedCardId: action.focusedCardId,
        activeRisk: null,
        agentMessage: null,
        riskStatusSnapshot: null,
        replanPhase: "idle",
        replanInsertedOrder: null,
        agentLogs: [makeLog("演示已重置：回到初始方案（EXECUTING）。")],
        riskAutoConsumed: false,
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
