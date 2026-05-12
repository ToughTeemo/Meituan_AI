import type { Card, POI } from "@/types/plan";
import { usePlan } from "@/context/PlanContext";
import { useUI } from "@/context/UIContext";
import { AgentReasoningBubble } from "@/components/AgentReasoningBubble";
import { AlternativesPanel, CardDetail } from "@/components/CardDetail";
import { PlanContextCard } from "@/components/PlanContextCard";
import { MockMapView } from "./MockMapView";

function orderedPois(cards: Card[]): POI[] {
  const list: POI[] = [];
  for (const c of cards) {
    if (c.poi) list.push(c.poi);
  }
  return list;
}

export function MapStatusPanel() {
  const { state: plan } = usePlan();
  const { state: ui } = useUI();

  const pois = orderedPois(plan.cards);
  const focusCard =
    plan.cards.find((c) => c.card_id === ui.focusedCardId) ?? plan.cards[0];
  const focusedPoiId = focusCard?.poi?.poi_id ?? null;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden p-4">
      <header className="shrink-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          地图与详情
        </p>
        <p className="text-sm text-slate-300">SVG Mock · 路线与 POI</p>
      </header>

      <div className="shrink-0">
        <MockMapView
          pois={pois}
          focusedPoiId={focusedPoiId}
          replanPhase={ui.replanPhase}
        />
      </div>

      {focusCard ? (
        <>
          <CardDetail card={focusCard} includeAlternatives={false} />
          <AlternativesPanel items={focusCard.alternatives ?? []} />
        </>
      ) : (
        <p className="shrink-0 text-sm text-slate-500">暂无卡片</p>
      )}

      <div className="shrink-0">
        <AgentReasoningBubble message={ui.agentMessage} variant="inline" />
      </div>

      <div className="mt-auto shrink-0 pb-1">
        <PlanContextCard />
      </div>
    </div>
  );
}
