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
import { demoTriggerFromRiskType, mergeLocalReplanSegment } from "@/mock/localReplan";
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

    const active = initialPlan.cards.find((c) => c.status === "active");
    const focusId =
      active?.card_id ?? initialPlan.cards[0]?.card_id ?? "c2";

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
          message: "风险触发被跳过：REPLANNING 中不接受新的 Trigger。",
        });
        return;
      }

      if (m !== "EXECUTING") {
        uiDispatch({
          type: "APPEND_LOG",
          message: "风险触发被跳过：当前不在 EXECUTING（演示控场）。",
        });
        return;
      }
      if (u.activeRisk) {
        uiDispatch({
          type: "APPEND_LOG",
          message: "风险触发被跳过：已存在未处理风险。",
        });
        return;
      }

      const affected = resolveAffectedCardIds(p.cards, trigger);
      if (affected.length === 0) {
        uiDispatch({
          type: "APPEND_LOG",
          message: "风险触发失败：未找到可标记的活动/缓冲片段。",
        });
        return;
      }

      const signal = createRiskSignalForDemoTrigger(trigger, affected);
      const snapshot: Record<string, (typeof p.cards)[number]["status"]> = {};
      for (const id of affected) {
        const c = p.cards.find((x) => x.card_id === id);
        if (c) snapshot[id] = c.status;
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
        message: `风险已触发：${signal.title}`,
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
    uiDispatch({ type: "APPEND_LOG", message: "用户选择：忽略风险建议。" });
  }, [cancelActiveReplan, planDispatch, send, uiDispatch]);

  const acceptRiskSuggestion = useCallback(() => {
    const risk = uiRef.current.activeRisk;
    if (!risk) return;

    if (machineRef.current === "REPLANNING") {
      uiDispatch({
        type: "APPEND_LOG",
        message: "接受建议被跳过：Replan 进行中（避免重复触发）。",
      });
      return;
    }

    if (machineRef.current !== "RISK_DETECTED") return;
    if (uiRef.current.replanPhase !== "idle") return;

    if (replanLockRef.current) {
      uiDispatch({
        type: "APPEND_LOG",
        message: "接受建议被跳过：Replan 流程已在启动中。",
      });
      return;
    }

    const trig = demoTriggerFromRiskType(risk.type);
    if (!trig) {
      uiDispatch({
        type: "APPEND_LOG",
        message: "局部替换失败：当前风险类型未配置替换片段。",
      });
      return;
    }

    const next = mergeLocalReplanSegment(planRef.current.cards, trig);
    if (!next) {
      uiDispatch({
        type: "APPEND_LOG",
        message: "局部替换失败：时间窗无法容纳替换片段。",
      });
      return;
    }

    cancelReplanRef.current?.();
    cancelReplanRef.current = null;

    replanLockRef.current = true;

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
      message: "用户选择：接受建议（进入 Replan 动画流程）。",
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
