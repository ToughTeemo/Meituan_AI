import { motion } from "framer-motion";
import type { Card, MachineState, ReplanPhase } from "@/types/plan";
import {
  REPLAN_CARD_ENTER_DURATION_S,
  REPLAN_CARD_STAGGER_MS,
  REPLAN_PHASE_MS,
  REPLAN_VERTICAL_ENTER_Y,
  REPLAN_VERTICAL_EXIT_SCALE,
  REPLAN_VERTICAL_EXIT_X,
} from "@/constants/replan";
import { formatClockFromStart } from "@/utils/timeline";

interface VerticalTaskCardProps {
  card: Card;
  machine: MachineState;
  replanPhase: ReplanPhase;
  replanEnterIndex: number;
  isFocused: boolean;
  planStart: string;
  onSelect: () => void;
  startLabel: string;
  isFirst: boolean;
  isLast: boolean;
}

function statusClasses(status: Card["status"]): string {
  switch (status) {
    case "done":
      return "border-slate-600 bg-slate-800/70 text-slate-300";
    case "active":
      return "border-emerald-500/90 bg-emerald-950/45 text-slate-100 ring-2 ring-emerald-500/35";
    case "upcoming":
      return "border-sky-500/60 bg-sky-950/30 text-slate-100";
    case "pending":
      return "border-slate-700 bg-slate-900 text-slate-200";
    case "risk":
      return "border-amber-500 bg-amber-950/35 text-slate-100 ring-2 ring-amber-400/50";
    case "skipped":
      return "border-slate-700 bg-slate-900/60 text-slate-500 line-through";
    default:
      return "border-slate-700 bg-slate-900 text-slate-200";
  }
}

function timelineDotClass(status: Card["status"]): string {
  switch (status) {
    case "active":
      return "border-emerald-400 bg-emerald-950 shadow-[0_0_0_3px_rgba(52,211,153,0.28)]";
    case "done":
      return "border-slate-500 bg-slate-800";
    case "risk":
      return "border-amber-400 bg-amber-950 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]";
    default:
      return "border-sky-500/80 bg-slate-900 shadow-[0_0_0_4px_rgba(15,23,42,0.95)]";
  }
}

export function VerticalTaskCard({
  card,
  machine,
  replanPhase,
  replanEnterIndex,
  isFocused,
  planStart,
  onSelect,
  startLabel,
  isFirst,
  isLast,
}: VerticalTaskCardProps) {
  const timeFrom = formatClockFromStart(planStart, card.start_minute);
  const timeTo = formatClockFromStart(
    planStart,
    card.start_minute + card.duration_minutes,
  );

  const showProgress = card.status === "active";
  const isRisk = card.status === "risk";
  const isEnter =
    machine === "REPLANNING" &&
    replanPhase === "animating" &&
    replanEnterIndex >= 0;

  return (
    <motion.div
      layout
      className="flex items-stretch gap-2"
      initial={isEnter ? { y: REPLAN_VERTICAL_ENTER_Y, opacity: 0 } : false}
      animate={
        isEnter
          ? {
              y: 0,
              opacity: 1,
            }
          : { opacity: 1 }
      }
      transition={
        isEnter
          ? {
              delay: (replanEnterIndex * REPLAN_CARD_STAGGER_MS) / 1000,
              duration: REPLAN_CARD_ENTER_DURATION_S,
              ease: "easeOut",
            }
          : { duration: 0.2 }
      }
      exit={{
        x: REPLAN_VERTICAL_EXIT_X,
        opacity: 0,
        scale: REPLAN_VERTICAL_EXIT_SCALE,
        transition: {
          duration: REPLAN_PHASE_MS.DECONSTRUCTING / 1000,
          ease: "easeIn",
        },
      }}
    >
      <div className="w-14 shrink-0 pt-2 text-right text-[11px] font-medium tabular-nums text-slate-400">
        {startLabel}
      </div>

      <div className="flex w-6 shrink-0 flex-col items-center pt-1">
        {!isFirst ? (
          <div className="mb-0.5 h-3 w-px shrink-0 bg-slate-500/90" />
        ) : null}
        <div
          className={`z-10 h-3 w-3 shrink-0 rounded-full border-2 bg-slate-950 ${timelineDotClass(card.status)}`}
        />
        {!isLast ? (
          <div className="mt-0.5 min-h-[28px] w-px flex-1 bg-slate-500/90" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1 pb-5">
        <motion.div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect();
            }
          }}
          whileTap={{ scale: machine === "REPLANNING" ? 1 : 0.99 }}
          animate={
            isRisk
              ? {
                  boxShadow: [
                    "0 0 0 1px rgba(245, 158, 11, 0.35)",
                    "0 0 0 6px rgba(245, 158, 11, 0.10)",
                    "0 0 0 1px rgba(245, 158, 11, 0.35)",
                  ],
                }
            : {
                boxShadow: isFocused
                  ? "0 0 0 2px rgba(56, 189, 248, 0.65)"
                  : "0 0 0 0px rgba(0,0,0,0)",
              }
          }
          transition={
            isRisk
              ? { repeat: Infinity, duration: 1.15, ease: "easeInOut" }
              : { type: "spring", stiffness: 520, damping: 38, mass: 0.55 }
          }
          className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border px-3 py-2.5 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${statusClasses(card.status)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold leading-snug">
                <span className="shrink-0">{card.emoji}</span>
                <span>{card.label}</span>
                {card.is_new ? (
                  <span className="shrink-0 rounded bg-sky-600/30 px-1.5 py-0.5 text-[10px] font-semibold text-sky-100">
                    新
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {timeFrom} – {timeTo} · 约 {card.duration_minutes} 分钟
                {card.is_flexible ? " · 可调" : ""}
              </div>
            </div>
            <div className="shrink-0 text-right text-[10px] font-medium text-slate-400">
              {card.status === "done" ? (
                <span className="block text-emerald-400/90">已完成</span>
              ) : null}
              {card.status === "done" ? (
                <span className="mt-0.5 block text-lg leading-none text-slate-500">
                  ✓
                </span>
              ) : null}
            </div>
          </div>

          {card.risk_note ? (
            <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-amber-100/95">
              {card.risk_note}
            </p>
          ) : null}

          {showProgress ? (
            <div className="mt-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/80">
                <motion.div
                  className="h-full rounded-full bg-emerald-500/80"
                  initial={false}
                  animate={{ width: "60%" }}
                  transition={{
                    type: "spring",
                    stiffness: 420,
                    damping: 34,
                    mass: 0.55,
                  }}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">进行中（约 60%）</p>
            </div>
          ) : null}
        </motion.div>
      </div>
    </motion.div>
  );
}
