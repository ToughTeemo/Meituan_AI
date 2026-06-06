import { motion } from "framer-motion";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";
import type { RiskSignal } from "@/types/plan";

interface RiskWarningBarProps {
  risk: RiskSignal;
}

export function RiskWarningBar({ risk }: RiskWarningBarProps) {
  const { acceptRiskSuggestion, ignoreRisk } = useDashboardRiskActions();
  const canAdjustRisk = risk.requiresUserConfirm === true;
  const title =
    risk.type === "queue" ? "发现一点小变化：排队变长了" : `发现一点小变化：${risk.title}`;
  const description =
    risk.type === "queue"
      ? "儿童乐园预计等待 55 分钟，可能影响后续晚餐和返程。我建议缩短这一段，并插入一个低等待的室内活动。"
      : risk.description;

  return (
    <motion.div
      initial={{ y: -18, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -18, opacity: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.7 }}
      className="mb-3 rounded-[1.5rem] border border-[#EE8F6A]/30 bg-[#FFF1E9] px-4 py-3 text-[#3C342F] shadow-[0_12px_30px_rgba(238,143,106,0.10)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#B46C3D]">{title}</p>
          <p className="mt-1 text-[12px] leading-snug text-[#6E6259]">{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="rounded-full bg-[#F2A65A] px-3 py-1.5 text-[11px] font-bold text-[#3C342F] hover:bg-[#F6C65B]"
            onClick={canAdjustRisk ? acceptRiskSuggestion : ignoreRisk}
          >
            {canAdjustRisk ? "按这个调整" : "确认继续"}
          </motion.button>
          {canAdjustRisk ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              className="rounded-full border border-[#EE8F6A]/35 bg-white/55 px-3 py-1.5 text-[11px] font-bold text-[#8A5A2F]"
              onClick={ignoreRisk}
            >
              暂不调整
            </motion.button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
