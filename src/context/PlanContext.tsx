import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { PlanResponse } from "@/api/plans";
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
  initialPlan?: PlanResponse | null;
  initialBundle?: PlanBundle;
  initialConstraints?: Constraints;
}

export function PlanProvider({
  children,
  initialPlan: apiPlan,
  initialBundle = initialPlan,
  initialConstraints = constraints,
}: PlanProviderProps) {
  const [state, dispatch] = useReducer(
    planReducer,
    undefined,
    () =>
      createInitialPlanState(
        structuredClone(apiPlan?.cards ?? initialBundle.cards),
        apiPlan?.timeline ?? initialBundle.timeline,
        apiPlan?.constraints ?? initialConstraints,
        apiPlan?.plan_id ?? null,
        apiPlan?.version ?? 1,
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
