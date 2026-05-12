import type { Constraints } from "@/types/plan";

/** Phase 1 静态约束，与 PRD 演示脚本一致 */
export const constraints: Constraints = {
  goal: "周末下午带孩子出去玩（户外 + 亲子 + 可控预算）",
  time_start: "14:00",
  time_end: "18:00",
  adults: 2,
  children: 1,
  children_age: 5,
  budget: 800,
  departure: "芍药居",
  transport_mode: "地铁",
  pace: "轻松",
  preference_tags: ["户外", "亲子", "地铁", "餐饮"],
};
