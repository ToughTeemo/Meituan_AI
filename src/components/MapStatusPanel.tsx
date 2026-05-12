import type { Card, POI } from "@/types/plan";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import { CardDetail, isDiningCard, isIndoorRestCard, isTransitCard } from "@/components/CardDetail";
import { PlanContextCard } from "@/components/PlanContextCard";
import { MockMapView } from "./MockMapView";
import { formatClockFromStart } from "@/utils/timeline";

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

function stationMeta(card: Card, nextCard: Card | null): string {
  if (isTransitCard(card)) {
    if (card.start_minute > 300) return "约15分钟｜预计 20:00 前到家";
    return "约20分钟｜无需换乘";
  }
  if (isDiningCard(card)) return "已预留晚餐时间｜下一站返程";
  if (isIndoorRestCard(card)) return "低等待｜避免孩子太累";
  if (card.status === "risk") return "亲子活动｜等待偏长，建议调整";
  return `亲子活动｜已缩短高排队停留${nextCard ? "" : ""}`;
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
  const nextCard = cards[focusedIndex + 1] ?? null;
  const focusedPoiId = focusCard?.poi?.poi_id ?? null;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden p-4">
      <header className="shrink-0 pb-3">
        <p className="text-sm font-bold text-[#3C342F]">路线与地点详情</p>
        <p className="mt-1 text-xs text-[#6E6259]">点击时间轴查看每一站</p>
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
            {focusCard.emoji} {focusCard.label}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#8A7666]">
            {timeRange(focusCard, plan.constraints.time_start)}｜{stationMeta(focusCard, nextCard)}
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
