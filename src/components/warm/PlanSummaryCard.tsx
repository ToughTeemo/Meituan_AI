import { motion } from "framer-motion";

const METRICS = ["¥480 / ¥500", "6小时", "20:00前到家"] as const;
const TAGS = ["亲子友好", "预算内", "排队少", "轻松节奏"] as const;

export function PlanSummaryCard() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative max-h-[170px] overflow-hidden rounded-[1.55rem] border border-[rgba(120,90,60,0.10)] bg-[linear-gradient(135deg,#FFFDF9_0%,#FFF6E4_64%,#F8F2E8_100%)] px-4 py-3.5 shadow-[0_10px_28px_rgba(120,80,40,0.07)]"
    >
      <div className="absolute -right-10 -top-16 h-32 w-32 rounded-full bg-[#F6C65B]/20 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#8A5A2F]">
            AI 为你整理好的主方案
          </p>
          <h2 className="mt-1 text-[22px] font-bold leading-tight text-[#3C342F]">
            轻松亲子半日游
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[#6E6259]">
            少换乘、少等待，适合带孩子轻松玩半天。
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {METRICS.map((metric) => (
              <span
                key={metric}
                className="rounded-full bg-white/68 px-2.5 py-1 text-[12px] font-bold text-[#3C342F]"
              >
                {metric}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden max-w-[150px] shrink-0 flex-wrap justify-end gap-1.5 md:flex">
          {TAGS.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[rgba(120,90,60,0.08)] bg-white/56 px-2.5 py-1 text-[10px] font-medium text-[#6E6259]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="relative mt-2 flex flex-wrap gap-1.5 md:hidden">
        {TAGS.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white/56 px-2.5 py-1 text-[10px] font-medium text-[#6E6259]"
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.section>
  );
}
