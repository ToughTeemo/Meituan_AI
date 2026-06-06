import type { Card, POI } from "@/types/plan";

export function poiTitle(card: Card): string {
  return card.poi?.name || card.label;
}

export function poiArea(poi?: POI): string {
  if (!poi) return "上海";
  if (poi.district && poi.address) return `${poi.district} · ${poi.address}`;
  return poi.district || poi.address || poi.category;
}

export function poiCost(poi?: POI): string {
  if (!poi) return "待估算";
  if (poi.price_per_person <= 0) return "无额外费用";
  return `约 ¥${poi.price_per_person}/人`;
}

export function poiQueue(poi?: POI): string {
  if (!poi) return "待估算";
  if (poi.queue_minutes <= 0) return "无需排队";
  if (poi.queue_minutes <= 15) return `低等待 · 约 ${poi.queue_minutes} 分钟`;
  if (poi.queue_minutes <= 30) return `较热门 · 约 ${poi.queue_minutes} 分钟`;
  return `高等待 · 约 ${poi.queue_minutes} 分钟`;
}

export function poiReason(card: Card): string {
  return (
    card.poi?.recommendation_reason ||
    card.risk_note ||
    (card.type === "transit"
      ? "这段通勤时间已纳入整体路线节奏。"
      : "已按当前时间、预算和偏好纳入路线。")
  );
}

export function cardStatusLabel(card: Card): string {
  if (card.status === "done") return "已安排";
  if (card.status === "risk") return "需调整";
  if (card.type === "transit") return "通勤";
  if (card.type === "dining") return "餐饮";
  if (card.is_new) return "推荐";
  return "待执行";
}

export function riskLabels(poi?: POI): string[] {
  return poi?.risk_labels?.filter(Boolean) ?? [];
}
