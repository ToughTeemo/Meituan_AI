import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { Card, UIState } from "@/types/plan";
import { initialPlan } from "@/mock";
import { createInitialUiState, uiReducer, type UIAction } from "@/context/uiReducer";

type UIContextValue = {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
};

const UIContext = createContext<UIContextValue | null>(null);

function defaultFocusedCardId(cards: Card[]): string {
  const active = cards.find((c) => c.status === "active");
  return active?.card_id ?? cards[0]?.card_id ?? "c2";
}

export function UIProvider({
  children,
  initialCards = initialPlan.cards,
}: {
  children: ReactNode;
  initialCards?: Card[];
}) {
  const [state, dispatch] = useReducer(
    uiReducer,
    undefined,
    () => createInitialUiState(defaultFocusedCardId(initialCards)),
  );
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const v = useContext(UIContext);
  if (!v) throw new Error("UIProvider missing");
  return v;
}
