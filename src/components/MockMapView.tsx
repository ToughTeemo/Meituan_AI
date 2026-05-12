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
  focusedStopIndex: number;
  replanPhase: ReplanPhase;
}

export function MockMapView({
  pois,
  focusedPoiId,
  focusedStopIndex,
  replanPhase,
}: MockMapViewProps) {
  const focusedIndex = pois.findIndex((poi) => poi.poi_id === focusedPoiId);
  const nextIndex =
    focusedIndex >= 0 ? Math.min(pois.length - 1, focusedIndex + 1) : -1;
  const d =
    pois.length === 0
      ? ""
      : `M ${pois.map((poi) => `${poi.map_position.x} ${poi.map_position.y}`).join(" L ")}`;

  const routeKey = useMemo(() => {
    return `${d}|${pois.map((poi) => poi.poi_id).join("|")}`;
  }, [d, pois]);

  const isGenerating = replanPhase === "generating";
  const hasRoute = d.length > 0;

  return (
    <motion.div
      className="overflow-hidden rounded-[1.45rem] border border-[rgba(120,90,60,0.10)] bg-[#FFFDF9] shadow-[0_9px_24px_rgba(120,80,40,0.055)]"
      animate={{ opacity: isGenerating ? REPLAN_MAP_DIM_OPACITY : 1 }}
      transition={{ duration: REPLAN_OVERLAY_FADE_S }}
    >
      <div className="border-b border-[rgba(120,90,60,0.08)] px-4 py-2.5">
        <p className="text-[11px] font-semibold text-[#8A7666]">路线示意图</p>
      </div>
      <svg
        viewBox="0 0 100 100"
        className="block h-[min(26vh,235px)] min-h-[176px] w-full text-[#3C342F]"
        role="img"
        aria-label="路线与地点标记"
      >
        <defs>
          <linearGradient id="warmRoute" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#F2A65A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#B7C9A8" stopOpacity="0.88" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="#FFFDF9" />
        <path d="M0 68 C 25 62, 40 58, 55 52 S 85 44, 100 38" fill="none" stroke="#F7EEDF" strokeWidth="9" />
        <path d="M0 28 C 22 30, 38 24, 58 26 S 84 30, 100 22" fill="none" stroke="#F8F2E8" strokeWidth="7" />
        <path d="M18 0 C 20 24, 24 42, 28 100" fill="none" stroke="#F8F2E8" strokeWidth="5" />
        <path d="M70 0 C 66 26, 68 58, 82 100" fill="none" stroke="#F7EEDF" strokeWidth="6" />

        <text x="12" y="17" fill="#8A5A2F" fontSize="5.3" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
          第 {focusedStopIndex + 1} 站
        </text>
        <text x="68" y="24" fill="#526849" fontSize="5.1" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
          下一站
        </text>
        <text x="43" y="78" fill="#A99482" fontSize="4.8" fontFamily="ui-sans-serif, system-ui">
          步行6分钟
        </text>

        <motion.g
          key={routeKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: REPLAN_MAP_ROUTE_FADE_S, ease: "easeOut" }}
        >
          {hasRoute ? (
            <>
              <path d={d} fill="none" stroke="#F6C65B" strokeOpacity={0.22} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d={d} fill="none" stroke="url(#warmRoute)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : null}
          {pois.map((poi, index) => {
            const focused = focusedPoiId != null && poi.poi_id === focusedPoiId;
            const next = index === nextIndex && !focused;
            return (
              <g key={poi.poi_id} transform={`translate(${poi.map_position.x},${poi.map_position.y})`}>
                {focused ? (
                  <motion.circle
                    r="10"
                    fill="#F6C65B"
                    fillOpacity="0.13"
                    stroke="#F2A65A"
                    strokeWidth="1.4"
                    initial={{ opacity: 0.35, scale: 0.85 }}
                    animate={{ opacity: [0.35, 0.85, 0.35], scale: [0.85, 1.06, 0.85] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  />
                ) : null}
                <circle
                  r={focused ? 5 : next ? 4.7 : 4}
                  fill={focused ? "#F2A65A" : next ? "#B7C9A8" : "#FFF9F2"}
                  stroke={focused ? "#8A5A2F" : next ? "#526849" : "#B7C9A8"}
                  strokeWidth={focused ? 1.5 : 1.2}
                  opacity={focused || next ? 1 : 0.66}
                />
                <text x="0" y="1.8" textAnchor="middle" fill={focused ? "#3C342F" : "#6E6259"} fontSize="5.5" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
                  {index + 1}
                </text>
              </g>
            );
          })}
        </motion.g>
      </svg>
      <div className="flex flex-wrap gap-2 border-t border-[rgba(120,90,60,0.08)] px-4 py-2.5 text-[11px] text-[#8A7666]">
        <span className="rounded-full bg-[#F7EEDF]/70 px-3 py-1">约20分钟到下一站</span>
        <span className="rounded-full bg-[#F7EEDF]/70 px-3 py-1">步行6分钟</span>
        <span className="rounded-full bg-[#EFF5E9] px-3 py-1 text-[#526849]">路线已避开高拥堵段</span>
      </div>
    </motion.div>
  );
}
