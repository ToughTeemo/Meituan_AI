import type { Card } from "@/types/plan";
import type { TimelineConfig } from "@/types/plan";

export function cardPixelWidth(
  card: Card,
  timeline: TimelineConfig,
): number {
  return Math.max(
    card.duration_minutes * timeline.pixels_per_minute,
    timeline.min_card_width,
  );
}

export function planWindowMinutes(
  timeStart: string,
  timeEnd: string,
): number {
  const start = parseClock(timeStart);
  const end = parseClock(timeEnd);
  return Math.max(0, end - start);
}

function parseClock(s: string): number {
  const [h, m] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function formatClockFromStart(
  planStartClock: string,
  offsetMinutes: number,
): string {
  const base = parseClock(planStartClock);
  const t = base + offsetMinutes;
  const h = Math.floor(t / 60) % 24;
  const m = t % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
