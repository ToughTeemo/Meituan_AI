interface TimelineRulerProps {
  timeStart: string;
  timeEnd: string;
  pixelsPerMinute: number;
}

function parseClock(s: string): number {
  const [h, m] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function formatClock(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = Math.floor(totalMinutes % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function TimelineRuler({
  timeStart,
  timeEnd,
  pixelsPerMinute,
}: TimelineRulerProps) {
  const start = parseClock(timeStart);
  const end = parseClock(timeEnd);
  const span = Math.max(1, end - start);
  const widthPx = span * pixelsPerMinute;

  const ticks: number[] = [];
  for (let t = start; t <= end; t += 30) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== end) ticks.push(end);

  return (
    <div className="relative select-none" style={{ width: widthPx, height: 28 }}>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-700" />
      {ticks.map((t) => {
        const x = (t - start) * pixelsPerMinute;
        const major = (t - start) % 60 === 0;
        return (
          <div
            key={t}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: x, transform: "translateX(-50%)" }}
          >
            <div
              className={
                major ? "h-2 w-px bg-slate-400" : "h-1.5 w-px bg-slate-600"
              }
            />
            <span className="mt-1 whitespace-nowrap text-[10px] text-slate-500">
              {formatClock(t)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
