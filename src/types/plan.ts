export type Currency = "CNY";
export type TransportMode = "subway" | "walk" | "taxi" | "drive" | "mixed";
export type CrowdLevel = "low" | "medium" | "high" | "unknown";

export type CardType = "transit" | "activity" | "dining" | "buffer";

export type PlanCardType =
  | "transport"
  | "activity"
  | "meal"
  | "rest"
  | "return"
  | "buffer";

export type CardStatus =
  | "done"
  | "active"
  | "current"
  | "upcoming"
  | "pending"
  | "risk"
  | "adjusted"
  | "skipped";

export type PlanStatus =
  | "draft"
  | "generating"
  | "ready"
  | "adjusting"
  | "confirmed"
  | "fallback";

export type PlanSource = "mock" | "api" | "llm" | "fallback";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Origin {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface TimeWindow {
  start: string;
  end: string;
  mustReturnBy?: string;
}

export interface Participants {
  adults: number;
  children: number;
  childAges?: number[];
  pets?: number;
}

export interface BudgetConstraint {
  amount: number;
  currency: Currency;
  scope: "total" | "per_person";
}

export type SceneType =
  | "family"
  | "couple"
  | "friends"
  | "pet_friendly"
  | "indoor_rainy"
  | "low_queue"
  | "budget";

export interface ParsedConstraints {
  goalText: string;
  city?: string;
  origin: Origin;
  timeWindow: TimeWindow;
  participants: Participants;
  budget: BudgetConstraint;
  transportPreference: TransportMode;
  pacePreference: "relaxed" | "normal" | "packed";
  sceneType: SceneType;
  preferences: string[];
  avoidances: string[];
  weatherSensitive?: boolean;
  createdAt?: string;
}

export type LegacyTransportMode = string;
export type LegacyPace = string;

export interface LegacyConstraints {
  goal: string;
  time_start: string;
  time_end: string;
  adults: number;
  children: number;
  children_age: number;
  budget: number;
  departure: string;
  transport_mode: LegacyTransportMode;
  pace: LegacyPace;
  preference_tags: string[];
}

export interface Constraints {
  goal: string;
  goalText?: string;
  city?: string;
  origin?: Origin;
  time_start: string;
  time_end: string;
  timeWindow?: TimeWindow;
  adults: number;
  children: number;
  children_age: number;
  participants?: Participants;
  budget: number;
  budgetDetail?: BudgetConstraint;
  departure: string;
  transport_mode: LegacyTransportMode;
  transportPreference?: TransportMode;
  pace: LegacyPace;
  pacePreference?: "relaxed" | "normal" | "packed";
  sceneType?: SceneType;
  preference_tags: string[];
  preferences?: string[];
  avoidances?: string[];
  weatherSensitive?: boolean;
  createdAt?: string;
}

export type POIType =
  | "park"
  | "restaurant"
  | "cafe"
  | "mall"
  | "bookstore"
  | "activity"
  | "transport"
  | "home"
  | "other";

export type QueueLevel = CrowdLevel;

export type ReservationStatus =
  | "available"
  | "unavailable"
  | "waitlist"
  | "unknown";

export interface POI {
  id?: string;
  name: string;
  type?: POIType;
  categoryLabel?: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating: number;
  avgPrice?: number;
  currency?: Currency;
  openingHours?: string;
  queueMinutes?: number;
  queueLevel?: QueueLevel;
  reservationStatus?: ReservationStatus;
  familyFriendly?: boolean;
  petFriendly?: boolean;
  indoor?: boolean;
  tags?: string[];

  poi_id: string;
  price_per_person: number;
  queue_minutes: number;
  category: string;
  map_position: { x: number; y: number };
  is_child_friendly: boolean;
  hours_label?: string;
  address?: string;
  district?: string;
  latitude?: number;
  longitude?: number;
  recommendation_reason?: string;
  risk_labels?: string[];
}

export interface RouteSegment {
  fromPoiId: string;
  toPoiId: string;
  mode: TransportMode;
  durationMinutes: number;
  distanceKm?: number;
  cost?: number;
  transferCount?: number;
  crowdLevel?: CrowdLevel;
  summary?: string;
}

export interface Card {
  id?: string;
  title?: string;
  subtitle?: string;
  planType?: PlanCardType;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  route?: RouteSegment;
  cost?: number;
  statusText?: string;
  reason?: string;
  adjustmentNote?: string;
  risks?: RiskSignal[];

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

export type PlanCard = Card;

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

export type RiskKind =
  | "queue"
  | "weather"
  | "budget"
  | "time"
  | "closure"
  | "fatigue";

export type ApiRiskKind =
  | "queue"
  | "weather"
  | "budget"
  | "time"
  | "traffic"
  | "closed"
  | "reservation"
  | "child_tired";

export interface RiskSignal {
  id?: string;
  type: RiskKind;
  level?: "low" | "medium" | "high";
  title: string;
  description: string;
  affectedCardIds?: string[];
  detectedAt?: string;
  suggestedAction?: string;
  requiresUserConfirm?: boolean;

  risk_id: string;
  severity: "medium" | "high";
  affected_card_ids: string[];
}

export interface PlanSummary {
  title: string;
  subtitle: string;
  totalBudget: number;
  budgetLimit: number;
  currency: Currency;
  totalDurationMinutes: number;
  expectedReturnTime: string;
  tags: string[];
  recommendationReason: string;
}

export interface PlanMapMarker {
  id: string;
  poiId?: string;
  cardId?: string;
  label: string;
  lat?: number;
  lng?: number;
  type: "current" | "next" | "normal" | "risk";
}

export interface PlanMap {
  currentCardId?: string;
  routePolyline?: GeoPoint[];
  markers?: PlanMapMarker[];
}

export interface PlanProgress {
  currentStep: number;
  totalSteps: number;
  percent: number;
  message: string;
}

export interface PlanDebugInfo {
  traceId?: string;
  llmUsed?: boolean;
  fallbackReason?: string;
}

export interface PlanBundle {
  planId?: string;
  version?: number;
  status?: PlanStatus;
  source?: PlanSource;
  constraints?: Constraints;
  summary?: PlanSummary;
  cards: Card[];
  risks?: RiskSignal[];
  map?: PlanMap;
  progress?: PlanProgress;
  updatedAt?: string;
  debug?: PlanDebugInfo;

  timeline: TimelineConfig;
}

export interface ParseGoalRequest {
  text: string;
  city?: string;
  originName?: string;
}

export interface ParseGoalResponse {
  constraints: Constraints;
  warnings?: string[];
}

export interface GeneratePlanRequest {
  constraints: Constraints;
}

export interface GeneratePlanResponse {
  plan: PlanBundle;
}

export type ReplanUserAction =
  | "accept_adjustment"
  | "reject_adjustment"
  | "regenerate"
  | "change_preference";

export interface ReplanRequest {
  plan: PlanBundle;
  risk?: RiskSignal;
  userAction?: ReplanUserAction;
  userMessage?: string;
}

export interface ReplanResponse {
  plan: PlanBundle;
  changedCardIds: string[];
  message: string;
}

export interface ConfirmPlanRequest {
  planId: string;
  plan: PlanBundle;
}

export interface ConfirmPlanResponse {
  success: boolean;
  planId: string;
  saved?: boolean;
  message?: string;
}

export type MachineState =
  | "IDLE"
  | "EXECUTING"
  | "RISK_DETECTED"
  | "REPLANNING"
  | "COMPLETED"
  | "CONFIRMED";

export interface PlanState {
  planId: string | null;
  version: number;
  cards: Card[];
  timeline: TimelineConfig;
  constraints: Constraints;
  planHistory: Card[][];
}

export type PlanAction =
  | { type: "SET_CARDS"; cards: Card[] }
  | { type: "SET_VERSION"; version: number }
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
  replanInsertedOrder: string[] | null;
  autoRiskEnabled: boolean;
  riskAutoConsumed: boolean;
}
