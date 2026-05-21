import type { Card, POI } from "@/types/plan";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import { CardDetail } from "@/components/CardDetail";
import { PlanContextCard } from "@/components/PlanContextCard";
import { MockMapView } from "./MockMapView";
import { formatClockFromStart } from "@/utils/timeline";
import { poiArea, poiQueue, poiReason, poiTitle } from "@/utils/poiDisplay";

function routeCards(cards: Card[]): Card[] {
  return [...cards]
    .filter((card) => card.type !== "buffer")
    .sort((a, b) => a.start_minute - b.start_minute);
}

function orderedPois(cards: Card[]): POI[] {
  return routeCards(cards)
    .map((card) => card.poi)
    .filter((poi): poi is POI => Boolean(poi));
}

function timeRange(card: Card, planStart: string): string {
  return `${formatClockFromStart(planStart, card.start_minute)} - ${formatClockFromStart(
    planStart,
    card.start_minute + card.duration_minutes,
  )}`;
}

function stationMeta(card: Card): string {
  if (card.type === "transit") return poiReason(card);
  return `${poiQueue(card.poi)} · ${poiArea(card.poi)}`;
}

export function MapStatusPanel() {
  const { state: plan } = usePlan();
  const { state: ui } = useUI();

  const cards = routeCards(plan.cards);
  const pois = orderedPois(plan.cards);
  const focusedIndex = Math.max(
    0,
    cards.findIndex((card) => card.card_id === ui.focusedCardId),
  );
  const focusCard = cards[focusedIndex] ?? cards[0];
  const focusedPoiId = focusCard?.poi?.poi_id ?? null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden p-4">
      <header className="shrink-0 pb-3">
        <p className="text-sm font-bold text-[#3C342F]">路线与地点详情</p>
        <p className="mt-1 text-xs text-[#6E6259]">
          上海真实地点、路线估算和风险标签会在这里汇总。
        </p>
      </header>

      <div className="shrink-0">
        <MockMapView
          pois={pois}
          focusedPoiId={focusedPoiId}
          focusedStopIndex={focusedIndex}
          replanPhase={ui.replanPhase}
        />
      </div>

      {focusCard ? (
        <div className="mt-4 shrink-0 rounded-[1.25rem] border border-[rgba(120,90,60,0.08)] bg-[#FFF9F2]/68 px-4 py-3">
          <p className="text-[11px] font-bold text-[#8A5A2F]">
            当前查看 · 第 {focusedIndex + 1} 站
          </p>
          <p className="mt-1 text-sm font-bold leading-snug text-[#3C342F]">
            {focusCard.emoji} {poiTitle(focusCard)}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#8A7666]">
            {timeRange(focusCard, plan.constraints.time_start)} · {stationMeta(focusCard)}
          </p>
        </div>
      ) : null}

      {focusCard ? (
        <div className="mt-4 shrink-0">
          <CardDetail card={focusCard} />
        </div>
      ) : null}

      <div className="mt-auto shrink-0 pt-4">
        <PlanContextCard />
      </div>
    </div>
  );
}
