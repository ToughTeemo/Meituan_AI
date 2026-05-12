import type { Card, POI } from "@/types/plan";

interface CardDetailProps {
  card: Card;
  includeAlternatives?: boolean;
}

function POIInfoBlock({ poi }: { poi: POI }) {
  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{poi.name}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{poi.category}</p>
        </div>
        <span className="shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-amber-200">
          ★ {poi.rating.toFixed(1)}
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">人均</span>
          <span className="text-slate-200">¥{poi.price_per_person}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">排队</span>
          <span className="text-slate-200">{poi.queue_minutes} 分钟</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-500">亲子友好</span>
          <span className="text-slate-200">{poi.is_child_friendly ? "是" : "否"}</span>
        </div>
        {poi.hours_label ? (
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">营业</span>
            <span className="text-right text-slate-200">{poi.hours_label}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AlternativesPanel({ items }: { items: POI[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/20 p-3 text-[11px] text-slate-500">
        当前卡片暂无替代方案
      </div>
    );
  }
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium text-slate-400">替代方案</p>
      <ul className="space-y-2">
        {items.map((a) => (
          <li
            key={a.poi_id}
            className="rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2 text-[11px] text-slate-200"
          >
            <span className="font-medium">{a.name}</span>
            <span className="ml-2 text-slate-500">
              {a.category} · ★{a.rating.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CardDetail({
  card,
  includeAlternatives = true,
}: CardDetailProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          聚焦卡片详情
        </p>
        <p className="mt-1 text-sm text-slate-100">
          {card.emoji} {card.label}
        </p>
      </div>

      {card.poi ? (
        <POIInfoBlock poi={card.poi} />
      ) : (
        <p className="text-sm text-slate-500">该卡片无 POI 信息</p>
      )}

      {includeAlternatives ? (
        <AlternativesPanel items={card.alternatives ?? []} />
      ) : null}
    </section>
  );
}
