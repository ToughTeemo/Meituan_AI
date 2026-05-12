import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { PlanAction, PlanState } from "@/types/plan";
import { constraints, initialPlan } from "@/mock";
import { createInitialPlanState, planReducer } from "@/context/planReducer";

type PlanContextValue = {
  state: PlanState;
  dispatch: React.Dispatch<PlanAction>;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    planReducer,
    createInitialPlanState(
      structuredClone(initialPlan.cards),
      initialPlan.timeline,
      constraints,
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
