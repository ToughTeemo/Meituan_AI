import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const POIS_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_mock.json");
const PRICE_PATH = path.join(PROJECT_ROOT, "docs", "mock", "price_mock.json");
const HOURS_PATH = path.join(PROJECT_ROOT, "docs", "mock", "hours_mock.json");
const QUEUE_OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "mock", "queue_mock.json");

export const ALLOWED_QUEUE_LEVELS = new Set(["low", "medium", "high", "unknown"]);
const FORBIDDEN_REALTIME_PATTERN = /realtime|real_time|live|当前实时|实时/i;

function profile(scenario, queueLevel, estimatedWaitMinutes) {
  return {
    scenario,
    queue_level: queueLevel,
    estimated_wait_minutes: estimatedWaitMinutes,
  };
}

function makeQueue(poi, values) {
  return {
    poi_id: poi.poi_id,
    queue_profiles: values.queue_profiles,
    default_queue_level: values.default_queue_level,
    default_wait_minutes: values.default_wait_minutes,
    reason: values.reason,
    source: "estimated_mock",
    confidence: values.confidence,
  };
}

export function getQueueRuleForPoi(poi, priceRecord = null) {
  if (poi.type === "restaurant") {
    const weekendWait = priceRecord?.budget_level === "high" || ["hotpot", "western_food"].includes(poi.category) ? 45 : 40;
    return {
      default_queue_level: "medium",
      default_wait_minutes: 20,
      confidence: 0.56,
      reason: "热门餐厅，午餐、晚餐和周末高峰通常存在等位风险，等待时间为类型估算值",
      queue_profiles: [
        profile("weekday_lunch", "medium", 15),
        profile("weekday_dinner", "medium", 20),
        profile("weekend_dinner", "high", weekendWait),
      ],
    };
  }

  if (poi.type === "cafe") {
    const weekendWait = /拍照|网红|地标/.test([poi.name, ...(poi.tags ?? [])].join(" ")) ? 20 : 15;
    return {
      default_queue_level: "low",
      default_wait_minutes: 5,
      confidence: 0.55,
      reason: "咖啡店周末下午可能出现短时排队，以场所类型和常见客流规律估算",
      queue_profiles: [
        profile("weekday_afternoon", "low", 5),
        profile("weekend_afternoon", "medium", weekendWait),
        profile("weekend_evening", "low", 5),
      ],
    };
  }

  if (poi.category === "museum" || poi.category === "exhibition") {
    return {
      default_queue_level: "medium",
      default_wait_minutes: 15,
      confidence: 0.56,
      reason: "热门文化展馆，周末下午亲子和观展客流较高，等待时间为类型估算值",
      queue_profiles: [
        profile("weekday_afternoon", "medium", 15),
        profile("weekend_afternoon", "high", 35),
        profile("weekend_evening", "medium", 20),
      ],
    };
  }

  if (["aquarium", "family_activity", "indoor_playground"].includes(poi.category)) {
    return {
      default_queue_level: "medium",
      default_wait_minutes: 20,
      confidence: 0.56,
      reason: "亲子室内场馆，周末和节假日下午等待风险较高，等待时间为类型估算值",
      queue_profiles: [
        profile("weekday_afternoon", "medium", 20),
        profile("weekend_afternoon", "high", 45),
        profile("holiday_afternoon", "high", 55),
      ],
    };
  }

  if (poi.type === "mall" || ["park", "landmark", "creative_block"].includes(poi.category)) {
    return {
      default_queue_level: "low",
      default_wait_minutes: 5,
      confidence: 0.55,
      reason: "开放空间或商圈型 POI，无固定排队入口，主要风险是人流拥挤，等待时间为估算值",
      queue_profiles: [
        profile("weekday_afternoon", "low", 5),
        profile("weekend_afternoon", "medium", 15),
        profile("weekend_evening", "medium", 20),
      ],
    };
  }

  if (poi.type === "entertainment") {
    const performanceLike = ["theater", "livehouse", "ktv", "nightlife"].includes(poi.category);
    return {
      default_queue_level: performanceLike ? "medium" : "low",
      default_wait_minutes: performanceLike ? 20 : 5,
      confidence: 0.55,
      reason: performanceLike
        ? "娱乐演出类场馆以场次入场、安检和周末晚间人流为主，等待时间为估算值"
        : "休闲娱乐类场所周末下午可能出现人流集中，等待时间为类型估算值",
      queue_profiles: [
        profile("weekday_afternoon", "low", 5),
        profile("weekend_afternoon", "medium", 20),
        profile("weekend_evening", "high", 35),
      ],
    };
  }

  return {
    default_queue_level: "unknown",
    default_wait_minutes: 0,
    confidence: 0.4,
    reason: "缺少稳定排队数据，仅保留未知估算状态",
    queue_profiles: [
      profile("weekday_afternoon", "unknown", 0),
      profile("weekend_afternoon", "unknown", 0),
      profile("weekend_evening", "unknown", 0),
    ],
  };
}

export function buildQueueProfiles(rule) {
  return rule.queue_profiles.map((item) => ({ ...item }));
}

