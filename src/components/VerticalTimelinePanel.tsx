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

export function VerticalTimelinePanel() {
  const { state: plan } = usePlan();
  const { state: machine } = useMachine();
  const { state: ui, dispatch: uiDispatch } = useUI();

  const sortedCards = useMemo(() => {
    return [...plan.cards].sort((a, b) => a.start_minute - b.start_minute);
  }, [plan.cards]);

  const visibleStops = sortedCards.filter((card) => card.type !== "buffer").length;

  const onSelectCard = useMemo(() => {
    return (cardId: string) => {
      if (machine === "REPLANNING") return;
      uiDispatch({ type: "FOCUS_CARD", cardId });
    };
  }, [machine, uiDispatch]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#FFFDF9]/30">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[rgba(120,90,60,0.06)] px-6">
        <div>
          <h2 className="text-base font-bold text-[#3C342F]">今天的路线安排</h2>
          <p className="mt-0.5 text-xs text-[#8A7666]">
            共 {visibleStops} 站 · 预计 20:00 前到家
          </p>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4 pt-3">
        <ReplanOverlay phase={ui.replanPhase} machine={machine} />

        <motion.div
          className="relative"
          animate={{
            filter:
              ui.replanPhase === "freezing"
                ? `blur(${REPLAN_FREEZING_BLUR_PX}px)`
                : "blur(0px)",
            opacity:
              ui.replanPhase === "freezing" ? REPLAN_VERTICAL_FREEZING_OPACITY : 1,
          }}
          transition={{ duration: REPLAN_OVERLAY_FADE_S }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {sortedCards.map((card: Card, index) => {
              const startLabel = formatClockFromStart(
                plan.constraints.time_start,
                card.start_minute,
              );
              const enterIndex =
                ui.replanPhase === "animating" && ui.replanInsertedOrder
                  ? ui.replanInsertedOrder.indexOf(card.card_id)
                  : -1;

              return (
                <VerticalTaskCard
                  key={card.card_id}
                  card={card}
                  machine={machine}
                  replanPhase={ui.replanPhase}
                  replanEnterIndex={enterIndex}
                  isFocused={card.card_id === ui.focusedCardId}
                  planStart={plan.constraints.time_start}
                  startLabel={startLabel}
                  isFirst={index === 0}
                  isLast={index === sortedCards.length - 1}
                  onSelect={() => onSelectCard(card.card_id)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
