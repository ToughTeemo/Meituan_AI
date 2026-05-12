import { useDashboardRiskActions } from "@/hooks/useDashboardRiskActions";
import { useRiskMonitor } from "@/hooks/useRiskMonitor";
import { useMachine } from "@/context/MachineContext";
import { useUI } from "@/context/UIContext";

export function RiskRuntime(): null {
  const { state: machine } = useMachine();
  const { state: ui } = useUI();
  const { triggerDemoRisk, riskAutoDelayMs } = useDashboardRiskActions();

  const enabled =
    ui.autoRiskEnabled &&
    machine === "EXECUTING" &&
    ui.activeRisk == null &&
    !ui.riskAutoConsumed;

  useRiskMonitor({
    enabled,
    delayMs: riskAutoDelayMs,
    onFire: () => {
      triggerDemoRisk("queue", { markAutoConsumed: true });
    },
  });

  return null;
}
