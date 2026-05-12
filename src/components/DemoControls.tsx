import { motion } from "framer-motion";
import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";
import { useUI } from "@/context/UIContext";
import type { DemoRiskTrigger } from "@/mock/riskPresets";

function TriggerButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "muted";
}) {
  const cls =
    variant === "muted"
      ? "rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-900"
      : "rounded-lg border border-amber-800/50 bg-amber-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-950/50";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      className={cls}
      onClick={onClick}
    >
      {label}
    </motion.button>
  );
}

export function DemoControls() {
  const { state: ui, dispatch: uiDispatch } = useUI();
  const { triggerDemoRisk, resetDemo } = useDashboardRiskActions();

  const fire = (t: DemoRiskTrigger) => () => {
    triggerDemoRisk(t);
  };

  const toggleAutoRisk = () => {
    uiDispatch({ type: "SET_AUTO_RISK_ENABLED", enabled: !ui.autoRiskEnabled });
  };

  return (
    <div
      className="rounded-xl border border-slate-800 bg-slate-900/90 p-3 shadow-inner"
      aria-label="演示控制台"
    >
      <p className="mb-2 text-[11px] font-semibold text-slate-300">演示控制台</p>
      <p className="mb-3 text-[10px] leading-snug text-slate-500">
        现场控场：与主流程解耦，评委可识别为演示入口
      </p>

      <div className="mb-2 flex flex-wrap gap-2">
        <TriggerButton
          label={ui.autoRiskEnabled ? "自动风险：开" : "自动风险：关"}
          onClick={toggleAutoRisk}
          variant="muted"
        />
        <TriggerButton label="重置演示" onClick={resetDemo} variant="muted" />
      </div>

      <div className="flex flex-wrap gap-2">
        <TriggerButton label="模拟排队变长" onClick={fire("queue")} />
        <TriggerButton label="模拟下雨" onClick={fire("rain")} />
        <TriggerButton label="模拟孩子累了" onClick={fire("fatigue")} />
      </div>
    </div>
  );
}
