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

function statusClasses(card: Card, isFocused: boolean): string {
  const selected = isFocused ? "ring-2 ring-[#F2A65A]/45" : "";
  if (card.status === "done") {
    return `border-[#B7C9A8]/55 bg-[#F3F7EE] text-[#3C342F] ${selected}`;
  }
  if (card.status === "risk") {
    return `border-[#EE8F6A]/60 bg-[#FFF1E9] text-[#3C342F] ${selected}`;
  }
  if (card.card_id === "c2" || card.card_id === "c2b" || card.card_id === "c_new_indoor") {
    return `border-[#F6C65B]/36 bg-[#FFF8E8] text-[#3C342F] ${selected}`;
  }
  return `border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] text-[#3C342F] ${selected}`;
}

function timelineDotClass(card: Card, isFocused: boolean): string {
  if (isFocused) {
    return "border-[#F2A65A] bg-[#F6C65B] shadow-[0_0_0_5px_rgba(242,166,90,0.18)]";
  }
  if (card.status === "done") return "border-[#AEBB9C] bg-[#EFF5E9]";
  if (card.status === "risk") {
    return "border-[#EE8F6A] bg-[#FFD9C9] shadow-[0_0_0_4px_rgba(238,143,106,0.12)]";
  }
  if (card.card_id === "c2" || card.card_id === "c2b" || card.card_id === "c_new_indoor") {
    return "border-[#F2A65A] bg-[#FFF4DE] shadow-[0_0_0_4px_rgba(242,166,90,0.12)]";
  }
  return "border-[#D5B48E] bg-[#FFFDF9] shadow-[0_0_0_4px_rgba(255,249,242,0.95)]";
}

function statusPill(card: Card): { label: string; className: string } {
  if (card.status === "done") {
    return { label: "已完成", className: "bg-[#B7C9A8]/42 text-[#526849]" };
  }
  if (card.status === "risk") {
    return { label: "需调整", className: "bg-[#FFD9C9] text-[#9A5238]" };
  }
  if (card.card_id === "c2" || card.card_id === "c2b") {
    return { label: "已调整", className: "bg-[#FFF4DE] text-[#8A5A2F]" };
  }
  if (card.card_id === "c3" || card.card_id === "c_new_indoor") {
    return { label: "低等待", className: "bg-[#EFF5E9] text-[#526849]" };
  }
  if (card.type === "dining") {
    return { label: "可预约", className: "bg-[#EFF5E9] text-[#526849]" };
  }
  if (card.type === "transit" && card.start_minute > 300) {
    return { label: "返程", className: "bg-[#F7EEDF] text-[#6E6259]" };
  }
  if (card.type === "transit") {
    return { label: "交通", className: "bg-[#F7EEDF] text-[#6E6259]" };
  }
  return { label: "待执行", className: "bg-[#F7EEDF] text-[#6E6259]" };
}

function cardHint(card: Card): string {
  if (card.status === "risk") return "当前排队 55 分钟，建议缩短停留";
  if (card.card_id === "c2" || card.card_id === "c2b") {
    return "已调整：缩短高排队活动，保留孩子轻松活动时间";
  }
  if (card.card_id === "c3" || card.card_id === "c_new_indoor") {
    return "已调整：加入低等待室内休息点，避免孩子太累";
  }
  if (card.status === "done") return "已完成";
  if (card.type === "dining") return "已预留晚餐时间，节奏不赶";
  if (card.type === "transit" && card.start_minute > 300) return "预计 20:00 前到家";
  if (card.type === "transit") return "已完成";
  return "已预留时间，节奏不赶";
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

  const isRisk = card.status === "risk";
  const isEnter =
    machine === "REPLANNING" &&
    replanPhase === "animating" &&
    replanEnterIndex >= 0;
  const pill = statusPill(card);

  return (
    <motion.div
      layout
      className="flex items-stretch gap-2"
      initial={isEnter ? { y: REPLAN_VERTICAL_ENTER_Y, opacity: 0 } : false}
      animate={isEnter ? { y: 0, opacity: 1 } : { opacity: 1 }}
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
      <div className="w-14 shrink-0 pt-3 text-right text-[11px] font-bold tabular-nums text-[#8A7666]">
        {startLabel}
      </div>

      <div className="flex w-6 shrink-0 flex-col items-center pt-2">
        {!isFirst ? <div className="mb-1 h-3 w-px shrink-0 bg-[#D8C8B8]" /> : null}
        <div
          className={`z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${timelineDotClass(card, isFocused)}`}
        />
        {!isLast ? <div className="mt-1 min-h-[22px] w-px flex-1 bg-[#D8C8B8]" /> : null}
      </div>

      <div className="min-w-0 flex-1 pb-3">
        <motion.div
          role="button"
          tabIndex={0}
          onClick={onSelect}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect();
            }
          }}
          whileHover={machine === "REPLANNING" ? undefined : { y: -1 }}
          whileTap={{ scale: machine === "REPLANNING" ? 1 : 0.99 }}
          animate={
            isRisk
              ? {
                  boxShadow: [
                    "0 0 0 1px rgba(238,143,106,0.24)",
                    "0 0 0 4px rgba(238,143,106,0.07)",
                    "0 0 0 1px rgba(238,143,106,0.24)",
                  ],
                }
              : {
                  boxShadow: isFocused
                    ? "0 0 0 2px rgba(242,166,90,0.30), 0 12px 28px rgba(120,80,40,0.08)"
                    : "0 8px 22px rgba(120,80,40,0.05)",
                }
          }
          transition={
            isRisk
              ? { repeat: Infinity, duration: 1.9, ease: "easeInOut" }
              : { type: "spring", stiffness: 520, damping: 38, mass: 0.55 }
          }
          className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-[1.25rem] border px-4 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#F2A65A]/45 ${statusClasses(card, isFocused)}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold leading-snug">
                <span className="shrink-0">{card.emoji}</span>
                <span>{card.label}</span>
                {card.is_new ? (
                  <span className="shrink-0 rounded-full bg-[#F6C65B]/48 px-2 py-0.5 text-[10px] font-bold text-[#7A5527]">
                    新
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] text-[#8A7666]">
                {timeFrom} - {timeTo} · 约 {card.duration_minutes} 分钟
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-[#6E6259]">
                {cardHint(card)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${pill.className}`}>
                {pill.label}
              </span>
              {isFocused ? (
                <span className="text-[10px] font-semibold text-[#8A5A2F]">
                  查看详情 →
                </span>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
