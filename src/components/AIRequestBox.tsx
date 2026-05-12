import { useState } from "react";
import { motion } from "framer-motion";
import { useUI } from "@/context/UIContext";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";

const SUGGESTIONS = [
  "孩子有点累了，找个室内的地方",
  "晚饭想早点吃",
  "预算再控制在 ¥600 以内",
  "避开人多的地方",
] as const;

export function AIRequestBox() {
  const [text, setText] = useState("");
  const { dispatch: uiDispatch } = useUI();
  const { triggerDemoRisk } = useDashboardRiskActions();

  const applyChip = (line: string) => {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${line}` : line));
  };

  const handleSend = () => {
    const t = text.trim();
    if (!t) {
      uiDispatch({
        type: "APPEND_LOG",
        message: "请输入新要求后再发送（演示）。",
      });
      return;
    }

    if (t.includes("累")) {
      triggerDemoRisk("fatigue");
    } else if (t.includes("下雨")) {
      triggerDemoRisk("rain");
    } else if (t.includes("排队") || t.includes("人多")) {
      triggerDemoRisk("queue");
    } else {
      uiDispatch({
        type: "APPEND_LOG",
        message: "已收到新要求，等待下一次规划调整。",
      });
    }
    setText("");
  };

  const mockVoice = () => {
    uiDispatch({ type: "APPEND_LOG", message: "（演示）语音输入未接入。" });
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 shadow-inner">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        与 AI 对话 / 输入新要求
      </p>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        用一句话打断或补充偏好（非聊天，不接模型）
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((line) => (
          <button
            key={line}
            type="button"
            onClick={() => applyChip(line)}
            className="rounded-lg border border-slate-700 bg-slate-900/90 px-2 py-1 text-left text-[10px] leading-snug text-slate-300 transition hover:border-sky-800 hover:bg-slate-800"
          >
            {line}
          </button>
        ))}
      </div>

      <div className="relative mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="告诉我你的新要求..."
          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 pr-24 text-[12px] leading-snug text-slate-100 placeholder:text-slate-600 outline-none focus:border-sky-700 focus:ring-1 focus:ring-sky-600/40"
        />
        <div className="absolute bottom-2 right-2 flex gap-1.5">
          <motion.button
            type="button"
            title="语音（演示）"
            whileTap={{ scale: 0.95 }}
            onClick={mockVoice}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-sm text-slate-300"
            aria-label="语音输入（演示）"
          >
            🎙
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={handleSend}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-500"
          >
            发送
          </motion.button>
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-slate-600">
        AI 会根据你的新要求调整计划
      </p>
    </div>
  );
}
