import { CenterTimelineColumn } from "@/components/CenterTimelineColumn";
import { LeftMissionColumn } from "@/components/LeftMissionColumn";
import { RightMapColumn } from "@/components/RightMapColumn";

interface ThreeColumnWorkspaceProps {
  onConfirm: () => void;
}

export function ThreeColumnWorkspace({ onConfirm }: ThreeColumnWorkspaceProps) {
  return (
    <div className="h-full min-h-0 w-full max-w-full overflow-x-auto overflow-y-hidden p-3 text-[#3C342F]">
      <div className="flex h-full min-h-0 min-w-[1080px] overflow-hidden">
        <aside className="flex h-full w-[380px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/82 shadow-[0_18px_50px_rgba(120,80,40,0.10)]">
          <LeftMissionColumn />
        </aside>

        <main className="mx-3 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/78 shadow-[0_18px_50px_rgba(120,80,40,0.10)]">
          <CenterTimelineColumn onConfirm={onConfirm} />
        </main>

        <aside className="flex h-full w-[400px] shrink-0 flex-col overflow-hidden rounded-[1.75rem] border border-[rgba(120,90,60,0.12)] bg-[#FFFDF9]/82 shadow-[0_18px_50px_rgba(120,80,40,0.10)]">
          <RightMapColumn />
        </aside>
      </div>
    </div>
  );
}
