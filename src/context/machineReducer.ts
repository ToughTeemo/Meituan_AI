import type { MachineState } from "@/types/plan";

export type MachineEvent =
  | { type: "BOOT" }
  | { type: "RISK_DETECTED" }
  | { type: "IGNORE_RISK" }
  | { type: "ACCEPT_REPLAN" }
  | { type: "REPLAN_DONE" }
  | { type: "DEMO_RESET" };

export function machineReducer(
  state: MachineState,
  event: MachineEvent,
): MachineState {
  if (event.type === "DEMO_RESET") return "EXECUTING";

  switch (state) {
    case "IDLE":
      return event.type === "BOOT" ? "EXECUTING" : state;
    case "EXECUTING":
      if (event.type === "RISK_DETECTED") return "RISK_DETECTED";
      return state;
    case "RISK_DETECTED":
      if (event.type === "IGNORE_RISK") return "EXECUTING";
      if (event.type === "ACCEPT_REPLAN") return "REPLANNING";
      return state;
    case "REPLANNING":
      if (event.type === "REPLAN_DONE") return "EXECUTING";
      return state;
    case "COMPLETED":
      return state;
    case "CONFIRMED":
      return state;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
