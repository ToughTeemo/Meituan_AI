export type CardType = "transit" | "activity" | "dining" | "buffer";

export type CardStatus =
  | "done"
  | "active"
  | "upcoming"
  | "pending"
  | "risk"
  | "skipped";

export interface POI {
  poi_id: string;
  name: string;
  rating: number;
  price_per_person: number;
  queue_minutes: number;
  category: string;
  map_position: { x: number; y: number };
  is_child_friendly: boolean;
  /** 营业时间等补充展示 */
  hours_label?: string;
}

export interface Card {
  card_id: string;
  type: CardType;
  status: CardStatus;
  label: string;
  emoji: string;
  start_minute: number;
  duration_minutes: number;
  is_flexible: boolean;
  is_new?: boolean;
  poi?: POI;
  risk_note?: string;
  alternatives?: POI[];
}

export interface Constraints {
  goal: string;
  time_start: string;
  time_end: string;
  adults: number;
  children: number;
  children_age: number;
  budget: number;
  departure: string;
  transport_mode: "地铁" | "驾车" | "步行";
  pace: "轻松" | "紧凑";
  preference_tags: string[];
}

export interface TimelineConfig {
  pixels_per_minute: number;
  min_card_width: number;
  card_height_map: {
    transit: number;
    activity: number;
    dining: number;
    buffer: number;
  };
}

export interface PlanBundle {
  cards: Card[];
  timeline: TimelineConfig;
}

/** 与 PRD 对齐，并扩展演示用风险类型（天气 / 疲劳） */
export type RiskKind =
  | "queue"
  | "time"
  | "budget"
  | "closure"
  | "weather"
  | "fatigue";

export interface RiskSignal {
  risk_id: string;
  type: RiskKind;
  severity: "medium" | "high";
  title: string;
  description: string;
  affected_card_ids: string[];
}

export type MachineState =
  | "IDLE"
  | "EXECUTING"
  | "RISK_DETECTED"
  | "REPLANNING"
  | "COMPLETED";

export interface PlanState {
  cards: Card[];
  timeline: TimelineConfig;
  constraints: Constraints;
  planHistory: Card[][];
}

export type PlanAction =
  | { type: "SET_CARDS"; cards: Card[] }
  | { type: "PUSH_HISTORY" }
  | {
      type: "APPLY_CARD_PATCHES";
      patches: { card_id: string; patch: Partial<Card> }[];
    }
  | { type: "RESET_PLAN_DEMO"; cards: Card[] };

export interface AgentLogEntry {
  id: string;
  created_at: number;
  message: string;
}

export type ReplanPhase =
  | "idle"
  | "freezing"
  | "deconstructing"
  | "generating"
  | "animating"
  | "done";

export interface UIState {
  focusedCardId: string;
  activeRisk: RiskSignal | null;
  agentMessage: string | null;
  agentLogs: AgentLogEntry[];
  riskStatusSnapshot: Record<string, CardStatus> | null;
  replanPhase: ReplanPhase;
  /** animating 阶段用于新卡片 stagger 的顺序（仅本轮 Replan） */
  replanInsertedOrder: string[] | null;
  /** 是否允许 5 秒自动排队风险（Demo 控场） */
  autoRiskEnabled: boolean;
  /** 自动风险是否已在当前会话消费（Reset / 重新打开 Auto Risk 可恢复） */
  riskAutoConsumed: boolean;
}
