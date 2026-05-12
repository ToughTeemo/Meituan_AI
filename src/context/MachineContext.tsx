import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { MachineState } from "@/types/plan";
import {
  machineReducer,
  type MachineEvent,
} from "@/context/machineReducer";

type MachineContextValue = {
  state: MachineState;
  send: (event: MachineEvent) => void;
};

const MachineContext = createContext<MachineContextValue | null>(null);

export function MachineProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(machineReducer, "IDLE" satisfies MachineState);

  useEffect(() => {
    dispatch({ type: "BOOT" });
  }, []);

  const send = useCallback((event: MachineEvent) => {
    dispatch(event);
  }, []);

  const value = useMemo(() => ({ state, send }), [state, send]);
  return (
    <MachineContext.Provider value={value}>{children}</MachineContext.Provider>
  );
}

export function useMachine(): MachineContextValue {
  const v = useContext(MachineContext);
  if (!v) throw new Error("MachineProvider missing");
  return v;
}
