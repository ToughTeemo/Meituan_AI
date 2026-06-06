import type { AgentLogEntry } from "@/types/plan";

interface AgentLogBarProps {
  entries: AgentLogEntry[];
}

export function AgentLogBar({ entries: _entries }: AgentLogBarProps) {
  void _entries;

  return (
    <div className="h-[68px] shrink-0 border-t border-[rgba(120,90,60,0.08)] bg-[#FFF9F2]/55 px-6 py-2.5">
      <div className="flex h-full items-center gap-4">
        <div className="w-28 shrink-0">
          <p className="text-[10px] font-bold tracking-wide text-[#8A5A2F]">
            安排进度
          </p>
          <p className="mt-1 text-[10px] leading-4 text-[#A99482]">
            小助手正在关注
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] leading-5 text-[#8A7666]">
            排队、时间和预算变化
          </p>
          <p className="truncate text-[12px] font-medium leading-5 text-[#526849]">
            已根据排队变化调整方案，保留晚餐和 20:00 前返程。
          </p>
        </div>
      </div>
    </div>
  );
}
