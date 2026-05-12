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
  const actIdx = cards.findIndex((c) => c.type === "activity");
  if (actIdx < 0) return [];
  const bufIdx = cards.findIndex(
    (c, i) => i === actIdx + 1 && c.type === "buffer",
  );

  if (trigger === "rain") {
    return [cards[actIdx].card_id];
  }

  if (trigger === "queue") {
    if (bufIdx !== -1) return [cards[actIdx].card_id, cards[bufIdx].card_id];
    return [cards[actIdx].card_id];
  }

  if (bufIdx !== -1) return [cards[actIdx].card_id, cards[bufIdx].card_id];
  return [cards[actIdx].card_id];
}

export function createQueueRiskSignal(
  affected_card_ids: string[],
): RiskSignal {
  return {
    risk_id: id("risk_queue"),
    type: "queue",
    severity: "medium",
    title: "排队严重超时",
    description:
      "儿童乐园排队时间升至 55 分钟，可能影响后续晚餐与返程。",
    affected_card_ids,
  };
}

export function createRainRiskSignal(affected_card_ids: string[]): RiskSignal {
  return {
    risk_id: id("risk_rain"),
    type: "weather",
    severity: "medium",
    title: "下雨",
    description:
      "傍晚前后可能有阵雨，户外活动受影响，建议压缩户外并增加室内段。",
    affected_card_ids,
  };
}

export function createFatigueRiskSignal(
  affected_card_ids: string[],
): RiskSignal {
  return {
    risk_id: id("risk_fatigue"),
    type: "fatigue",
    severity: "medium",
    title: "疲劳",
    description:
      "孩子可能累了：连续活动偏多，建议插入休整并压缩后续步行段。",
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
      return "排队拉长：建议缩短高排队段并插入低等待替代，稳住晚餐与返程。";
    case "weather":
      return "降雨风险上升：建议压缩户外，保留室内备选路线。";
    case "fatigue":
      return "疲劳信号：建议插入休整，减轻连续步行压力。";
    case "time":
    case "budget":
    case "closure":
      return "系统提示：请关注风险条中的约束冲突，必要时接受局部重排。";
  }
}
