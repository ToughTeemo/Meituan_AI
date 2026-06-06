import type { ReactNode } from "react";
import type { PlanResponse } from "@/api/plans";
import { MachineProvider } from "@/context/MachineContext";
import { PlanProvider } from "@/context/PlanContext";
import { UIProvider } from "@/context/UIContext";
import { RiskRuntime } from "@/components/RiskRuntime";
import type { Constraints, PlanBundle } from "@/types/plan";

interface DashboardProvidersProps {
  children: ReactNode;
  initialPlan?: PlanResponse | null;
  initialBundle?: PlanBundle;
  initialConstraints?: Constraints;
}

export function DashboardProviders({
  children,
  initialPlan,
  initialBundle,
  initialConstraints,
}: DashboardProvidersProps) {
  return (
    <PlanProvider
      initialPlan={initialPlan}
      initialBundle={initialBundle}
      initialConstraints={initialConstraints}
    >
      <MachineProvider>
        <UIProvider initialCards={initialPlan?.cards ?? initialBundle?.cards}>
          <RiskRuntime />
          {children}
        </UIProvider>
      </MachineProvider>
    </PlanProvider>
  );
}
