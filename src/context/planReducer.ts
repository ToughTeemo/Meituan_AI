import type { Card, PlanAction, PlanState } from "@/types/plan";

export function createInitialPlanState(
  cards: Card[],
  timeline: PlanState["timeline"],
  constraints: PlanState["constraints"],
  planId: string | null = null,
  version = 1,
): PlanState {
  return {
    planId,
    version,
    cards,
    timeline,
    constraints,
    planHistory: [],
  };
}

export function planReducer(state: PlanState, action: PlanAction): PlanState {
  switch (action.type) {
    case "SET_CARDS":
      return { ...state, cards: action.cards };
    case "SET_VERSION":
      return { ...state, version: action.version };
    case "PUSH_HISTORY":
      return {
        ...state,
        planHistory: [...state.planHistory, state.cards],
      };
    case "APPLY_CARD_PATCHES": {
      const map = new Map(
        action.patches.map((p) => [p.card_id, p.patch] as const),
      );
      const cards = state.cards.map((c) => {
        const patch = map.get(c.card_id);
        return patch ? { ...c, ...patch } : c;
      });
      return { ...state, cards };
    }
    case "RESET_PLAN_DEMO":
      return {
        ...state,
        planId: null,
        version: 1,
        cards: action.cards,
        planHistory: [],
      };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
