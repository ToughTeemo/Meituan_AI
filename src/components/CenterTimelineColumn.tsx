import { AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import type { MachineState, ReplanPhase } from "@/types/plan";
import { useMachine } from "@/context/MachineContext";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import { computeStatusSummary } from "@/utils/statusSummary";
import { AgentLogBar } from "@/components/AgentLogBar";
import { RiskWarningBar } from "@/components/RiskWarningBar";
import { VerticalTimelinePanel } from "@/components/VerticalTimelinePanel";

function phaseLabel(machine: MachineState, replanPhase: ReplanPhase): string {
  if (machine === "REPLANNING" && replanPhase !== "idle") return "重新规划中";
  if (machine === "RISK_DETECTED") return "风险检测中";
  if (machine === "EXECUTING") return "执行中";
  if (machine === "COMPLETED") return "已完成";
  return "就绪";
}

export function CenterTimelineColumn() {
  const { state: plan } = usePlan();
  const { state: machine } = useMachine();
  const { state: ui } = useUI();

  const showRiskBar = machine === "RISK_DETECTED" && ui.activeRisk != null;

  const s = useMemo(
    () =>
      computeStatusSummary({
        cards: plan.cards,
        constraints: plan.constraints,
        machine,
        activeRisk: ui.activeRisk,
      }),
    [plan.cards, plan.constraints, machine, ui.activeRisk],
  );

  const riskLine =
    machine === "RISK_DETECTED" && ui.activeRisk
      ? ui.activeRisk.title
      : s.risk_badge_label;

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <header className="shrink-0 border-b border-slate-800 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          行程时间轴
        </p>
        <p className="text-sm text-slate-300">
          按时间从上到下，点击卡片查看详情
        </p>
      </header>

      <div className="shrink-0 border-b border-slate-800/80 px-4 py-2 text-[11px] text-slate-400">
        <span className="text-slate-500">当前阶段 </span>
        <span className="font-medium text-slate-200">
          {phaseLabel(machine, ui.replanPhase)}
        </span>
        <span className="mx-2 text-slate-600">·</span>
        <span className="text-slate-500">当前风险 </span>
        <span
          className={
            s.risk_tone === "warn" || s.risk_tone === "alert"
              ? "font-medium text-amber-200"
              : "font-medium text-emerald-200/90"
          }
        >
          {riskLine}
        </span>
      </div>

      <div className="shrink-0 px-4 pb-2 pt-2">
        <AnimatePresence initial={false}>
          {showRiskBar && ui.activeRisk ? (
            <RiskWarningBar key={ui.activeRisk.risk_id} risk={ui.activeRisk} />
          ) : null}
        </AnimatePresence>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <VerticalTimelinePanel />
      </div>

      <AgentLogBar entries={ui.agentLogs} />
    </div>
  );
}
