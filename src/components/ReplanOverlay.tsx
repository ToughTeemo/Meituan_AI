import { AnimatePresence, motion } from "framer-motion";
import type { MachineState, ReplanPhase } from "@/types/plan";
import { REPLAN_OVERLAY_FADE_S, REPLAN_SPINNER_PERIOD_MS } from "@/constants/replan";

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
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#FFF9F2]/55 px-4 text-center backdrop-blur-md">
              <motion.div
                className="h-10 w-10 rounded-full border-2 border-[#F2A65A]/25 border-t-[#F2A65A]"
                animate={{ rotate: 360 }}
                transition={{
                  repeat: Infinity,
                  ease: "linear",
                  duration: REPLAN_SPINNER_PERIOD_MS / 1000,
                }}
              />
              <div className="rounded-[1.5rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/88 px-5 py-4 shadow-[0_18px_50px_rgba(120,80,40,0.12)]">
                <p className="text-sm font-bold text-[#3C342F]">正在帮你调整安排</p>
                <p className="mt-1 max-w-md text-[11px] leading-snug text-[#6E6259]">
                  正在重新平衡排队、预算、路线和亲子友好度（演示数据）。
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full w-full bg-transparent" />
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
