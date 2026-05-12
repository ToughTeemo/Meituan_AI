import { useMemo } from "react";
import type { MachineState, ReplanPhase, RiskSignal } from "@/types/plan";
import { useMachine } from "@/context/MachineContext";
import { useUI } from "@/context/UIContext";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";
import { AgentLogBar } from "@/components/AgentLogBar";
import { VerticalTimelinePanel } from "@/components/VerticalTimelinePanel";
import { PlanSummaryCard } from "@/components/warm/PlanSummaryCard";

function assistantStatusText(
  machine: MachineState,
  replanPhase: ReplanPhase,
  risk: RiskSignal | null,
): string {
  if (machine === "REPLANNING" && replanPhase !== "idle") {
    return "正在帮你重新调整安排，尽量保留晚餐和返程时间。";
  }

  if (machine === "RISK_DETECTED" && risk) {
    if (risk.type === "queue") {
      return "我发现儿童乐园排队变长了，预计等待 55 分钟，可能影响后续晚餐和返程。";
    }
    if (risk.type === "weather") {
      return "我发现天气有变化，户外活动可能不太舒服，可以切到室内备选。";
    }
    if (risk.type === "fatigue") {
      return "我发现孩子可能有点累了，可以插入休息点，让后半程更轻松。";
    }
    return risk.description;
  }

  return "已根据排队变化调整方案，保留晚餐和 20:00 前返程。";
}

interface CenterTimelineColumnProps {
  onConfirm: () => void;
}

export function CenterTimelineColumn({ onConfirm }: CenterTimelineColumnProps) {
  const { state: machine } = useMachine();
  const { state: ui } = useUI();
  const { acceptRiskSuggestion, ignoreRisk } = useDashboardRiskActions();

  const isRisk = machine === "RISK_DETECTED" && ui.activeRisk != null;
  const isReplanning = machine === "REPLANNING" && ui.replanPhase !== "idle";
  const statusText = useMemo(
    () => assistantStatusText(machine, ui.replanPhase, ui.activeRisk),
    [machine, ui.activeRisk, ui.replanPhase],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FFFDF9]/72">
      <header className="flex h-[82px] shrink-0 items-center justify-between gap-4 border-b border-[rgba(120,90,60,0.08)] px-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-normal text-[#3C342F]">
            今日安排提案
          </h1>
          <p className="mt-1 truncate text-sm text-[#6E6259]">
            我已经帮你把时间、预算、排队和返程都考虑好了
          </p>
        </div>
        <div className="shrink-0 text-right">
          <button
            type="button"
            disabled={isReplanning}
            onClick={isReplanning ? undefined : onConfirm}
            className={
              isReplanning
                ? "rounded-full border border-[#F2A65A]/18 bg-[#FFF4DE] px-4 py-2 text-sm font-bold text-[#8A7666]"
                : "rounded-full bg-[#F2A65A] px-4 py-2 text-sm font-bold text-[#3C342F] shadow-[0_8px_20px_rgba(242,166,90,0.22)] hover:bg-[#F6C65B]"
            }
          >
            {isReplanning ? "调整中" : "确认安排"}
          </button>
          {isRisk ? (
            <p className="mt-1 text-[10px] text-[#9A8575]">还有 1 个变化待确认</p>
          ) : null}
        </div>
      </header>

      <div className="shrink-0 space-y-3 border-b border-[rgba(120,90,60,0.08)] px-6 py-3">
        <PlanSummaryCard />
        <div
          className={
            isRisk
              ? "flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-[#EE8F6A]/25 bg-[#FFF1E9] px-4 py-3 text-sm leading-6 text-[#7A5527]"
              : isReplanning
                ? "flex min-h-14 items-center rounded-[1.25rem] border border-[#F2A65A]/20 bg-[#FFF4DE] px-4 py-3 text-sm leading-6 text-[#7A5527]"
                : "flex min-h-14 items-center rounded-[1.25rem] border border-[#B7C9A8]/24 bg-[#F3F7EE]/72 px-4 py-3 text-sm leading-6 text-[#526849]"
          }
        >
          <div className="min-w-0 flex-1">
            <p>{statusText}</p>
            {!isRisk && !isReplanning ? (
              <p className="mt-0.5 text-[11px] leading-5 text-[#8A7666]">
                已参考你的偏好：少排队、别走太远、预算内。
              </p>
            ) : null}
          </div>
          {isRisk ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={acceptRiskSuggestion}
                className="rounded-full bg-[#F2A65A] px-3 py-1.5 text-[11px] font-bold text-[#3C342F] hover:bg-[#F6C65B]"
              >
                按这个调整
              </button>
              <button
                type="button"
                onClick={ignoreRisk}
                className="rounded-full border border-[#EE8F6A]/35 bg-white/55 px-3 py-1.5 text-[11px] font-bold text-[#8A5A2F]"
              >
                暂不调整
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <VerticalTimelinePanel />
      </div>

      <AgentLogBar entries={ui.agentLogs} />
    </div>
  );
}
