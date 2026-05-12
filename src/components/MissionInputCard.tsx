import { motion } from "framer-motion";
import type { MachineState, ReplanPhase } from "@/types/plan";
import { useMachine } from "@/context/MachineContext";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";

function missionStatusLabel(
  machine: MachineState,
  replanPhase: ReplanPhase,
): string {
  if (machine === "REPLANNING" && replanPhase !== "idle") {
    return "重新规划中";
  }
  if (machine === "RISK_DETECTED") return "风险检测中";
  if (machine === "EXECUTING") return "执行中";
  if (machine === "COMPLETED") return "已完成";
  return "就绪";
}

function splitGoal(goal: string): { title: string; subtitle: string | null } {
  const m = goal.match(/^(.+?)（([^）]+)）\s*$/);
  if (m) return { title: m[1].trim(), subtitle: m[2].trim() };
  return { title: goal, subtitle: null };
}

function missionTags(c: {
  preference_tags: string[];
  transport_mode: string;
  pace: string;
}): string[] {
  const tags: string[] = [];
  if (c.preference_tags.includes("户外")) tags.push("户外");
  if (c.preference_tags.includes("亲子")) tags.push("亲子");
  if (
    c.transport_mode.includes("地铁") ||
    c.preference_tags.some((t) => t.includes("地铁"))
  ) {
    tags.push("地铁可达");
  }
  tags.push("预算可控");
  tags.push(`${c.pace}节奏`);
  return tags;
}

export function MissionInputCard() {
  const { state: plan } = usePlan();
  const { state: machine } = useMachine();
  const { state: ui, dispatch: uiDispatch } = useUI();
  const c = plan.constraints;
  const tags = missionTags(c);
  const status = missionStatusLabel(machine, ui.replanPhase);
  const { title: goalTitle, subtitle: goalSubtitle } = splitGoal(c.goal);

  const mockAction = (msg: string) => {
    uiDispatch({ type: "APPEND_LOG", message: msg });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 shadow-inner">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          当前任务
        </p>
        <span className="shrink-0 rounded-full border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-200">
          {status}
        </span>
      </div>

      <p className="mt-2 text-base font-semibold leading-snug text-slate-50">
        {goalTitle}
      </p>
      {goalSubtitle ? (
        <p className="mt-1 text-[12px] leading-snug text-slate-400">
          {goalSubtitle}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-sky-900/45 bg-sky-950/35 px-2 py-0.5 text-[11px] text-sky-100/95"
          >
            {tag}
          </span>
        ))}
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-slate-800/80 pt-3 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">出发地</dt>
          <dd className="text-right font-medium text-slate-200">{c.departure}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">时间</dt>
          <dd className="text-right tabular-nums text-slate-200">
            {c.time_start} – {c.time_end}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">成员</dt>
          <dd className="text-right text-slate-200">
            成人 {c.adults}，儿童 {c.children}（{c.children_age} 岁）
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">预算</dt>
          <dd className="text-right font-medium tabular-nums text-slate-200">
            ¥{c.budget}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-slate-100 hover:bg-slate-800"
          onClick={() =>
            mockAction("（演示）生成新计划：当前为本地 Mock 方案。")
          }
        >
          生成新计划
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-[12px] font-semibold text-slate-200 hover:bg-slate-900"
          onClick={() =>
            mockAction("（演示）重新生成：未接 LLM，仍展示当前方案。")
          }
        >
          重新生成
        </motion.button>
      </div>
    </div>
  );
}
