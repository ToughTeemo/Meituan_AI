import { useEffect, useRef } from "react";

export function useRiskMonitor(opts: {
  enabled: boolean;
  delayMs: number;
  onFire: () => void;
}): void {
  const onFireRef = useRef(opts.onFire);
  onFireRef.current = opts.onFire;

  useEffect(() => {
    if (!opts.enabled) return;
    const timer = window.setTimeout(() => {
      onFireRef.current();
    }, opts.delayMs);
    return () => window.clearTimeout(timer);
  }, [opts.enabled, opts.delayMs]);
}
