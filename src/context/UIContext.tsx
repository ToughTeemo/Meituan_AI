import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { UIState } from "@/types/plan";
import { initialPlan } from "@/mock";
import { createInitialUiState, uiReducer, type UIAction } from "@/context/uiReducer";

type UIContextValue = {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
};

const UIContext = createContext<UIContextValue | null>(null);

function defaultFocusedCardId(): string {
  const active = initialPlan.cards.find((c) => c.status === "active");
  return active?.card_id ?? initialPlan.cards[0]!.card_id;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    uiReducer,
    undefined,
    () => createInitialUiState(defaultFocusedCardId()),
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const v = useContext(UIContext);
  if (!v) throw new Error("UIProvider missing");
  return v;
}
