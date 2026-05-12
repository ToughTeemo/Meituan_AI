import { AIRequestBox } from "@/components/AIRequestBox";
import { DemoControls } from "@/components/DemoControls";
import { MissionInputCard } from "@/components/MissionInputCard";

export function LeftMissionColumn() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-3">
        <MissionInputCard />
        <AIRequestBox />
      </div>
      <div className="shrink-0 border-t border-slate-800 p-3">
        <DemoControls />
      </div>
    </div>
  );
}