export function buildQueueForPoi(poi, priceRecord = null, hoursRecord = null) {
  const rule = getQueueRuleForPoi(poi, priceRecord, hoursRecord);
  return makeQueue(poi, {
    ...rule,
    queue_profiles: buildQueueProfiles(rule),
  });
}

function byPoiId(records) {
  return new Map((records ?? []).map((record) => [record.poi_id, record]));
}

export function generateQueueDataset(pois, priceRecords = [], hoursRecords = []) {
  const prices = byPoiId(priceRecords);
  const hours = byPoiId(hoursRecords);
  return pois.map((poi) => buildQueueForPoi(poi, prices.get(poi.poi_id), hours.get(poi.poi_id)));
}

export function validateQueueDataset(queues, pois) {
  const errors = [];
  const poiIds = new Set(pois.map((poi) => poi.poi_id));
  const queueIds = new Set();
  const duplicateIds = new Set();

  if (queues.length !== pois.length) errors.push(`Count mismatch: queues=${queues.length}, pois=${pois.length}`);

  for (const queue of queues) {
    if (queueIds.has(queue.poi_id)) duplicateIds.add(queue.poi_id);
    queueIds.add(queue.poi_id);

    if (!poiIds.has(queue.poi_id)) errors.push(`Unknown poi_id: ${queue.poi_id}`);

    for (const field of [
      "poi_id",
      "queue_profiles",
      "default_queue_level",
      "default_wait_minutes",
      "reason",
      "source",
      "confidence",
    ]) {
      if (queue[field] === undefined || queue[field] === null || queue[field] === "") {
        errors.push(`Missing required field ${field}: ${queue.poi_id}`);
      }
    }

    if (!Array.isArray(queue.queue_profiles) || queue.queue_profiles.length === 0) {
      errors.push(`queue_profiles is empty: ${queue.poi_id}`);
    } else {
      for (const item of queue.queue_profiles) {
        if (!item.scenario) errors.push(`Missing scenario: ${queue.poi_id}`);
        if (!ALLOWED_QUEUE_LEVELS.has(item.queue_level)) errors.push(`Invalid queue_level: ${queue.poi_id} (${item.queue_level})`);
        if (typeof item.estimated_wait_minutes !== "number" || item.estimated_wait_minutes < 0) {
          errors.push(`Invalid estimated_wait_minutes: ${queue.poi_id}`);
        }
      }
    }

    if (!ALLOWED_QUEUE_LEVELS.has(queue.default_queue_level)) {
      errors.push(`Invalid default_queue_level: ${queue.poi_id} (${queue.default_queue_level})`);
    }
    if (typeof queue.default_wait_minutes !== "number" || queue.default_wait_minutes < 0) {
      errors.push(`Invalid default_wait_minutes: ${queue.poi_id}`);
    }
    if (queue.source !== "estimated_mock") errors.push(`source is not estimated_mock: ${queue.poi_id}`);
    if (typeof queue.confidence !== "number" || queue.confidence < 0 || queue.confidence > 1) {
      errors.push(`Invalid confidence: ${queue.poi_id}`);
    }
    if (!queue.reason) errors.push(`Missing reason: ${queue.poi_id}`);
    if (FORBIDDEN_REALTIME_PATTERN.test(generatedQueueText(queue))) {
      errors.push(`forbidden realtime wording: ${queue.poi_id}`);
    }
  }

  for (const poi of pois) {
    if (!queueIds.has(poi.poi_id)) errors.push(`Missing queue for poi_id: ${poi.poi_id}`);
  }
  for (const poiId of duplicateIds) errors.push(`Duplicate poi_id: ${poiId}`);

  return {
    ok: errors.length === 0,
    errors,
    count: queues.length,
    missing_poi_ids: pois.map((poi) => poi.poi_id).filter((poiId) => !queueIds.has(poiId)),
    extra_poi_ids: queues.map((queue) => queue.poi_id).filter((poiId) => !poiIds.has(poiId)),
    duplicate_poi_ids: [...duplicateIds],
  };
}

function generatedQueueText(queue) {
  return JSON.stringify({
    source: queue.source,
    reason: queue.reason,
    default_queue_level: queue.default_queue_level,
    queue_profiles: (queue.queue_profiles ?? []).map((profileItem) => ({
      scenario: profileItem.scenario,
      queue_level: profileItem.queue_level,
    })),
  });
}

async function readJsonIfExists(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function runGenerateQueueMock() {
  const pois = await readJsonIfExists(POIS_PATH, []);
  const prices = await readJsonIfExists(PRICE_PATH, []);
  const hours = await readJsonIfExists(HOURS_PATH, []);
  const queues = generateQueueDataset(pois, prices, hours);

  await writeJson(QUEUE_OUTPUT_PATH, queues);

  const report = validateQueueDataset(queues, pois);
  console.log(`[mock:queue] loaded ${pois.length} POIs`);
  console.log(`[mock:queue] generated ${queues.length} queue records`);

  if (report.ok) {
    console.log("[mock:queue] validation passed");
  } else {
    for (const error of report.errors) console.error(`[mock:queue] error ${error}`);
    process.exitCode = 1;
  }

  return { pois, queues, report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGenerateQueueMock().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
