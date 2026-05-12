import type { Card, RiskSignal } from "@/types/plan";
import type { DemoRiskTrigger } from "@/mock/riskPresets";

function segmentEndBeforeIndex(cards: Card[], endExclusive: number): number {
  if (endExclusive <= 0) return 0;
  return Math.max(
    ...cards.slice(0, endExclusive).map((c) => c.start_minute + c.duration_minutes),
  );
}

function dinnerStartFromSuffix(suffix: Card[]): number | null {
  const dining = suffix.find((c) => c.type === "dining");
  return dining ? dining.start_minute : null;
}

function findActivityIndex(cards: Card[]): number {
  return cards.findIndex((c) => c.type === "activity");
}

function findBufferAfter(cards: Card[], activityIndex: number): number {
  const j = activityIndex + 1;
  if (j < cards.length && cards[j].type === "buffer") return j;
  return -1;
}

function buildQueueMiddle(t0: number, dinnerStart: number): Card[] | null {
  const d1 = 45;
  const d2 = 60;
  const slack = dinnerStart - t0 - d1 - d2;
  if (slack < 10) return null;

  const tA = t0;
  const tB = tA + d1;
  const tG = tB + d2;

  const A: Card = {
    card_id: "c2b",
    type: "activity",
    status: "active",
    label: "朝阳公园（缩短）45min",
    emoji: "🎠",
    start_minute: tA,
    duration_minutes: d1,
    is_flexible: true,
    is_new: true,
    poi: {
      poi_id: "p_park_short",
      name: "朝阳公园（缩短游玩）",
      rating: 4.6,
      price_per_person: 10,
      queue_minutes: 25,
      category: "公园",
      map_position: { x: 38, y: 28 },
      is_child_friendly: true,
    },
  };

  const B: Card = {
    card_id: "c_new_indoor",
    type: "activity",
    status: "pending",
    label: "蓝色港湾 · 室内探索 60min",
    emoji: "🏬",
    start_minute: tB,
    duration_minutes: d2,
    is_flexible: true,
    is_new: true,
    poi: {
      poi_id: "p_alt_indoor",
      name: "蓝色港湾 · 室内探索",
      rating: 4.5,
      price_per_person: 0,
      queue_minutes: 5,
      category: "商场",
      map_position: { x: 62, y: 38 },
      is_child_friendly: true,
      hours_label: "10:00–22:00",
    },
  };

  const G: Card = {
    card_id: "c_gap_pre_dinner",
    type: "buffer",
    status: "pending",
    label: "弹性缓冲 · 整理前往晚餐",
    emoji: "⏸️",
    start_minute: tG,
    duration_minutes: slack,
    is_flexible: true,
    poi: {
      poi_id: "p_gap",
      name: "路线留白（缓冲）",
      rating: 4.0,
      price_per_person: 0,
      queue_minutes: 0,
      category: "缓冲",
      map_position: { x: 55, y: 50 },
      is_child_friendly: true,
    },
  };

  return [A, B, G];
}

function buildRainMiddle(t0: number, dinnerStart: number): Card[] | null {
  const d1 = 80;
  const d2 = 15;
  const slack = dinnerStart - t0 - d1 - d2;
  if (slack < 10) return null;

  const tA = t0;
  const tB = tA + d1;
  const tG = tB + d2;

  const A: Card = {
    card_id: "c_rain_indoor",
    type: "activity",
    status: "active",
    label: "室内亲子馆 · 避雨备选",
    emoji: "☔",
    start_minute: tA,
    duration_minutes: d1,
    is_flexible: true,
    is_new: true,
    poi: {
      poi_id: "p_rain_indoor",
      name: "室内亲子探索馆",
      rating: 4.4,
      price_per_person: 60,
      queue_minutes: 8,
      category: "室内场馆",
      map_position: { x: 44, y: 34 },
      is_child_friendly: true,
      hours_label: "10:00–20:00",
    },
  };

  const B: Card = {
    card_id: "c_rain_walk",
    type: "buffer",
    status: "pending",
    label: "短步行 · 前往下一节点",
    emoji: "🚶",
    start_minute: tB,
    duration_minutes: d2,
    is_flexible: true,
    poi: {
      poi_id: "p_rain_walk",
      name: "步行段（避雨优先路线）",
      rating: 4.0,
      price_per_person: 0,
      queue_minutes: 0,
      category: "路线",
      map_position: { x: 50, y: 46 },
      is_child_friendly: true,
    },
  };

  const G: Card = {
    card_id: "c_rain_gap",
    type: "buffer",
    status: "pending",
    label: "弹性缓冲 · 等待晚餐窗口",
    emoji: "⏸️",
    start_minute: tG,
    duration_minutes: slack,
    is_flexible: true,
    poi: {
      poi_id: "p_rain_gap",
      name: "路线留白（缓冲）",
      rating: 4.0,
      price_per_person: 0,
      queue_minutes: 0,
      category: "缓冲",
      map_position: { x: 58, y: 54 },
      is_child_friendly: true,
    },
  };

  return [A, B, G];
}

