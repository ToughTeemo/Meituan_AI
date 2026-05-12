import { motion } from "framer-motion";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";
import type { RiskSignal } from "@/types/plan";

interface RiskWarningBarProps {
  risk: RiskSignal;
}

export function RiskWarningBar({ risk }: RiskWarningBarProps) {
  const { acceptRiskSuggestion, ignoreRisk } = useDashboardRiskActions();

  return (
    <motion.div
      initial={{ y: -28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -28, opacity: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.7 }}
      className="mb-3 rounded-lg border border-amber-600/40 bg-amber-950/35 px-3 py-2 text-amber-50 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold">{risk.title}</p>
          <p className="mt-1 text-[11px] leading-snug text-amber-100/90">
            {risk.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="rounded-md bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950"
            onClick={acceptRiskSuggestion}
          >
            接受建议
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            className="rounded-md border border-amber-700/60 bg-transparent px-2.5 py-1 text-[11px] font-semibold text-amber-100"
            onClick={ignoreRisk}
          >
            忽略
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
