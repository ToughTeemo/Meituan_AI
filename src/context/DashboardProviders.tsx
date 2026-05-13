import type { ReactNode } from "react";
import { MachineProvider } from "@/context/MachineContext";
import { PlanProvider } from "@/context/PlanContext";
import { UIProvider } from "@/context/UIContext";
import { RiskRuntime } from "@/components/RiskRuntime";
import type { Constraints, PlanBundle } from "@/types/plan";

interface DashboardProvidersProps {
  children: ReactNode;
  initialBundle?: PlanBundle;
  initialConstraints?: Constraints;
}

export function DashboardProviders({
  children,
  initialBundle,
  initialConstraints,
}: DashboardProvidersProps) {
  return (
    <PlanProvider
      initialBundle={initialBundle}
      initialConstraints={initialConstraints}
    >
      <MachineProvider>
        <UIProvider initialCards={initialBundle?.cards}>
          <RiskRuntime />
          {children}
        </UIProvider>
      </MachineProvider>
    </PlanProvider>
  );
}
