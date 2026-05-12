import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import type { Card } from "@/types/plan";
import { useMachine } from "@/context/MachineContext";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import {
  REPLAN_FREEZING_BLUR_PX,
  REPLAN_OVERLAY_FADE_S,
  REPLAN_VERTICAL_FREEZING_OPACITY,
} from "@/constants/replan";
import { ReplanOverlay } from "@/components/ReplanOverlay";
import { VerticalTaskCard } from "@/components/VerticalTaskCard";
import { formatClockFromStart } from "@/utils/timeline";

/** 仅纵向时间轴轨道 + Replan 覆盖（标题、风险条、日志由 CenterTimelineColumn 承载） */
export function VerticalTimelinePanel() {
  const { state: plan } = usePlan();
  const { state: machine } = useMachine();
  const { state: ui, dispatch: uiDispatch } = useUI();

  const constraints = plan.constraints;

  const sortedCards = useMemo(() => {
    return [...plan.cards].sort((a, b) => a.start_minute - b.start_minute);
  }, [plan.cards]);

  const onSelectCard = useMemo(() => {
    return (cardId: string) => {
      if (machine === "REPLANNING") return;
      uiDispatch({ type: "FOCUS_CARD", cardId });
    };
  }, [machine, uiDispatch]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-1">
        <ReplanOverlay phase={ui.replanPhase} machine={machine} />

        <motion.div
          className="relative min-h-[min(320px,45vh)]"
          animate={{
            filter:
              ui.replanPhase === "freezing"
                ? `blur(${REPLAN_FREEZING_BLUR_PX}px)`
                : "blur(0px)",
            opacity:
              ui.replanPhase === "freezing"
                ? REPLAN_VERTICAL_FREEZING_OPACITY
                : 1,
          }}
          transition={{ duration: REPLAN_OVERLAY_FADE_S }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {sortedCards.map((card: Card, idx) => {
              const isLast = idx === sortedCards.length - 1;
              const startLabel = formatClockFromStart(
                constraints.time_start,
                card.start_minute,
              );
              const enterIdx =
                ui.replanPhase === "animating" && ui.replanInsertedOrder
                  ? ui.replanInsertedOrder.indexOf(card.card_id)
                  : -1;

              return (
                <VerticalTaskCard
                  key={card.card_id}
                  card={card}
                  machine={machine}
                  replanPhase={ui.replanPhase}
                  replanEnterIndex={enterIdx}
                  isFocused={card.card_id === ui.focusedCardId}
                  planStart={constraints.time_start}
                  startLabel={startLabel}
                  isFirst={idx === 0}
                  isLast={isLast}
                  onSelect={() => onSelectCard(card.card_id)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