function buildFatigueMiddle(t0: number, dinnerStart: number): Card[] | null {
  const d1 = 100;
  const d2 = 35;
  const slack = dinnerStart - t0 - d1 - d2;
  if (slack < 0) return null;

  const tA = t0;
  const tB = tA + d1;
  const tG = tB + d2;

  const A: Card = {
    card_id: "c_fat_activity",
    type: "activity",
    status: "active",
    label: "户外段（压缩）",
    emoji: "🌤️",
    start_minute: tA,
    duration_minutes: d1,
    is_flexible: true,
    is_new: true,
    poi: {
      poi_id: "p_park_fat",
      name: "朝阳公园（压缩节奏）",
      rating: 4.5,
      price_per_person: 10,
      queue_minutes: 35,
      category: "公园",
      map_position: { x: 38, y: 28 },
      is_child_friendly: true,
      hours_label: "06:00–22:00",
    },
  };

  const B: Card = {
    card_id: "c_fat_rest",
    type: "buffer",
    status: "pending",
    label: "亲子休整 · 补水与步行减负",
    emoji: "🧃",
    start_minute: tB,
    duration_minutes: d2,
    is_flexible: true,
    poi: {
      poi_id: "p_rest_stop",
      name: "亲子休整点（示意）",
      rating: 4.1,
      price_per_person: 15,
      queue_minutes: 0,
      category: "休息点",
      map_position: { x: 46, y: 44 },
      is_child_friendly: true,
    },
  };

  const out: Card[] = [A, B];
  if (slack >= 5) {
    out.push({
      card_id: "c_fat_gap",
      type: "buffer",
      status: "pending",
      label: "微缓冲 · 对齐晚餐",
      emoji: "⏱️",
      start_minute: tG,
      duration_minutes: slack,
      is_flexible: true,
      poi: {
        poi_id: "p_fat_gap",
        name: "路线留白（缓冲）",
        rating: 4.0,
        price_per_person: 0,
        queue_minutes: 0,
        category: "缓冲",
        map_position: { x: 54, y: 52 },
        is_child_friendly: true,
      },
    });
  }
  return out;
}

/**
 * 局部替换：仅替换受影响片段，保留前缀与晚餐及之后卡片的时间戳不变。
 */
export function mergeLocalReplanSegment(
  cards: Card[],
  trigger: DemoRiskTrigger,
): Card[] | null {
  const actIdx = findActivityIndex(cards);
  if (actIdx < 0) return null;

  const bufIdx = findBufferAfter(cards, actIdx);

  let i = actIdx;
  let j = actIdx;
  if (trigger === "queue") {
    j = bufIdx !== -1 ? bufIdx : actIdx;
  } else if (trigger === "rain") {
    j = actIdx;
  } else {
    j = bufIdx !== -1 ? bufIdx : actIdx;
  }

  const prefix = cards.slice(0, i);
  const suffix = cards.slice(j + 1);
  const dinnerStart = dinnerStartFromSuffix(suffix);
  if (dinnerStart == null) return null;

  const t0 = segmentEndBeforeIndex(cards, i);
  const mid =
    trigger === "queue"
      ? buildQueueMiddle(t0, dinnerStart)
      : trigger === "rain"
        ? buildRainMiddle(t0, dinnerStart)
        : buildFatigueMiddle(t0, dinnerStart);

  if (!mid) return null;
  return [...prefix, ...mid, ...suffix];
}

export function demoTriggerFromRiskType(
  type: RiskSignal["type"],
): DemoRiskTrigger | null {
  if (type === "queue") return "queue";
  if (type === "weather") return "rain";
  if (type === "fatigue") return "fatigue";
  return null;
}
