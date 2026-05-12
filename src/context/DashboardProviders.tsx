import type { ReactNode } from "react";
import { MachineProvider } from "@/context/MachineContext";
import { PlanProvider } from "@/context/PlanContext";
import { UIProvider } from "@/context/UIContext";
import { RiskRuntime } from "@/components/RiskRuntime";

export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <PlanProvider>
      <MachineProvider>
        <UIProvider>
          <RiskRuntime />
          {children}
        </UIProvider>
      </MachineProvider>
    </PlanProvider>
  );
}
