import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const POIS_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_mock.json");
const RAW_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_amap_raw.json");
const HOURS_OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "mock", "hours_mock.json");

export const ALLOWED_HOURS_SOURCES = new Set([
  "amap",
  "category_estimated_mock",
  "manual_mock",
  "unknown",
]);

function hasTag(poi, tag) {
  return Array.isArray(poi.tags) && poi.tags.some((value) => String(value).includes(tag));
}

function interval(dayOfWeek, start, end) {
  return { day_of_week: dayOfWeek, start, end };
}

function makeHours(poi, values) {
  return {
    poi_id: poi.poi_id,
    hours_label: values.hours_label,
    open_intervals: values.open_intervals,
    closed_days: values.closed_days,
    last_entry_time: values.last_entry_time,
    source: values.source,
    confidence: values.confidence,
  };
}

function findValuesByKey(value, keyPattern, results = []) {
  if (!value || typeof value !== "object") return results;

  if (Array.isArray(value)) {
    for (const item of value) findValuesByKey(item, keyPattern, results);
    return results;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (keyPattern.test(key) && typeof nested === "string" && nested.trim()) {
      results.push(nested.trim());
    }
    findValuesByKey(nested, keyPattern, results);
  }

  return results;
}

function selectedRawPoi(rawRecord) {
  if (!rawRecord) return null;

  const selectedId = rawRecord.selected_amap_poi_id;
  const attempts = Array.isArray(rawRecord.attempts) ? rawRecord.attempts : [];
  for (const attempt of attempts) {
    const pois = attempt.response?.pois;
    if (!Array.isArray(pois)) continue;

    if (selectedId) {
      const exact = pois.find((poi) => poi.id === selectedId);
      if (exact) return exact;
    }
    if (pois[0]) return pois[0];
  }

  return null;
}

