import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { Constraints, PlanAction, PlanBundle, PlanState } from "@/types/plan";
import { constraints, initialPlan } from "@/mock";
import { createInitialPlanState, planReducer } from "@/context/planReducer";

type PlanContextValue = {
  state: PlanState;
  dispatch: React.Dispatch<PlanAction>;
};

const PlanContext = createContext<PlanContextValue | null>(null);

interface PlanProviderProps {
  children: ReactNode;
  initialBundle?: PlanBundle;
  initialConstraints?: Constraints;
}

export function PlanProvider({
  children,
  initialBundle = initialPlan,
  initialConstraints = constraints,
}: PlanProviderProps) {
  const [state, dispatch] = useReducer(
    planReducer,
    createInitialPlanState(
      structuredClone(initialBundle.cards),
      initialBundle.timeline,
      initialConstraints,
    ),
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
  const v = useContext(PlanContext);
  if (!v) throw new Error("PlanProvider missing");
  return v;
}

export function usePlanDispatch(): React.Dispatch<PlanAction> {
  return usePlan().dispatch;
}

export function usePlanState(): PlanState {
  return usePlan().state;
}
