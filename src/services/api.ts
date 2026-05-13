import { API_MODE, USE_MOCK_FALLBACK } from "@/services/config";
import { request } from "@/services/request";
import { constraints } from "@/mock/constraints";
import { initialPlan } from "@/mock/initialPlan";
import { replanResult } from "@/mock/replanResult";
import {
  createQueueRiskSignal,
  resolveAffectedCardIds,
} from "@/mock/riskPresets";
import {
  demoTriggerFromRiskType,
  mergeLocalReplanSegment,
} from "@/mock/localReplan";
import type { Card, Constraints, PlanBundle, POI, RiskSignal } from "@/types/plan";

export type ParsedGoal = Constraints & {
  userInput: string;
};

export interface ReplanParams {
  currentPlan: PlanBundle | Card[];
  riskSignal: RiskSignal;
  userAction: string;
}

export interface PoiSearchParams {
  keyword?: string;
  category?: string;
  near?: string;
  limit?: number;
}

export interface ConfirmPlanResult {
  success: boolean;
}

let fallbackUsedInLastFlow = false;

export function resetApiFallbackFlag(): void {
  fallbackUsedInLastFlow = false;
}

export function wasApiFallbackUsed(): boolean {
  return fallbackUsedInLastFlow;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function shouldUseLocalData(): boolean {
  return API_MODE === "mock" || API_MODE === "demo";
}

async function withFallback<T>(
  apiCall: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  if (shouldUseLocalData()) return Promise.resolve(fallback());

  try {
    return await apiCall();
  } catch (error) {
    if (!USE_MOCK_FALLBACK) throw error;
    fallbackUsedInLastFlow = true;
    console.warn("API failed, using mock fallback", error);
    return fallback();
  }
}

function extractPoiList(plan: PlanBundle): POI[] {
  const poiMap = new Map<string, POI>();

  plan.cards.forEach((card) => {
    if (card.poi) poiMap.set(card.poi.poi_id, card.poi);
    card.alternatives?.forEach((poi) => poiMap.set(poi.poi_id, poi));
  });

  return Array.from(poiMap.values());
}

function filterPoiList(params: PoiSearchParams): POI[] {
  const keyword = params.keyword?.trim().toLowerCase();
  const category = params.category?.trim().toLowerCase();

  return extractPoiList(initialPlan)
    .filter((poi) => {
      if (keyword && !poi.name.toLowerCase().includes(keyword)) return false;
      if (category && !poi.category.toLowerCase().includes(category)) return false;
      return true;
    })
    .slice(0, params.limit ?? 10);
}

function planCards(plan: PlanBundle | Card[]): Card[] {
  return Array.isArray(plan) ? plan : plan.cards;
}

export async function parseGoal(userInput: string): Promise<ParsedGoal> {
  return withFallback(
    () =>
      request<ParsedGoal>("/api/parse-goal", {
        method: "POST",
        body: { userInput },
      }),
    () => ({
      ...clone(constraints),
      goal: userInput.trim() || constraints.goal,
      userInput,
    }),
  );
}

export async function generatePlan(
  nextConstraints: Constraints,
): Promise<PlanBundle> {
  return withFallback(
    () =>
      request<PlanBundle>("/api/generate-plan", {
        method: "POST",
        body: nextConstraints,
      }),
    () => clone(initialPlan),
  );
}

export async function replanPlan(
  params: ReplanParams,
): Promise<{ cards: Card[] }> {
  return withFallback(
    () =>
      request<{ cards: Card[] }>("/api/replan", {
        method: "POST",
        body: params,
      }),
    () => {
      const trigger = demoTriggerFromRiskType(params.riskSignal.type);
      const mergedCards = trigger
        ? mergeLocalReplanSegment(planCards(params.currentPlan), trigger)
        : null;

      return {
        cards: clone(mergedCards ?? replanResult.cards),
      };
    },
  );
}

export async function searchPoi(params: PoiSearchParams = {}): Promise<POI[]> {
  return withFallback(
    () =>
      request<POI[]>("/api/poi/search", {
        method: "GET",
        query: { ...params },
      }),
    () => clone(filterPoiList(params)),
  );
}

export async function checkRisk(plan: PlanBundle): Promise<RiskSignal[]> {
  return withFallback(
    () =>
      request<RiskSignal[]>("/api/risk/check", {
        method: "GET",
        query: { card_count: plan.cards.length },
      }),
    () => {
      const affected = resolveAffectedCardIds(plan.cards, "queue");
      if (affected.length === 0) return [];
      return [createQueueRiskSignal(affected)];
    },
  );
}

export async function confirmPlan(
  plan: PlanBundle,
): Promise<ConfirmPlanResult> {
  return withFallback(
    () =>
      request<ConfirmPlanResult>("/api/confirm", {
        method: "POST",
        body: { plan },
      }),
    () => ({ success: true }),
  );
}
