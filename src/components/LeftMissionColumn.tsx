import { AIRequestBox } from "@/components/AIRequestBox";
import { MissionInputCard } from "@/components/MissionInputCard";

export function LeftMissionColumn() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#FFFDF9]/70">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
        <MissionInputCard />
        <AIRequestBox />
      </div>
    </div>
  );
}
