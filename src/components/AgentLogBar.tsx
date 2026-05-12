import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { AgentLogEntry } from "@/types/plan";

interface AgentLogBarProps {
  entries: AgentLogEntry[];
}

export function AgentLogBar({ entries }: AgentLogBarProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [entries.length]);

  const visible = entries.slice(-40);

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-950/55 px-4 py-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          AI 执行日志
        </p>
        <p className="text-[10px] text-slate-600">执行轨迹 · 非对话</p>
      </div>
      <div className="max-h-32 overflow-y-auto pr-1 text-[11px] leading-snug text-slate-300">
        {visible.map((e) => (
          <motion.div
            key={e.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}
            className="border-b border-slate-800/60 py-1 last:border-b-0"
          >
            {e.message}
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
