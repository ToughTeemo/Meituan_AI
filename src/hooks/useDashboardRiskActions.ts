import { useCallback, useEffect, useRef } from "react";
import { replanRisk, scanRisks, submitRequirement } from "@/api/plans";
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
import { startReplanFlow } from "@/replan/startReplanFlow";
import type { RiskKind } from "@/types/plan";

function riskKindForDemoTrigger(trigger: DemoRiskTrigger): RiskKind {
  if (trigger === "rain") return "weather";
  return trigger;
}

export function useDashboardRiskActions(): {
  triggerDemoRisk: (
    trigger: DemoRiskTrigger,
    options?: { markAutoConsumed?: boolean },
  ) => void;
  acceptRiskSuggestion: () => void;
  ignoreRisk: () => void;
  submitUserRequirement: (text: string) => void;
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

      const canReplacePendingRisk =
        m === "RISK_DETECTED" && u.activeRisk != null && u.replanPhase === "idle";

      if (m !== "EXECUTING" && !canReplacePendingRisk) {
        uiDispatch({
          type: "APPEND_LOG",
          message: "当前安排还没开始执行，暂时不用处理新的变化。",
        });
        return;
      }
      if (u.activeRisk && !canReplacePendingRisk) {
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

      const openRisk = (signal: ReturnType<typeof createRiskSignalForDemoTrigger>) => {
        const currentUi = uiRef.current;
        const isReplacingRisk =
          machineRef.current === "RISK_DETECTED" &&
          currentUi.activeRisk != null &&
          currentUi.replanPhase === "idle";

        if (machineRef.current !== "EXECUTING" && !isReplacingRisk) return;
        if (currentUi.activeRisk && !isReplacingRisk) return;

        const affectedIds = signal.affected_card_ids;
        const previousSnapshot = isReplacingRisk ? currentUi.riskStatusSnapshot : null;

        if (isReplacingRisk && previousSnapshot) {
          planDispatch({
            type: "APPLY_CARD_PATCHES",
            patches: Object.entries(previousSnapshot).map(([card_id, status]) => ({
              card_id,
              patch: { status },
            })),
          });
        }

        const snapshot: Record<string, (typeof p.cards)[number]["status"]> = {};
        for (const id of affectedIds) {
          const card = planRef.current.cards.find((item) => item.card_id === id);
          if (card) snapshot[id] = previousSnapshot?.[id] ?? card.status;
        }

        planDispatch({
          type: "APPLY_CARD_PATCHES",
          patches: affectedIds.map((card_id) => ({
            card_id,
            patch: { status: "risk" as const },
          })),
        });

        uiDispatch({
          type: "OPEN_RISK",
          risk: signal,
          snapshot,
          agentMessage: signal.suggestedAction ?? agentMessageForRisk(signal),
        });
        if (machineRef.current !== "RISK_DETECTED") {
          send({ type: "RISK_DETECTED" });
        }

        uiDispatch({
          type: "APPEND_LOG",
          message:
            signal.suggestedAction ??
            (signal.type === "queue"
              ? "发现儿童乐园排队变长，可能影响后续安排。"
              : `发现新变化：${signal.title}。`),
        });

        if (options?.markAutoConsumed) {
          uiDispatch({ type: "MARK_AUTO_RISK_CONSUMED" });
        }
      };

      if (p.planId) {
        const riskType = riskKindForDemoTrigger(trigger);
        uiDispatch({
          type: "APPEND_LOG",
          message: "正在向后端检查实时变化。",
        });

        void scanRisks({
          planId: p.planId,
          cards: p.cards,
          riskTypes: [riskType],
        })
          .then((response) => {
            const risk = response.risks[0];
            if (!risk) {
              uiDispatch({
                type: "APPEND_LOG",
                message:
                  response.agent_logs[0]?.message ||
                  response.summary ||
                  "后端暂未发现需要调整的风险。",
              });
              return;
            }
            openRisk(risk);
          })
          .catch((error) => {
            console.warn("Risk scan failed without fallback.", error);
            openRisk(createRiskSignalForDemoTrigger(trigger, affected));
          });
        return;
      }

      const signal = createRiskSignalForDemoTrigger(trigger, affected);
      openRisk(signal);
    },
    [planDispatch, send, uiDispatch],
  );

  const submitUserRequirement = useCallback(
    (text: string) => {
      const next = text.trim();
      if (!next) {
        uiDispatch({
          type: "APPEND_LOG",
          message: "可以直接告诉我新的想法或新的情况，我会帮你微调安排。",
        });
        return;
      }

      const p = planRef.current;
      if (!p.planId) {
        uiDispatch({
          type: "APPEND_LOG",
          message: `收到：${next}。我会按这个偏好继续微调安排。`,
        });
        return;
      }

      uiDispatch({ type: "APPEND_LOG", message: "正在理解你的新要求。" });
      void submitRequirement({
        planId: p.planId,
        text: next,
        cards: p.cards,
      })
        .then((response) => {
          const risk = response.risk;
          if (!risk) {
            uiDispatch({ type: "APPEND_LOG", message: response.message });
            return;
          }

          const currentUi = uiRef.current;
          const isReplacingRisk =
            machineRef.current === "RISK_DETECTED" &&
            currentUi.activeRisk != null &&
            currentUi.replanPhase === "idle";

          if (machineRef.current !== "EXECUTING" && !isReplacingRisk) {
            uiDispatch({
              type: "APPEND_LOG",
              message: response.message,
            });
            return;
          }

          if (currentUi.activeRisk && !isReplacingRisk) {
            uiDispatch({
              type: "APPEND_LOG",
              message: response.message,
            });
            return;
          }

          const previousSnapshot = isReplacingRisk ? currentUi.riskStatusSnapshot : null;

          if (isReplacingRisk && previousSnapshot) {
            planDispatch({
              type: "APPLY_CARD_PATCHES",
              patches: Object.entries(previousSnapshot).map(([card_id, status]) => ({
                card_id,
                patch: { status },
              })),
            });
          }

          const snapshot: Record<string, (typeof p.cards)[number]["status"]> = {};
          for (const id of risk.affected_card_ids) {
            const card = planRef.current.cards.find((item) => item.card_id === id);
            if (card) snapshot[id] = previousSnapshot?.[id] ?? card.status;
          }

          planDispatch({
            type: "APPLY_CARD_PATCHES",
            patches: risk.affected_card_ids.map((card_id) => ({
              card_id,
              patch: { status: "risk" as const },
            })),
          });
          uiDispatch({
            type: "OPEN_RISK",
            risk,
            snapshot,
            agentMessage: response.message,
          });
          if (machineRef.current !== "RISK_DETECTED") {
            send({ type: "RISK_DETECTED" });
          }
          uiDispatch({ type: "APPEND_LOG", message: response.message });
        })
        .catch((error) => {
          console.warn("Requirement submit failed without fallback.", error);
          uiDispatch({
            type: "APPEND_LOG",
            message: `收到：${next}。我会按这个偏好继续微调安排。`,
          });
        });
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

    if (risk.requiresUserConfirm !== true) {
      ignoreRisk();
      return;
    }

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

    const p = planRef.current;
    let next = p.cards;
    let nextVersion: number | null = null;
    try {
      const result = await replanRisk({
        planId: p.planId ?? "mock_plan_local",
        riskId: risk.risk_id,
        risk,
        version: p.version,
        cards: p.cards,
      });
      next = result.updated_plan?.cards ?? result.cards;
      nextVersion = result.updated_plan?.version ?? result.version;
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
      onFlowComplete: () => {
        if (nextVersion !== null) {
          planDispatch({ type: "SET_VERSION", version: nextVersion });
        }
        releaseReplanLock();
      },
    });

    cancelReplanRef.current = () => {
      inner();
      releaseReplanLock();
    };

    uiDispatch({
      type: "APPEND_LOG",
      message: "已按你的选择开始调整方案。",
    });
  }, [ignoreRisk, planDispatch, releaseReplanLock, send, uiDispatch]);

  return {
    triggerDemoRisk,
    acceptRiskSuggestion,
    ignoreRisk,
    submitUserRequirement,
    resetDemo,
    riskAutoDelayMs: RISK_AUTO_DELAY_MS,
  };
}
