import { MissionInputCard } from "@/components/MissionInputCard";
import { PlanSummaryStrip } from "@/components/PlanSummaryStrip";

export function TopMissionBar() {
  return (
    <header className="shrink-0 border-b border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-stretch xl:justify-between">
        <MissionInputCard />
        <div className="flex min-w-0 flex-col justify-center xl:max-w-xl">
          <PlanSummaryStrip />
        </div>
      </div>
    </header>
  );
}
