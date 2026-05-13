import { useCallback, useEffect, useRef } from "react";
import { useMachine } from "@/context/MachineContext";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import { initialPlan } from "@/mock";
import {
  agentMessageForRisk,
  createRiskSignalForDemoTrigger,
  type DemoRiskTrigger,
  resolveAffectedCardIds,
  RISK_AUTO_DELAY_MS,
} from "@/mock/riskPresets";
import { replanPlan } from "@/services/api";
import { startReplanFlow } from "@/replan/startReplanFlow";

export function useDashboardRiskActions(): {
  triggerDemoRisk: (
    trigger: DemoRiskTrigger,
    options?: { markAutoConsumed?: boolean },
  ) => void;
  acceptRiskSuggestion: () => void;
  ignoreRisk: () => void;
  resetDemo: () => void;
  riskAutoDelayMs: number;
} {
  const { state: planState, dispatch: planDispatch } = usePlan();
  const { state: machine, send } = useMachine();
  const { state: ui, dispatch: uiDispatch } = useUI();

  const planRef = useRef(planState);
  planRef.current = planState;
  const machineRef = useRef(machine);
  machineRef.current = machine;
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const cancelReplanRef = useRef<(() => void) | null>(null);
  const replanLockRef = useRef(false);

  const releaseReplanLock = useCallback(() => {
    replanLockRef.current = false;
  }, []);

  const cancelActiveReplan = useCallback(() => {
    cancelReplanRef.current?.();
    cancelReplanRef.current = null;
    releaseReplanLock();
  }, [releaseReplanLock]);

  useEffect(() => {
    return () => {
      cancelActiveReplan();
    };
  }, [cancelActiveReplan]);

  const resetDemo = useCallback(() => {
    cancelActiveReplan();

    send({ type: "DEMO_RESET" });
    planDispatch({
      type: "RESET_PLAN_DEMO",
      cards: structuredClone(initialPlan.cards),
    });

    const active = initialPlan.cards.find((card) => card.status === "active");
    const focusId = active?.card_id ?? initialPlan.cards[0]?.card_id ?? "c2";

    uiDispatch({ type: "DEMO_RESET", focusedCardId: focusId });
  }, [cancelActiveReplan, planDispatch, send, uiDispatch]);

  const triggerDemoRisk = useCallback(
    (trigger: DemoRiskTrigger, options?: { markAutoConsumed?: boolean }) => {
      const p = planRef.current;
      const m = machineRef.current;
      const u = uiRef.current;

      if (m === "REPLANNING") {
        uiDispatch({
          type: "APPEND_LOG",
          message: "正在调整中，先等这次安排完成后再处理新的变化。",
        });
        return;
      }

      if (m !== "EXECUTING") {
        uiDispatch({
          type: "APPEND_LOG",
          message: "当前安排还没开始执行，暂时不用处理新的变化。",
        });
        return;
      }
      if (u.activeRisk) {
        uiDispatch({
          type: "APPEND_LOG",
          message: "已有一个变化待处理，先确认是否调整当前方案。",
        });
        return;
      }

      const affected = resolveAffectedCardIds(p.cards, trigger);
      if (affected.length === 0) {
        uiDispatch({
          type: "APPEND_LOG",
          message: "暂时没有找到需要调整的活动节点。",
        });
        return;
      }

      const signal = createRiskSignalForDemoTrigger(trigger, affected);
      const snapshot: Record<string, (typeof p.cards)[number]["status"]> = {};
      for (const id of affected) {
        const card = p.cards.find((item) => item.card_id === id);
        if (card) snapshot[id] = card.status;
      }

      planDispatch({
        type: "APPLY_CARD_PATCHES",
        patches: affected.map((card_id) => ({
          card_id,
          patch: { status: "risk" as const },
        })),
      });

      uiDispatch({
        type: "OPEN_RISK",
        risk: signal,
        snapshot,
        agentMessage: agentMessageForRisk(signal),
      });
      send({ type: "RISK_DETECTED" });

      uiDispatch({
        type: "APPEND_LOG",
        message:
          signal.type === "queue"
            ? "发现儿童乐园排队变长，可能影响后续安排。"
            : `发现新变化：${signal.title}。`,
      });

      if (options?.markAutoConsumed) {
        uiDispatch({ type: "MARK_AUTO_RISK_CONSUMED" });
      }
    },
    [planDispatch, send, uiDispatch],
  );

  const ignoreRisk = useCallback(() => {
    cancelActiveReplan();

    const snap = uiRef.current.riskStatusSnapshot;
    if (!snap) return;

    const patches = Object.entries(snap).map(([card_id, status]) => ({
      card_id,
      patch: { status },
    }));
    planDispatch({ type: "APPLY_CARD_PATCHES", patches });
    uiDispatch({ type: "CLEAR_RISK_UI" });
    send({ type: "IGNORE_RISK" });
    uiDispatch({ type: "APPEND_LOG", message: "已暂不调整，继续按当前安排推进。" });
  }, [cancelActiveReplan, planDispatch, send, uiDispatch]);

  const acceptRiskSuggestion = useCallback(async () => {
    const risk = uiRef.current.activeRisk;
    if (!risk) return;

    if (machineRef.current === "REPLANNING") {
      uiDispatch({
        type: "APPEND_LOG",
        message: "方案正在调整中，稍等片刻就能看到新路线。",
      });
      return;
    }

    if (machineRef.current !== "RISK_DETECTED") return;
    if (uiRef.current.replanPhase !== "idle") return;

    if (replanLockRef.current) {
      uiDispatch({
        type: "APPEND_LOG",
        message: "方案正在调整中，稍等片刻就能看到新路线。",
      });
      return;
    }

    cancelReplanRef.current?.();
    cancelReplanRef.current = null;
    replanLockRef.current = true;

    let next = planRef.current.cards;
    try {
      const result = await replanPlan({
        currentPlan: planRef.current.cards,
        riskSignal: risk,
        userAction: "accept",
      });
      next = result.cards;
    } catch (error) {
      releaseReplanLock();
      uiDispatch({
        type: "APPEND_LOG",
        message: "暂时无法生成新的替代路线，先保留当前安排。",
      });
      console.warn("Replan failed without fallback.", error);
      return;
    }

    if (next.length === 0) {
      releaseReplanLock();
      uiDispatch({
        type: "APPEND_LOG",
        message: "当前时间窗口较紧，暂时无法插入新的替代地点。",
      });
      return;
    }

    const inner = startReplanFlow({
      nextCards: next,
      risk,
      getPlanCards: () => planRef.current.cards,
      planDispatch,
      uiDispatch,
      send,
      onFlowComplete: releaseReplanLock,
    });

    cancelReplanRef.current = () => {
      inner();
      releaseReplanLock();
    };

    uiDispatch({
      type: "APPEND_LOG",
      message: "已按你的选择开始调整方案。",
    });
  }, [planDispatch, releaseReplanLock, send, uiDispatch]);

  return {
    triggerDemoRisk,
    acceptRiskSuggestion,
    ignoreRisk,
    resetDemo,
    riskAutoDelayMs: RISK_AUTO_DELAY_MS,
  };
}
