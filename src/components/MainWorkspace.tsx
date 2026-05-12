import { MapStatusPanel } from "@/components/MapStatusPanel";
import { VerticalTimelinePanel } from "@/components/VerticalTimelinePanel";

export function MainWorkspace() {
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden lg:flex-row">
      <section className="min-h-0 min-w-0 flex-1 overflow-hidden border-slate-800 lg:border-r">
        <VerticalTimelinePanel />
      </section>
      <aside className="flex h-[min(46vh,520px)] min-h-0 w-full shrink-0 flex-col overflow-hidden border-slate-800 bg-slate-900/40 lg:h-auto lg:w-[min(42vw,440px)] lg:border-l">
        <MapStatusPanel />
      </aside>
    </div>
  );
}
