import { motion } from "framer-motion";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";

export function MissionInputCard() {
  const { state: plan } = usePlan();
  const { dispatch: uiDispatch } = useUI();
  const c = plan.constraints;
  const tags = c.preference_tags.length > 0 ? c.preference_tags : ["上海", "周末", "地铁方便"];

  const appendLog = (message: string) => {
    uiDispatch({ type: "APPEND_LOG", message });
  };

  const summaries = [
    ["出发地", c.departure],
    ["时间", `${c.time_start} - ${c.time_end}`],
    ["同行", `${c.adults} 位成人 · ${c.children} 位儿童`],
    ["预算", `¥${c.budget}`],
  ];

  return (
    <section className="rounded-[1.55rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] p-4 shadow-[0_10px_26px_rgba(120,80,40,0.055)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#8A5A2F]">上海周末路线</p>
          <p className="mt-1 text-[11px] leading-5 text-[#A08C7C]">
            已按真实地点、天气和路线时间生成
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#B7C9A8]/45 bg-[#EFF5E9] px-2.5 py-1 text-[10px] font-semibold text-[#526849]">
          MVP
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[17px] font-bold leading-snug text-[#3C342F]">
          {c.goal}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6E6259]">
          {tags.slice(0, 4).join(" · ")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.slice(0, 8).map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className={
              index === 0
                ? "rounded-full bg-[#EFF5E9] px-2.5 py-1 text-[10px] font-medium text-[#526849]"
                : "rounded-full bg-[#F7EEDF]/68 px-2.5 py-1 text-[10px] font-medium text-[#6E6259]"
            }
          >
            {tag}
          </span>
        ))}
      </div>

      <dl className="mt-3 divide-y divide-[rgba(120,90,60,0.08)] rounded-[1.15rem] bg-[#FFF9F2]/46 px-3 py-1.5 text-[12px]">
        {summaries.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-1.5">
            <dt className="shrink-0 text-[#9A8575]">{label}</dt>
            <dd className="text-right font-semibold tabular-nums text-[#3C342F]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="rounded-full border border-[#F2A65A]/22 bg-[#FFF4DE]/60 px-3.5 py-1.5 text-[11px] font-semibold text-[#7A5527] transition hover:bg-[#FFF1D4]"
          onClick={() => appendLog("已收到重新生成请求，下一版会重新调用上海路线规划。")}
        >
          重新生成
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="rounded-full border border-[rgba(120,90,60,0.12)] bg-white/58 px-3.5 py-1.5 text-[11px] font-semibold text-[#6E6259] transition hover:bg-white"
          onClick={() => appendLog("已记录：优先保留轻松节奏、地铁方便和预算可控。")}
        >
          换个思路
        </motion.button>
      </div>
    </section>
  );
}