function firstTimeRange(text) {
  const match = String(text).match(/(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  return { start: normalizeTime(match[1]), end: normalizeTime(match[2]) };
}

function normalizeTime(time) {
  const [hour, minute] = time.split(":");
  return `${hour.padStart(2, "0")}:${minute}`;
}

function lastEntryTime(text) {
  const match = String(text).match(/最晚(?:进入|入园|入场|进场)\s*(\d{1,2}:\d{2})/);
  return match ? normalizeTime(match[1]) : null;
}

function textSegments(text) {
  return String(text)
    .split(/[；;。]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function closedDaysFromText(text) {
  const closed = [];
  const weekdays = [
    ["周一", "Monday"],
    ["周二", "Tuesday"],
    ["周三", "Wednesday"],
    ["周四", "Thursday"],
    ["周五", "Friday"],
    ["周六", "Saturday"],
    ["周日", "Sunday"],
  ];

  for (const [cnDay, enDay] of weekdays) {
    for (const segment of textSegments(text)) {
      const pattern = new RegExp(`${cnDay}[^；。;]*?(全天不开放|不开放|闭馆)`);
      const tersePattern = new RegExp(`${cnDay}闭馆`);
      if (pattern.test(segment) || tersePattern.test(segment)) {
        closed.push(enDay);
        break;
      }
    }
  }
  return closed;
}

function openDayRangeFromText(text) {
  const openSegment = textSegments(text).find((segment) => firstTimeRange(segment) && !/(不开放|闭馆)/.test(segment));
  const source = openSegment ?? text;

  const directRanges = [
    [/周一(?:至|-|到)周日/, "Mon-Sun"],
    [/周二(?:至|-|到)周日/, "Tue-Sun"],
    [/周一(?:至|-|到)周六/, "Mon-Sat"],
    [/周一(?:至|-|到)周五/, "Mon-Fri"],
    [/周六(?:至|-|到)周日/, "Sat-Sun"],
  ];

  for (const [pattern, label] of directRanges) {
    if (pattern.test(source)) return label;
  }

  if (/全年无休|每天|每日/.test(text)) return "Mon-Sun";

  return null;
}

function dayOfWeekFromText(text, closedDays) {
  const explicitRange = openDayRangeFromText(text);
  if (explicitRange) return explicitRange;

  if (closedDays.includes("Monday") && /周二/.test(text) && /周日/.test(text)) return "Tue-Sun";
  if (closedDays.length === 1) {
    const labels = {
      Tuesday: "Mon,Wed-Sun",
      Wednesday: "Mon-Tue,Thu-Sun",
      Thursday: "Mon-Wed,Fri-Sun",
      Friday: "Mon-Thu,Sat-Sun",
      Saturday: "Mon-Fri,Sun",
      Sunday: "Mon-Sat",
    };
    return labels[closedDays[0]] ?? "Mon-Sun";
  }
  return "Mon-Sun";
}

function hasComplexAmapSchedule(text) {
  const timedOpenSegments = textSegments(text).filter((segment) => firstTimeRange(segment) && !/(不开放|闭馆)/.test(segment));
  const uniqueRanges = new Set(timedOpenSegments.map((segment) => {
    const range = firstTimeRange(segment);
    return `${range.start}-${range.end}`;
  }));

  return uniqueRanges.size > 1 || /节|假日|春节|国庆|端午|中秋|劳动/.test(text);
}

export function parseAmapHours(rawPoi) {
  if (!rawPoi) return null;

  const candidates = [
    ...findValuesByKey(rawPoi, /^opentime/i),
    ...findValuesByKey(rawPoi, /^open_time$/i),
  ];
  const text = candidates.find((value) => firstTimeRange(value));
  if (!text) return null;
  if (hasComplexAmapSchedule(text)) return null;

  const range = firstTimeRange(text);
  const closedDays = closedDaysFromText(text);

  return {
    hours_label: `${range.start}-${range.end}`,
    open_intervals: [interval(dayOfWeekFromText(text, closedDays), range.start, range.end)],
    closed_days: closedDays,
    last_entry_time: lastEntryTime(text),
    source: "amap",
    confidence: 0.9,
  };
}

function categoryEstimate(poi) {
  if (poi.category === "museum") {
    return {
      hours_label: "09:00-17:00",
      open_intervals: [interval("Tue-Sun", "09:00", "17:00")],
      closed_days: ["Monday"],
      last_entry_time: "16:00",
      source: "category_estimated_mock",
      confidence: 0.75,
    };
  }

  if (poi.category === "exhibition" || hasTag(poi, "展览") || hasTag(poi, "艺术")) {
    return {
      hours_label: "10:00-18:00",
      open_intervals: [interval("Tue-Sun", "10:00", "18:00")],
      closed_days: ["Monday"],
      last_entry_time: "17:00",
      source: "category_estimated_mock",
      confidence: 0.75,
    };
  }

  if (poi.category === "park") {
    return {
      hours_label: "05:00-21:00",
      open_intervals: [interval("Mon-Sun", "05:00", "21:00")],
      closed_days: [],
      last_entry_time: "20:00",
      source: "category_estimated_mock",
      confidence: 0.7,
    };
  }

  if (poi.category === "landmark" || hasTag(poi, "地标")) {
    return {
      hours_label: "全天开放",
      open_intervals: [interval("Mon-Sun", "00:00", "24:00")],
      closed_days: [],
      last_entry_time: null,
      source: "category_estimated_mock",
      confidence: 0.65,
    };
  }

  if (poi.type === "restaurant") {
    return {
      hours_label: "11:00-21:30",
      open_intervals: [interval("Mon-Sun", "11:00", "21:30")],
      closed_days: [],
      last_entry_time: null,
      source: "category_estimated_mock",
      confidence: 0.7,
    };
  }

  if (poi.type === "cafe") {
    return {
      hours_label: "08:00-21:00",
      open_intervals: [interval("Mon-Sun", "08:00", "21:00")],
      closed_days: [],
      last_entry_time: null,
      source: "category_estimated_mock",
      confidence: 0.7,
    };
  }

  if (poi.type === "mall") {
    return {
      hours_label: "10:00-22:00",
      open_intervals: [interval("Mon-Sun", "10:00", "22:00")],
      closed_days: [],
      last_entry_time: null,
      source: "category_estimated_mock",
      confidence: 0.75,
    };
  }

  if (poi.category === "theater" || poi.category === "livehouse") {
    return {
      hours_label: "以演出场次为准",
      open_intervals: [interval("Mon-Sun", "10:00", "22:00")],
      closed_days: [],
      last_entry_time: null,
      source: "category_estimated_mock",
      confidence: 0.55,
    };
  }

  if (
    poi.type === "entertainment" ||
    ["family_activity", "indoor_playground", "aquarium", "ktv", "nightlife"].includes(poi.category)
  ) {
    return {
      hours_label: "10:00-21:00",
      open_intervals: [interval("Mon-Sun", "10:00", "21:00")],
      closed_days: [],
      last_entry_time: "20:00",
      source: "category_estimated_mock",
      confidence: 0.7,
    };
  }

  return {
    hours_label: "营业时间待确认",
    open_intervals: [],
    closed_days: [],
    last_entry_time: null,
    source: "unknown",
    confidence: 0.4,
  };
}

export function buildHoursForPoi(poi, rawRecord = null) {
  const rawHours = parseAmapHours(selectedRawPoi(rawRecord));
  if (rawHours) return makeHours(poi, rawHours);

  return makeHours(poi, categoryEstimate(poi));
}

function rawRecordsByPoiId(rawRecords) {
  const map = new Map();
  for (const record of rawRecords ?? []) {
    const poiId = record.seed?.poi_id;
    if (poiId) map.set(poiId, record);
  }
  return map;
}

export function generateHoursDataset(pois, rawRecords = []) {
  const rawByPoiId = rawRecordsByPoiId(rawRecords);
  return pois.map((poi) => buildHoursForPoi(poi, rawByPoiId.get(poi.poi_id)));
}

export function validateHoursDataset(hours, pois) {
  const errors = [];
  const warnings = [];
  const poiIds = new Set(pois.map((poi) => poi.poi_id));
  const hoursIds = new Set();
  const duplicateIds = new Set();

  if (hours.length !== pois.length) {
    errors.push(`Count mismatch: hours=${hours.length}, pois=${pois.length}`);
  }

  for (const item of hours) {
    if (hoursIds.has(item.poi_id)) duplicateIds.add(item.poi_id);
    hoursIds.add(item.poi_id);

    if (!poiIds.has(item.poi_id)) errors.push(`Unknown poi_id: ${item.poi_id}`);

    for (const field of ["poi_id", "hours_label", "open_intervals", "closed_days", "source", "confidence"]) {
      if (item[field] === undefined || item[field] === null || item[field] === "") {
        errors.push(`Missing required field ${field}: ${item.poi_id}`);
      }
    }

    if (!Array.isArray(item.open_intervals)) {
      errors.push(`Invalid open_intervals: ${item.poi_id}`);
    } else {
      for (const openInterval of item.open_intervals) {
        if (!openInterval.day_of_week || !openInterval.start || !openInterval.end) {
          errors.push(`Invalid open_intervals item: ${item.poi_id}`);
        }
      }
    }

    if (!Array.isArray(item.closed_days)) errors.push(`Invalid closed_days: ${item.poi_id}`);
    if (Array.isArray(item.closed_days) && Array.isArray(item.open_intervals)) {
      const conflictingDays = item.closed_days.filter((closedDay) =>
        item.open_intervals.some((openInterval) => dayRangeIncludes(openInterval.day_of_week, closedDay)),
      );
      if (conflictingDays.length > 0) {
        warnings.push(`closed_days conflicts with open_intervals: ${item.poi_id}`);
      }
    }
    if (!ALLOWED_HOURS_SOURCES.has(item.source)) errors.push(`Invalid source: ${item.poi_id} (${item.source})`);
    if (typeof item.confidence !== "number" || item.confidence < 0 || item.confidence > 1) {
      errors.push(`Invalid confidence: ${item.poi_id}`);
    }
  }

  for (const poi of pois) {
    if (!hoursIds.has(poi.poi_id)) errors.push(`Missing hours for poi_id: ${poi.poi_id}`);
  }

  for (const poiId of duplicateIds) errors.push(`Duplicate poi_id: ${poiId}`);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    count: hours.length,
    missing_poi_ids: pois.map((poi) => poi.poi_id).filter((poiId) => !hoursIds.has(poiId)),
    extra_poi_ids: hours.map((item) => item.poi_id).filter((poiId) => !poiIds.has(poiId)),
    duplicate_poi_ids: [...duplicateIds],
  };
}

function dayRangeIncludes(dayRange, weekday) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const aliases = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  const text = String(dayRange ?? "");

  for (const part of text.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map((value) => aliases[value.trim()] ?? value.trim());
      const startIndex = days.indexOf(start);
      const endIndex = days.indexOf(end);
      if (startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex) {
        const included = days.slice(startIndex, endIndex + 1);
        if (included.includes(weekday)) return true;
      }
      continue;
    }

    const normalized = aliases[trimmed] ?? trimmed;
    if (normalized === weekday) return true;
  }

  return false;
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

export async function runGenerateHoursMock() {
  const pois = await readJsonIfExists(POIS_PATH, []);
  const raw = await readJsonIfExists(RAW_PATH, { responses: [] });
  const rawRecords = Array.isArray(raw.responses) ? raw.responses : [];
  const hours = generateHoursDataset(pois, rawRecords);

  await writeJson(HOURS_OUTPUT_PATH, hours);

  const report = validateHoursDataset(hours, pois);
  console.log(`[mock:hours] loaded ${pois.length} POIs`);
  console.log(`[mock:hours] generated ${hours.length} hours records`);

  if (report.ok) {
    console.log("[mock:hours] validation passed");
  } else {
    for (const error of report.errors) console.error(`[mock:hours] error ${error}`);
    process.exitCode = 1;
  }
  for (const warning of report.warnings) {
    console.warn(`[mock:hours] warning ${warning}`);
  }

  return { pois, hours, report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGenerateHoursMock().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
