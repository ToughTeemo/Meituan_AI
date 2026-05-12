import { AnimatePresence, motion } from "framer-motion";
import type { MachineState } from "@/types/plan";
import type { ReplanPhase } from "@/types/plan";
import {
  REPLAN_GENERATING_OVERLAY_TITLE,
  REPLAN_OVERLAY_FADE_S,
  REPLAN_SPINNER_PERIOD_MS,
} from "@/constants/replan";

interface ReplanOverlayProps {
  phase: ReplanPhase;
  machine: MachineState;
}

export function ReplanOverlay({ phase, machine }: ReplanOverlayProps) {
  const active = machine === "REPLANNING" && phase !== "idle";

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key="replan-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: REPLAN_OVERLAY_FADE_S }}
          className={
            phase === "generating"
              ? "pointer-events-auto absolute inset-0 z-20"
              : "pointer-events-none absolute inset-0 z-20"
          }
        >
          {phase === "generating" ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950/35 px-4 text-center">
              <motion.div
                className="h-9 w-9 rounded-full border-2 border-slate-200/30 border-t-sky-400"
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: REPLAN_SPINNER_PERIOD_MS / 1000,
                }}
              />
              <p className="text-sm font-semibold text-slate-100">
                {REPLAN_GENERATING_OVERLAY_TITLE}
              </p>
              <p className="max-w-md text-[11px] leading-snug text-slate-300">
                正在合并约束、排队与路线可行性（演示数据）。
              </p>
            </div>
          ) : (
            <div className="h-full w-full bg-transparent" />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
