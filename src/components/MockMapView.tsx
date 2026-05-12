import { motion } from "framer-motion";
import { useMemo } from "react";
import type { POI, ReplanPhase } from "@/types/plan";
import {
  REPLAN_MAP_DIM_OPACITY,
  REPLAN_MAP_ROUTE_FADE_S,
  REPLAN_OVERLAY_FADE_S,
} from "@/constants/replan";

interface MockMapViewProps {
  pois: POI[];
  focusedPoiId: string | null;
  replanPhase: ReplanPhase;
}

export function MockMapView({
  pois,
  focusedPoiId,
  replanPhase,
}: MockMapViewProps) {
  const d =
    pois.length === 0
      ? ""
      : `M ${pois.map((p) => `${p.map_position.x} ${p.map_position.y}`).join(" L ")}`;

  const routeKey = useMemo(() => {
    return `${d}|${pois.map((p) => p.poi_id).join("|")}`;
  }, [d, pois]);

  const isGenerating = replanPhase === "generating";
  const hasRoute = d.length > 0;

  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60"
      animate={{ opacity: isGenerating ? REPLAN_MAP_DIM_OPACITY : 1 }}
      transition={{ duration: REPLAN_OVERLAY_FADE_S }}
    >
      <div className="border-b border-slate-800 px-3 py-2">
        <p className="text-[11px] text-slate-400">示意地图（非真实地理投影）</p>
      </div>
      <svg
        viewBox="0 0 100 100"
        className="block h-[min(36vh,340px)] min-h-[240px] w-full text-slate-200"
        role="img"
        aria-label="Mock 路线与 POI 标点"
      >
        <defs>
          <linearGradient id="route" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="#020617" />
        <path
          d="M0 68 C 25 62, 40 58, 55 52 S 85 44, 100 38"
          fill="none"
          stroke="#1e293b"
          strokeWidth="1.2"
        />
        <motion.g
          key={routeKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: REPLAN_MAP_ROUTE_FADE_S, ease: "easeOut" }}
        >
          {hasRoute ? (
            <>
              <path
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={0.22}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={d}
                fill="none"
                stroke="url(#route)"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : null}
          {pois.map((p, idx) => {
            const focused = focusedPoiId != null && p.poi_id === focusedPoiId;
            return (
              <g key={p.poi_id} transform={`translate(${p.map_position.x},${p.map_position.y})`}>
                {focused ? (
                  <motion.circle
                    r="10"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.6"
                    initial={{ opacity: 0.35, scale: 0.85 }}
                    animate={{
                      opacity: [0.35, 0.95, 0.35],
                      scale: [0.85, 1.08, 0.85],
                    }}
                    transition={{ repeat: Infinity, duration: 1.25, ease: "easeInOut" }}
                  />
                ) : null}
                <circle
                  r={focused ? 4.8 : 4.2}
                  fill="#0f172a"
                  stroke={focused ? "#38bdf8" : "#e2e8f0"}
                  strokeWidth={focused ? 1.6 : 1.4}
                />
                <text
                  x="0"
                  y="-8"
                  textAnchor="middle"
                  fill={focused ? "#e0f2fe" : "#94a3b8"}
                  fontSize="7"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {idx + 1}
                </text>
              </g>
            );
          })}
        </motion.g>
      </svg>
    </motion.div>
  );
}
