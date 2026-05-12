import { useMemo } from "react";
import type { MachineState, ReplanPhase } from "@/types/plan";
import { useMachine } from "@/context/MachineContext";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import { computeStatusSummary } from "@/utils/statusSummary";

function phaseLabel(machine: MachineState, replanPhase: ReplanPhase): string {
  if (machine === "REPLANNING" && replanPhase !== "idle") return "重新规划中";
  if (machine === "RISK_DETECTED") return "风险检测";
  if (machine === "EXECUTING") return "执行中";
  if (machine === "COMPLETED") return "已完成";
  return "就绪";
}

export function PlanSummaryStrip() {
  const { state: plan } = usePlan();
  const { state: machine } = useMachine();
  const { state: ui } = useUI();
  const c = plan.constraints;

  const s = useMemo(
    () =>
      computeStatusSummary({
        cards: plan.cards,
        constraints: c,
        machine,
        activeRisk: ui.activeRisk,
      }),
    [plan.cards, c, machine, ui.activeRisk],
  );

  const spentApprox = Math.round((c.budget * s.budget_used_percent) / 100);
  const riskDisplay =
    machine === "RISK_DETECTED" && ui.activeRisk
      ? ui.activeRisk.title
      : s.risk_badge_label;

  const optimized =
    plan.planHistory.length > 0
      ? "保持晚餐与返程时间稳定"
      : "—";

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-[11px] text-slate-300">
      <div>
        <span className="text-slate-500">预算 </span>
        <span className="font-semibold tabular-nums text-slate-100">
          ¥{spentApprox}
        </span>
        <span className="text-slate-500"> / ¥{c.budget}</span>
      </div>
      <div className="hidden h-4 w-px bg-slate-700 sm:block" />
      <div>
        <span className="text-slate-500">当前风险 </span>
        <span
          className={
            s.risk_tone === "warn" || s.risk_tone === "alert"
              ? "font-semibold text-amber-200"
              : "font-semibold text-emerald-200/90"
          }
        >
          {riskDisplay}
        </span>
      </div>
      <div className="hidden h-4 w-px bg-slate-700 md:block" />
      <div>
        <span className="text-slate-500">预计完成 </span>
        <span className="font-medium tabular-nums text-slate-100">
          {c.time_end}
        </span>
      </div>
      <div className="hidden h-4 w-px bg-slate-700 lg:block" />
      <div>
        <span className="text-slate-500">当前阶段 </span>
        <span className="font-medium text-slate-100">
          {phaseLabel(machine, ui.replanPhase)}
        </span>
      </div>
      <div className="hidden h-4 w-px bg-slate-700 lg:block" />
      <div className="min-w-[10rem]">
        <span className="text-slate-500">已优化 </span>
        <span className="text-slate-200">{optimized}</span>
      </div>
    </div>
  );
}
