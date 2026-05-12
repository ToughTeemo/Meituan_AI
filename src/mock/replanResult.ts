import type { Card } from "@/types/plan";

export const replanResult: { cards: Card[] } = {
  cards: [
    {
      card_id: "c2b",
      type: "activity",
      status: "pending",
      label: "朝阳公园 · 精简游玩",
      emoji: "🎠",
      start_minute: 20,
      duration_minutes: 45,
      is_flexible: true,
      is_new: true,
      poi: {
        poi_id: "p_park_short",
        name: "朝阳公园儿童乐园（缩短停留）",
        rating: 4.6,
        price_per_person: 10,
        queue_minutes: 25,
        category: "亲子活动",
        map_position: { x: 38, y: 28 },
        is_child_friendly: true,
      },
    },
    {
      card_id: "c_new_indoor",
      type: "activity",
      status: "pending",
      label: "蓝色港湾 · 室内探索",
      emoji: "🏫",
      start_minute: 65,
      duration_minutes: 60,
      is_flexible: true,
      is_new: true,
      poi: {
        poi_id: "p_alt_indoor",
        name: "蓝色港湾 · 室内探索",
        rating: 4.5,
        price_per_person: 0,
        queue_minutes: 5,
        category: "亲子室内",
        map_position: { x: 62, y: 38 },
        is_child_friendly: true,
        hours_label: "10:00-22:00",
      },
    },
  ],
};
