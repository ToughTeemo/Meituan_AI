import { usePlan } from "@/context/PlanContext";

/** 原左栏约束的轻量版：置于右侧地图区下方，不占主时间轴宽度 */
export function PlanContextCard() {
  const { state: plan } = usePlan();
  const c = plan.constraints;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-300">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        计划上下文
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
        <dt className="text-slate-500">时间窗口</dt>
        <dd className="text-right font-medium text-slate-100">
          {c.time_start} – {c.time_end}
        </dd>
        <dt className="text-slate-500">人员</dt>
        <dd className="text-right">
          成人 {c.adults} · 儿童 {c.children}（{c.children_age} 岁）
        </dd>
        <dt className="text-slate-500">出行方式</dt>
        <dd className="text-right">{c.transport_mode}</dd>
        <dt className="text-slate-500">节奏</dt>
        <dd className="text-right">{c.pace}</dd>
      </dl>
    </div>
  );
}
