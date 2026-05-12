import type { Card, RiskSignal } from "@/types/plan";
import type { DemoRiskTrigger } from "@/mock/riskPresets";

function firstMiddleIndex(cards: Card[]): number {
  return cards.findIndex((card) => card.type === "activity");
}

function firstDiningIndex(cards: Card[]): number {
  return cards.findIndex((card) => card.type === "dining");
}

function adjustedMiddle(trigger: DemoRiskTrigger): Card[] {
  if (trigger === "rain") {
    return [
      {
        card_id: "c_rain_indoor",
        type: "activity",
        status: "active",
        label: "室内亲子馆 · 避雨活动",
        emoji: "☔",
        start_minute: 20,
        duration_minutes: 90,
        is_flexible: true,
        is_new: true,
        poi: {
          poi_id: "p_rain_indoor",
          name: "室内亲子馆 · 避雨活动",
          rating: 4.4,
          price_per_person: 60,
          queue_minutes: 8,
          category: "亲子室内",
          map_position: { x: 44, y: 34 },
          is_child_friendly: true,
          hours_label: "10:00-20:00",
        },
      },
      {
        card_id: "c3",
        type: "activity",
        status: "pending",
        label: "亲子书店 · 室内休息",
        emoji: "📚",
        start_minute: 130,
        duration_minutes: 60,
        is_flexible: true,
        is_new: true,
        poi: {
          poi_id: "p_family_bookstore",
          name: "亲子书店 · 室内休息",
          rating: 4.6,
          price_per_person: 35,
          queue_minutes: 5,
          category: "室内休息",
          map_position: { x: 58, y: 42 },
          is_child_friendly: true,
          hours_label: "10:00-21:00",
        },
      },
    ];
  }

  if (trigger === "fatigue") {
    return [
      {
        card_id: "c_fat_activity",
        type: "activity",
        status: "active",
        label: "朝阳公园 · 放慢节奏",
        emoji: "🌿",
        start_minute: 20,
        duration_minutes: 80,
        is_flexible: true,
        is_new: true,
        poi: {
          poi_id: "p_park_fat",
          name: "朝阳公园 · 放慢节奏",
          rating: 4.5,
          price_per_person: 10,
          queue_minutes: 20,
          category: "亲子活动",
          map_position: { x: 38, y: 28 },
          is_child_friendly: true,
          hours_label: "06:00-22:00",
        },
      },
      {
        card_id: "c3",
        type: "activity",
        status: "pending",
        label: "亲子书店 · 室内休息",
        emoji: "📚",
        start_minute: 130,
        duration_minutes: 60,
        is_flexible: true,
        is_new: true,
        poi: {
          poi_id: "p_family_bookstore",
          name: "亲子书店 · 室内休息",
          rating: 4.6,
          price_per_person: 35,
          queue_minutes: 5,
          category: "室内休息",
          map_position: { x: 58, y: 42 },
          is_child_friendly: true,
          hours_label: "10:00-21:00",
        },
      },
    ];
  }

  return [
    {
      card_id: "c2b",
      type: "activity",
      status: "active",
      label: "朝阳公园 · 轻松游玩",
      emoji: "🎠",
      start_minute: 20,
      duration_minutes: 90,
      is_flexible: true,
      is_new: true,
      poi: {
        poi_id: "p_park_short",
        name: "朝阳公园 · 轻松游玩",
        rating: 4.7,
        price_per_person: 10,
        queue_minutes: 25,
        category: "亲子活动",
        map_position: { x: 38, y: 28 },
        is_child_friendly: true,
        hours_label: "06:00-22:00",
      },
      risk_note: "已缩短高排队活动",
    },
    {
      card_id: "c_new_indoor",
      type: "activity",
      status: "pending",
      label: "亲子书店 · 室内休息",
      emoji: "📚",
      start_minute: 130,
      duration_minutes: 60,
      is_flexible: true,
      is_new: true,
      poi: {
        poi_id: "p_family_bookstore",
        name: "亲子书店 · 室内休息",
        rating: 4.6,
        price_per_person: 35,
        queue_minutes: 5,
        category: "室内休息",
        map_position: { x: 58, y: 42 },
        is_child_friendly: true,
        hours_label: "10:00-21:00",
      },
    },
  ];
}

export function mergeLocalReplanSegment(
  cards: Card[],
  trigger: DemoRiskTrigger,
): Card[] | null {
  const startIdx = firstMiddleIndex(cards);
  const diningIdx = firstDiningIndex(cards);
  if (startIdx < 0 || diningIdx < 0 || startIdx >= diningIdx) return null;

  const prefix = cards.slice(0, startIdx);
  const suffix = cards.slice(diningIdx);
  return [...prefix, ...adjustedMiddle(trigger), ...suffix];
}

export function demoTriggerFromRiskType(
  type: RiskSignal["type"],
): DemoRiskTrigger | null {
  if (type === "queue") return "queue";
  if (type === "weather") return "rain";
  if (type === "fatigue") return "fatigue";
  return null;
}
