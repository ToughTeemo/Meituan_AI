import type { RiskSignal } from "@/types/plan";

export type DemoRiskTrigger = "queue" | "rain" | "fatigue";

export const RISK_AUTO_DELAY_MS = 5000;

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resolveAffectedCardIds(
  cards: { card_id: string; type: string }[],
  trigger: DemoRiskTrigger,
): string[] {
  const actIdx = cards.findIndex((card) => card.type === "activity");
  if (actIdx < 0) return [];
  const bufIdx = cards.findIndex(
    (card, index) => index === actIdx + 1 && card.type === "buffer",
  );

  if (trigger === "rain") return [cards[actIdx].card_id];
  if (trigger === "queue") {
    if (bufIdx !== -1) return [cards[actIdx].card_id, cards[bufIdx].card_id];
    return [cards[actIdx].card_id];
  }
  if (bufIdx !== -1) return [cards[actIdx].card_id, cards[bufIdx].card_id];
  return [cards[actIdx].card_id];
}

export function createQueueRiskSignal(affected_card_ids: string[]): RiskSignal {
  return {
    risk_id: id("risk_queue"),
    type: "queue",
    severity: "medium",
    title: "排队变长了",
    description:
      "儿童乐园预计等待 55 分钟，可能影响后续晚餐和返程时间。",
    affected_card_ids,
  };
}

export function createRainRiskSignal(affected_card_ids: string[]): RiskSignal {
  return {
    risk_id: id("risk_rain"),
    type: "weather",
    severity: "medium",
    title: "突然下雨",
    description:
      "傍晚前后可能有阵雨，户外活动舒适度下降，建议保留室内备选。",
    affected_card_ids,
  };
}

export function createFatigueRiskSignal(affected_card_ids: string[]): RiskSignal {
  return {
    risk_id: id("risk_fatigue"),
    type: "fatigue",
    severity: "medium",
    title: "孩子有点累了",
    description:
      "连续活动偏多，建议插入休整点，减少后续步行压力。",
    affected_card_ids,
  };
}

export function createRiskSignalForDemoTrigger(
  trigger: DemoRiskTrigger,
  affected_card_ids: string[],
): RiskSignal {
  switch (trigger) {
    case "queue":
      return createQueueRiskSignal(affected_card_ids);
    case "rain":
      return createRainRiskSignal(affected_card_ids);
    case "fatigue":
      return createFatigueRiskSignal(affected_card_ids);
    default: {
      const _exhaustive: never = trigger;
      return _exhaustive;
    }
  }
}

export function agentMessageForRisk(risk: RiskSignal): string {
  switch (risk.type) {
    case "queue":
      return "排队过长，建议缩短当前活动，并插入低等待替代，稳住晚餐与返程。";
    case "weather":
      return "天气有变化，建议压缩户外活动，切换到更稳妥的室内地点。";
    case "fatigue":
      return "孩子可能有点累了，建议加入休息点，让后半程更轻松。";
    case "time":
    case "budget":
    case "closure":
      return "我会优先保留关键时间，并帮你避开可能冲突的安排。";
  }
}
