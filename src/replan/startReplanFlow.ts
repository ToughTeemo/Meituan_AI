import type { Card, PlanAction, RiskSignal } from "@/types/plan";
import type { Dispatch } from "react";
import type { UIAction } from "@/context/uiReducer";
import type { MachineEvent } from "@/context/machineReducer";
import {
  REPLAN_GENERATING_LOG_MESSAGES,
  REPLAN_GENERATING_LOG_STEP_MS,
  REPLAN_NEW_BADGE_TTL_MS,
  REPLAN_POST_SUMMARY_HIDE_MS,
  REPLAN_POST_SUMMARY_MESSAGE,
  REPLAN_T_ANIMATING_END,
  REPLAN_T_DECONSTRUCTING_END,
  REPLAN_T_DONE_END,
  REPLAN_T_FREEZING_END,
  REPLAN_T_GENERATING_END,
} from "@/constants/replan";

export type PlanDispatch = Dispatch<PlanAction>;
export type UiDispatch = Dispatch<UIAction>;
export type MachineSend = (event: MachineEvent) => void;

function removeCardsByIds(cards: Card[], removeIds: Set<string>): Card[] {
  return cards.filter((c) => !removeIds.has(c.card_id));
}

function computeExitableIds(cards: Card[], risk: RiskSignal): Set<string> {
  const out = new Set<string>();
  for (const id of risk.affected_card_ids) {
    const c = cards.find((x) => x.card_id === id);
    if (c && c.status !== "done") out.add(id);
  }
  return out;
}

function computeInsertedOrder(intermediate: Card[], next: Card[]): string[] {
  const mids = new Set(intermediate.map((c) => c.card_id));
  return next
    .filter((c) => !mids.has(c.card_id))
    .sort((a, b) => a.start_minute - b.start_minute)
    .map((c) => c.card_id);
}

export function startReplanFlow(input: {
  nextCards: Card[];
  risk: RiskSignal;
  getPlanCards: () => Card[];
  planDispatch: PlanDispatch;
  uiDispatch: UiDispatch;
  send: MachineSend;
  onFlowComplete?: () => void;
}): () => void {
  const timers: number[] = [];
  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      const idx = timers.indexOf(id);
      if (idx !== -1) timers.splice(idx, 1);
      fn();
    }, ms);
    timers.push(id);
    return id;
  };

  const cancel = () => {
    for (const id of timers) window.clearTimeout(id);
    timers.length = 0;
  };

  const { nextCards, risk, getPlanCards, planDispatch, uiDispatch, send, onFlowComplete } =
    input;

  planDispatch({ type: "PUSH_HISTORY" });
  send({ type: "ACCEPT_REPLAN" });
  uiDispatch({ type: "SET_REPLAN_PHASE", phase: "freezing" });
  uiDispatch({ type: "CLEAR_AGENT_MESSAGE" });

  schedule(() => {
    uiDispatch({ type: "SET_REPLAN_PHASE", phase: "deconstructing" });
    const cards = getPlanCards();
    const exitable = computeExitableIds(cards, risk);
    planDispatch({
      type: "SET_CARDS",
      cards: removeCardsByIds(cards, exitable),
    });
  }, REPLAN_T_FREEZING_END);

  schedule(() => {
    uiDispatch({ type: "SET_REPLAN_PHASE", phase: "generating" });
    REPLAN_GENERATING_LOG_MESSAGES.forEach((message, idx) => {
      schedule(() => {
        uiDispatch({ type: "APPEND_LOG", message });
      }, idx * REPLAN_GENERATING_LOG_STEP_MS);
    });
  }, REPLAN_T_DECONSTRUCTING_END);

  schedule(() => {
    const intermediate = getPlanCards();
    const inserted = computeInsertedOrder(intermediate, nextCards);
    uiDispatch({ type: "SET_REPLAN_INSERTED_ORDER", ids: inserted });
    uiDispatch({ type: "SET_REPLAN_PHASE", phase: "animating" });
    planDispatch({ type: "SET_CARDS", cards: nextCards });
    const active = nextCards.find((c) => c.status === "active");
    if (active) uiDispatch({ type: "FOCUS_CARD", cardId: active.card_id });
  }, REPLAN_T_GENERATING_END);

  schedule(() => {
    uiDispatch({ type: "SET_REPLAN_PHASE", phase: "done" });
  }, REPLAN_T_ANIMATING_END);

  schedule(() => {
    send({ type: "REPLAN_DONE" });
    uiDispatch({
      type: "RESOLVE_REPLAN_COMPLETE",
      agentMessage: REPLAN_POST_SUMMARY_MESSAGE,
    });
    onFlowComplete?.();
  }, REPLAN_T_DONE_END);

  schedule(() => {
    uiDispatch({ type: "CLEAR_AGENT_MESSAGE" });
  }, REPLAN_T_DONE_END + REPLAN_POST_SUMMARY_HIDE_MS);

  schedule(() => {
    const cards = getPlanCards();
    const patches = cards
      .filter((c) => c.is_new === true)
      .map((c) => ({ card_id: c.card_id, patch: { is_new: false as const } }));
    if (patches.length > 0) {
      planDispatch({ type: "APPLY_CARD_PATCHES", patches });
    }
  }, REPLAN_T_GENERATING_END + REPLAN_NEW_BADGE_TTL_MS);

  return cancel;
}
