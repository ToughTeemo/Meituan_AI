import type { Card, POI } from "@/types/plan";
import { useUI } from "@/context/UIContext";
import {
  poiArea,
  poiCost,
  poiQueue,
  poiReason,
  poiTitle,
  riskLabels,
} from "@/utils/poiDisplay";

interface CardDetailProps {
  card: Card;
}

type InfoTone = "warm" | "green" | "orange";

export function isTransitCard(card: Card): boolean {
  return card.type === "transit";
}

export function isDiningCard(card: Card): boolean {
  return card.type === "dining";
}

export function isIndoorRestCard(card: Card): boolean {
  const text = `${card.label} ${card.poi?.category ?? ""} ${card.poi?.name ?? ""}`;
  return text.includes("室内") || text.includes("商场") || text.includes("博物馆");
}

function InfoPill({
  label,
  value,
  tone = "warm",
}: {
  label: string;
  value: string;
  tone?: InfoTone;
}) {
  const cls =
    tone === "green"
      ? "bg-[#EFF5E9] text-[#526849]"
      : tone === "orange"
        ? "bg-[#FFF4DE] text-[#8A5A2F]"
        : "bg-[#F7EEDF]/62 text-[#6E6259]";

  return (
    <span className={`rounded-2xl px-3 py-2 text-[11px] ${cls}`}>
      {label} <b className="text-[#3C342F]">{value}</b>
    </span>
  );
}

function Header({ card, poi }: { card: Card; poi: POI }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-base font-bold leading-snug text-[#3C342F]">
          {poiTitle(card)}
        </p>
        <p className="mt-0.5 text-[12px] leading-5 text-[#8A7666]">
          {poi.category} · {poiArea(poi)}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-[#FCE8C1] px-3 py-1 text-[11px] font-bold text-[#8A5A2F]">
        {poi.rating.toFixed(1)}
      </span>
    </div>
  );
}

function PrimaryFacts({ card, poi }: { card: Card; poi: POI }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <InfoPill label="预计停留" value={`约 ${card.duration_minutes} 分钟`} />
      <InfoPill label="预算" value={poiCost(poi)} />
      <InfoPill
        label="等待"
        value={poiQueue(poi)}
        tone={poi.queue_minutes <= 15 ? "green" : "orange"}
      />
      <InfoPill label="营业" value={poi.hours_label ?? "以商户实时信息为准"} />
      <InfoPill
        label="区域"
        value={poi.district ?? "上海"}
        tone="green"
      />
      <InfoPill
        label="适合"
        value={poi.is_child_friendly ? "亲子友好" : "周末出行"}
        tone="green"
      />
    </div>
  );
}

function Coordinates({ poi }: { poi: POI }) {
  if (poi.latitude == null || poi.longitude == null) return null;
  return (
    <p className="rounded-2xl bg-white/65 px-3 py-2 text-[11px] text-[#8A7666]">
      坐标：{poi.latitude.toFixed(4)}, {poi.longitude.toFixed(4)}
    </p>
  );
}

function actionLabels(card: Card): string[] {
  if (isTransitCard(card)) return ["打开导航", "切换打车", "提醒出发"];
  if (isDiningCard(card)) return ["查看预约入口", "换一家餐厅", "加入分享"];
  return ["换一个地点", "缩短停留", "收藏这个点"];
}

export function CardDetail({ card }: CardDetailProps) {
  const poi = card.poi;
  const { dispatch } = useUI();
  if (!poi) return null;

  const labels = riskLabels(poi);
  const actions = actionLabels(card);

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-[1.45rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] p-4 shadow-[0_9px_24px_rgba(120,80,40,0.05)]">
        <Header card={card} poi={poi} />
        <PrimaryFacts card={card} poi={poi} />
        <Coordinates poi={poi} />
        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <span
                key={label}
                className="rounded-full bg-[#FFF4DE] px-3 py-1 text-[11px] font-semibold text-[#8A5A2F]"
              >
                {label}风险
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="rounded-[1.3rem] border border-[#F2A65A]/14 bg-[#FFF4DE]/70 p-3 text-[12px] leading-6 text-[#6E6259]">
        <p className="font-bold text-[#8A5A2F]">为什么这样安排？</p>
        <p className="mt-1">{poiReason(card)}</p>
      </div>

      {card.alternatives && card.alternatives.length > 0 ? (
        <div className="rounded-[1.3rem] border border-[rgba(120,90,60,0.08)] bg-[#FFFDF9] p-3">
          <p className="text-[11px] font-bold text-[#8A5A2F]">可替换地点</p>
          <div className="mt-2 space-y-2">
            {card.alternatives.slice(0, 2).map((item) => (
              <button
                key={item.poi_id}
                type="button"
                onClick={() =>
                  dispatch({
                    type: "APPEND_LOG",
                    message: `已记录备选：${item.name}。下一步可以把它替换进路线。`,
                  })
                }
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-[#F7EEDF]/52 px-3 py-2 text-left text-[11px] transition hover:bg-[#FFF4DE]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[#3C342F]">
                    {item.name}
                  </span>
                  <span className="block truncate text-[#8A7666]">
                    {item.district ?? item.category} · {poiCost(item)}
                  </span>
                </span>
                <span className="shrink-0 text-[#8A5A2F]">替换</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.3rem] border border-[rgba(120,90,60,0.08)] bg-[#FFFDF9] p-3">
        <p className="text-[11px] font-bold text-[#8A5A2F]">下一步</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <button
              key={action}
              type="button"
              onClick={() =>
                dispatch({
                  type: "APPEND_LOG",
                  message: `收到：${action}。MVP 当前会先保留为外部执行入口。`,
                })
              }
              className={
                index === 0
                  ? "rounded-full border border-[#F2A65A]/28 bg-[#FFF4DE]/70 px-3 py-1.5 text-[11px] font-semibold text-[#8A5A2F] transition hover:bg-[#FCE8C1]"
                  : "rounded-full border border-[rgba(120,90,60,0.10)] bg-[#F7EEDF]/58 px-3 py-1.5 text-[11px] font-medium text-[#6E6259] transition hover:bg-[#FFF4DE]"
              }
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
