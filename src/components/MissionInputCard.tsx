import { motion } from "framer-motion";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";

const TAGS = ["户外", "亲子友好", "地铁可达", "预算可控"];

export function MissionInputCard() {
  const { state: plan } = usePlan();
  const { dispatch: uiDispatch } = useUI();
  const c = plan.constraints;

  const appendLog = (message: string) => {
    uiDispatch({ type: "APPEND_LOG", message });
  };

  const summaries = [
    ["出发地", c.departure],
    ["时间", `${c.time_start} - ${c.time_end}`],
    ["同行", `${c.adults} 位成人 · ${c.children} 位 ${c.children_age} 岁儿童`],
    ["预算", `¥${c.budget}`],
  ];

  return (
    <section className="rounded-[1.55rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] p-4 shadow-[0_10px_26px_rgba(120,80,40,0.055)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#8A5A2F]">我的周末愿望</p>
          <p className="mt-1 text-[11px] leading-5 text-[#A08C7C]">
            AI 已帮你记住这些偏好
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-[#B7C9A8]/45 bg-[#EFF5E9] px-2.5 py-1 text-[10px] font-semibold text-[#526849]">
          已记住偏好
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[17px] font-bold leading-snug text-[#3C342F]">
          周末下午带孩子出去玩
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#6E6259]">
          户外 + 亲子 + 可控预算
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TAGS.map((tag, index) => (
          <span
            key={tag}
            className={
              index === 1
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
          onClick={() => appendLog("已重新生成一版更轻松的周末安排。")}
        >
          重新生成
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          className="rounded-full border border-[rgba(120,90,60,0.12)] bg-white/58 px-3.5 py-1.5 text-[11px] font-semibold text-[#6E6259] transition hover:bg-white"
          onClick={() => appendLog("已换个思路，优先保留轻松节奏和少排队。")}
        >
          换个思路
        </motion.button>
      </div>
    </section>
  );
}
