import { CenterTimelineColumn } from "@/components/CenterTimelineColumn";
import { LeftMissionColumn } from "@/components/LeftMissionColumn";
import { RightMapColumn } from "@/components/RightMapColumn";

export function ThreeColumnWorkspace() {
  return (
    <div className="flex h-full min-h-0 min-w-[1080px] w-full flex-1 overflow-hidden bg-slate-950 text-slate-100">
      <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-slate-800">
        <LeftMissionColumn />
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-slate-800">
        <CenterTimelineColumn />
      </main>

      <aside className="flex h-full w-[400px] shrink-0 flex-col">
        <RightMapColumn />
      </aside>
    </div>
  );
}
