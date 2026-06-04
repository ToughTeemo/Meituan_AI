import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const DATASET_PATHS = {
  pois: path.join(ROOT_DIR, "docs", "mock", "pois_mock.json"),
  hours: path.join(ROOT_DIR, "docs", "mock", "hours_mock.json"),
  price: path.join(ROOT_DIR, "docs", "mock", "price_mock.json"),
  queue: path.join(ROOT_DIR, "docs", "mock", "queue_mock.json"),
  booking: path.join(ROOT_DIR, "docs", "mock", "booking_mock.json"),
  action: path.join(ROOT_DIR, "docs", "mock", "action_mock.json"),
};

const ALLOWED_POI_TYPES = new Set(["attraction", "restaurant", "cafe", "mall", "entertainment", "transport"]);
const ALLOWED_HOURS_SOURCES = new Set(["amap", "category_estimated_mock", "manual_mock", "unknown"]);
const ALLOWED_PRICE_TYPES = new Set(["free", "ticket", "restaurant_avg", "cafe_avg", "activity_fee"]);
const ALLOWED_BUDGET_LEVELS = new Set(["low", "medium", "high"]);
const ALLOWED_PRICE_SOURCES = new Set(["amap", "category_estimated_mock", "manual_mock", "unknown"]);
const ALLOWED_QUEUE_LEVELS = new Set(["low", "medium", "high", "unknown"]);
const ALLOWED_BOOKING_STATUS = new Set(["not_required", "pending_user_action", "not_supported", "unknown"]);
const ALLOWED_ACTION_TYPES = new Set(["navigation", "share", "reminder", "booking_hint", "copy_address"]);
const REQUIRED_BASE_ACTIONS = ["navigation", "share", "reminder", "copy_address"];

const WEEKDAY_ALIASES = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
  Mon: "Mon",
  Tue: "Tue",
  Wed: "Wed",
  Thu: "Thu",
  Fri: "Fri",
  Sat: "Sat",
  Sun: "Sun",
};

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const QUEUE_FORBIDDEN_WORDS = [
  "realtime",
  "real_time",
  "live",
  "current",
  "\u5f53\u524d\u5b9e\u65f6",
  "\u5b9e\u65f6",
];

export const BOOKING_FORBIDDEN_WORDS = [
  "booked",
  "confirmed",
  "ordered",
  "paid",
  "reserved",
  "purchased",
  "success",
  "\u5df2\u9884\u7ea6",
  "\u5df2\u786e\u8ba4",
  "\u5df2\u8d2d\u7968",
  "\u5df2\u4e0b\u5355",
  "\u5df2\u652f\u4ed8",
  "\u5df2\u8d2d\u4e70",
  "\u9884\u8ba2\u6210\u529f",
  "\u8d2d\u7968\u6210\u529f",
  "\u7cfb\u7edf\u5df2\u4e3a\u4f60\u9884\u7ea6",
  "\u7cfb\u7edf\u5df2\u8d2d\u7968",
  "\u81ea\u52a8\u4e0b\u5355",
  "\u5df2\u5b8c\u6210\u6392\u53f7",
  "\u5df2\u53d6\u53f7",
];

export const ACTION_FORBIDDEN_WORDS = [
  "\u5df2\u9884\u7ea6",
  "\u5df2\u8d2d\u7968",
  "\u5df2\u4e0b\u5355",
  "\u5df2\u652f\u4ed8",
  "\u5df2\u8d2d\u4e70",
  "\u5df2\u5bfc\u822a",
  "\u5df2\u5206\u4eab",
  "\u5df2\u63d0\u9192",
  "\u5df2\u590d\u5236",
  "booked",
  "confirmed",
  "ordered",
  "paid",
  "purchased",
  "reserved",
  "success",
  "auto_book",
  "auto_order",
  "\u81ea\u52a8\u9884\u7ea6",
  "\u81ea\u52a8\u4e0b\u5355",
  "\u81ea\u52a8\u5bfc\u822a",
];

function createReport() {
  return { ok: true, errors: [], warnings: [] };
}

function finishReport(report) {
  report.ok = report.errors.length === 0;
  return report;
}

function mergeReport(target, source) {
  target.errors.push(...source.errors);
  target.warnings.push(...source.warnings);
  return finishReport(target);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isConfidence(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function familyTotal(record) {
  return record.estimated_total_for_family?.["2_adults_1_child"];
}

function recordPrefix(record, fallback = "record") {
  return record?.poi_id ? `${record.poi_id}:` : `${fallback}:`;
}

function requireFields(record, fields, errors, prefix) {
  for (const field of fields) {
    if (!(field in record)) {
      errors.push(`${prefix} missing required field ${field}`);
    }
  }
}

function normalizeForSearch(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return (typeof value === "string" ? value : JSON.stringify(value)).toLowerCase();
}

export function containsForbiddenText(value, forbiddenWords) {
  const text = normalizeForSearch(value);
  return forbiddenWords.some((word) => {
    const normalizedWord = String(word).toLowerCase();
    if (/^[a-z0-9_]+$/.test(normalizedWord)) {
      const escaped = normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9_])${escaped}($|[^a-z0-9_])`).test(text);
    }
    return text.includes(normalizedWord);
  });
}

export function collectDistribution(records, field) {
  const distribution = {};
  for (const record of records) {
    const value = record?.[field] ?? "undefined";
    distribution[value] = (distribution[value] ?? 0) + 1;
  }
  return distribution;
}

function collectActionTypeDistribution(actions) {
  const distribution = {};
  for (const record of actions) {
    for (const action of record.actions ?? []) {
      const type = action.action_type ?? "undefined";
      distribution[type] = (distribution[type] ?? 0) + 1;
    }
  }
  return distribution;
}

export function loadJsonArray(filePath, label = path.basename(filePath)) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`[mock:validate] missing file ${label}: ${filePath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`[mock:validate] invalid JSON in ${label}: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`[mock:validate] ${label} must be a JSON array`);
  }

  return parsed;
}

export function loadMockDatasetFromFiles(paths = DATASET_PATHS) {
  return {
    pois: loadJsonArray(paths.pois, "pois_mock.json"),
    hours: loadJsonArray(paths.hours, "hours_mock.json"),
    price: loadJsonArray(paths.price, "price_mock.json"),
    queue: loadJsonArray(paths.queue, "queue_mock.json"),
    booking: loadJsonArray(paths.booking, "booking_mock.json"),
    action: loadJsonArray(paths.action, "action_mock.json"),
  };
}

export function validateProviderAlignment(providerName, records, pois) {
  const report = createReport();
  const poiIds = new Set(pois.map((poi) => poi.poi_id));
  const seen = new Set();

  if (records.length !== pois.length) {
    report.errors.push(`${providerName} count ${records.length} does not match pois_mock.json count ${pois.length}`);
  }

  for (const record of records) {
    if (!isNonEmptyString(record.poi_id)) {
      report.errors.push(`${providerName} record missing poi_id`);
      continue;
    }

    if (seen.has(record.poi_id)) {
      report.errors.push(`duplicate poi_id in ${providerName}: ${record.poi_id}`);
    }
    seen.add(record.poi_id);

    if (!poiIds.has(record.poi_id)) {
      report.errors.push(`extra poi_id in ${providerName}: ${record.poi_id}`);
    }
  }

  for (const poi of pois) {
    if (!seen.has(poi.poi_id)) {
      report.errors.push(`missing in ${providerName}: ${poi.poi_id}`);
    }
  }

  return finishReport(report);
}

export function validatePoiDataset(pois) {
  const report = createReport();
  const seen = new Set();

  for (const poi of pois) {
    const prefix = recordPrefix(poi, "POI");
    requireFields(
      poi,
      ["poi_id", "name", "type", "category", "district", "address", "latitude", "longitude", "tags", "recommended_duration_minutes", "source"],
      report.errors,
      prefix,
    );

    if (!isNonEmptyString(poi.poi_id)) {
      report.errors.push(`${prefix} poi_id must be a non-empty string`);
    } else if (seen.has(poi.poi_id)) {
      report.errors.push(`duplicate poi_id in pois_mock.json: ${poi.poi_id}`);
    }
    seen.add(poi.poi_id);

    if (!isNonEmptyString(poi.name)) {
      report.errors.push(`${prefix} name must be a non-empty string`);
    }
    if (!ALLOWED_POI_TYPES.has(poi.type)) {
      report.errors.push(`${prefix} invalid type ${poi.type}`);
    }
    if (typeof poi.latitude !== "number" || !Number.isFinite(poi.latitude)) {
      report.errors.push(`${prefix} latitude must be a number`);
    }
    if (typeof poi.longitude !== "number" || !Number.isFinite(poi.longitude)) {
      report.errors.push(`${prefix} longitude must be a number`);
    }
    if (!Array.isArray(poi.tags) || poi.tags.length === 0) {
      report.errors.push(`${prefix} tags must be a non-empty array`);
    }
    if (!(typeof poi.recommended_duration_minutes === "number" && poi.recommended_duration_minutes > 0)) {
      report.errors.push(`${prefix} recommended_duration_minutes must be a positive number`);
    }
    if (!isNonEmptyString(poi.source?.provider)) {
      report.errors.push(`${prefix} source.provider is required`);
    }
    if (poi.source?.provider === "amap" && !isNonEmptyString(poi.external_ids?.amap_poi_id)) {
      report.warnings.push(`${prefix} source.provider is amap but external_ids.amap_poi_id is missing`);
    }
  }

  return finishReport(report);
}

function expandDayExpression(dayExpression) {
  if (!isNonEmptyString(dayExpression)) {
    return new Set();
  }

  const normalized = dayExpression.replace(/\s+/g, "");
  const rangeMatch = normalized.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)-(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
  if (rangeMatch) {
    const start = WEEKDAY_ORDER.indexOf(rangeMatch[1]);
    const end = WEEKDAY_ORDER.indexOf(rangeMatch[2]);
    if (start === -1 || end === -1) {
      return new Set();
    }
    if (start <= end) {
      return new Set(WEEKDAY_ORDER.slice(start, end + 1));
    }
    return new Set([...WEEKDAY_ORDER.slice(start), ...WEEKDAY_ORDER.slice(0, end + 1)]);
  }

  if (WEEKDAY_ALIASES[normalized]) {
    return new Set([WEEKDAY_ALIASES[normalized]]);
  }

  if (normalized === "Everyday" || normalized === "Daily" || normalized === "All") {
    return new Set(WEEKDAY_ORDER);
  }

  return new Set();
}

function normalizeWeekday(day) {
  return WEEKDAY_ALIASES[day] ?? day;
}

export function validateHoursDataset(hours) {
  const report = createReport();

  for (const record of hours) {
    const prefix = recordPrefix(record);
    requireFields(record, ["poi_id", "hours_label", "open_intervals", "closed_days", "last_entry_time", "source", "confidence"], report.errors, prefix);

    if (!isNonEmptyString(record.hours_label)) {
      report.errors.push(`${prefix} hours_label must be a non-empty string`);
    }
    if (!Array.isArray(record.open_intervals) || record.open_intervals.length === 0) {
      report.errors.push(`${prefix} open_intervals must be a non-empty array`);
    } else {
      for (const [index, interval] of record.open_intervals.entries()) {
        const intervalPrefix = `${prefix} open_intervals[${index}]`;
        requireFields(interval, ["day_of_week", "start", "end"], report.errors, intervalPrefix);
      }
    }
    if (!Array.isArray(record.closed_days)) {
      report.errors.push(`${prefix} closed_days must be an array`);
    }
    if (!ALLOWED_HOURS_SOURCES.has(record.source)) {
      report.errors.push(`${prefix} invalid source ${record.source}`);
    }
    if (!isConfidence(record.confidence)) {
      report.errors.push(`${prefix} confidence must be a number from 0 to 1`);
    }

    const openDays = new Set();
    for (const interval of record.open_intervals ?? []) {
      for (const day of expandDayExpression(interval.day_of_week)) {
        openDays.add(day);
      }
    }
    for (const closedDay of record.closed_days ?? []) {
      const normalized = normalizeWeekday(closedDay);
      if (openDays.has(normalized)) {
        report.errors.push(`${prefix} closed_days conflicts with open_intervals: ${closedDay}`);
      }
    }
  }

  return finishReport(report);
}

export function validatePriceDataset(prices, pois) {
  const report = createReport();
  const poiById = new Map(pois.map((poi) => [poi.poi_id, poi]));

  for (const record of prices) {
    const prefix = recordPrefix(record);
    const poi = poiById.get(record.poi_id);
    const total = familyTotal(record);
    requireFields(
      record,
      ["poi_id", "price_type", "currency", "avg_price", "adult_price", "child_price", "estimated_total_for_family", "budget_level", "source", "confidence"],
      report.errors,
      prefix,
    );

    if (!ALLOWED_PRICE_TYPES.has(record.price_type)) {
      report.errors.push(`${prefix} invalid price_type ${record.price_type}`);
    }
    if (record.currency !== "CNY") {
      report.errors.push(`${prefix} currency must be CNY`);
    }
    if (!isNonNegativeNumber(record.avg_price)) {
      report.errors.push(`${prefix} avg_price must be a non-negative number`);
    }
    if (!isNonNegativeNumber(total)) {
      report.errors.push(`${prefix} estimated_total_for_family.2_adults_1_child must be a non-negative number`);
    }
    if (!ALLOWED_BUDGET_LEVELS.has(record.budget_level)) {
      report.errors.push(`${prefix} invalid budget_level ${record.budget_level}`);
    }
    if (!ALLOWED_PRICE_SOURCES.has(record.source)) {
      report.errors.push(`${prefix} invalid source ${record.source}`);
    }
    if (!isConfidence(record.confidence)) {
      report.errors.push(`${prefix} confidence must be a number from 0 to 1`);
    }

    if (poi?.type === "restaurant" && (record.price_type !== "restaurant_avg" || !(record.avg_price > 0) || !(total > 0))) {
      report.errors.push(`${prefix} restaurant price must use restaurant_avg with avg_price and family total > 0`);
    }
    if (poi?.type === "cafe" && (record.price_type !== "cafe_avg" || !(record.avg_price > 0) || !(total > 0))) {
      report.errors.push(`${prefix} cafe price must use cafe_avg with avg_price and family total > 0`);
    }
    if (
      record.price_type === "free" &&
      !(record.avg_price === 0 && record.adult_price === 0 && record.child_price === 0 && total === 0 && record.budget_level === "low")
    ) {
      report.errors.push(`${prefix} free price must have zero prices, zero family total, and low budget_level`);
    }
  }

  return finishReport(report);
}

export function validateQueueDataset(queues) {
  const report = createReport();

  for (const record of queues) {
    const prefix = recordPrefix(record);
    requireFields(record, ["poi_id", "queue_profiles", "default_queue_level", "default_wait_minutes", "reason", "source", "confidence"], report.errors, prefix);

    if (!Array.isArray(record.queue_profiles) || record.queue_profiles.length === 0) {
      report.errors.push(`${prefix} queue_profiles must be a non-empty array`);
    } else {
      for (const [index, profile] of record.queue_profiles.entries()) {
        const profilePrefix = `${prefix} queue_profiles[${index}]`;
        requireFields(profile, ["scenario", "queue_level", "estimated_wait_minutes"], report.errors, profilePrefix);
        if (!ALLOWED_QUEUE_LEVELS.has(profile.queue_level)) {
          report.errors.push(`${profilePrefix} invalid queue_level ${profile.queue_level}`);
        }
        if (!isNonNegativeNumber(profile.estimated_wait_minutes)) {
          report.errors.push(`${profilePrefix} estimated_wait_minutes must be a non-negative number`);
        }
      }
    }
    if (!ALLOWED_QUEUE_LEVELS.has(record.default_queue_level)) {
      report.errors.push(`${prefix} invalid default_queue_level ${record.default_queue_level}`);
    }
    if (!isNonNegativeNumber(record.default_wait_minutes)) {
      report.errors.push(`${prefix} default_wait_minutes must be a non-negative number`);
    }
    if (record.source !== "estimated_mock") {
      report.errors.push(`${prefix} source must be estimated_mock`);
    }
    if (!isConfidence(record.confidence)) {
      report.errors.push(`${prefix} confidence must be a number from 0 to 1`);
    }
    if (!isNonEmptyString(record.reason)) {
      report.errors.push(`${prefix} reason must be a non-empty string`);
    }
    if (containsForbiddenText(record, QUEUE_FORBIDDEN_WORDS)) {
      report.errors.push(`${prefix} contains forbidden text`);
    }
  }

  return finishReport(report);
}

export function validateBookingDataset(bookings) {
  const report = createReport();

  for (const record of bookings) {
    const prefix = recordPrefix(record);
    requireFields(
      record,
      ["poi_id", "booking_required", "booking_supported_by_system", "status", "required_user_action", "booking_hint", "source", "confidence"],
      report.errors,
      prefix,
    );

    if (typeof record.booking_required !== "boolean") {
      report.errors.push(`${prefix} booking_required must be boolean`);
    }
    if (record.booking_supported_by_system !== false) {
      report.errors.push(`${prefix} booking_supported_by_system must be false`);
    }
    if (!ALLOWED_BOOKING_STATUS.has(record.status)) {
      report.errors.push(`${prefix} invalid status ${record.status}`);
    }
    if (record.source !== "stub") {
      report.errors.push(`${prefix} source must be stub`);
    }
    if (!isConfidence(record.confidence)) {
      report.errors.push(`${prefix} confidence must be a number from 0 to 1`);
    }
    if (!isNonEmptyString(record.booking_hint)) {
      report.errors.push(`${prefix} booking_hint must be a non-empty string`);
    }
    if (record.status === "pending_user_action" && !isNonEmptyString(record.required_user_action)) {
      report.errors.push(`${prefix} pending_user_action requires required_user_action`);
    }
    if (containsForbiddenText(record, BOOKING_FORBIDDEN_WORDS)) {
      report.errors.push(`${prefix} contains forbidden text`);
    }
  }

  return finishReport(report);
}

function getAction(record, actionType) {
  return (record.actions ?? []).find((action) => action.action_type === actionType);
}

function parseUriNumber(uri, key) {
  const match = new RegExp(`[?&]${key}=([^&]+)`).exec(uri ?? "");
  return match ? Number(decodeURIComponent(match[1])) : NaN;
}

export function validateActionDataset(actions, pois, bookings) {
  const report = createReport();
  const poiById = new Map(pois.map((poi) => [poi.poi_id, poi]));
  const bookingByPoiId = new Map(bookings.map((booking) => [booking.poi_id, booking]));

  for (const record of actions) {
    const prefix = recordPrefix(record);
    const poi = poiById.get(record.poi_id);
    const booking = bookingByPoiId.get(record.poi_id);
    requireFields(record, ["poi_id", "actions"], report.errors, prefix);

    if (!Array.isArray(record.actions) || record.actions.length === 0) {
      report.errors.push(`${prefix} actions must be a non-empty array`);
      continue;
    }

    const actionTypes = record.actions.map((action) => action.action_type);
    for (const required of REQUIRED_BASE_ACTIONS) {
      if (!actionTypes.includes(required)) {
        report.errors.push(`${prefix} missing required action ${required}`);
      }
    }

    const hasBookingHint = actionTypes.includes("booking_hint");
    if (booking?.status === "pending_user_action" && !hasBookingHint) {
      report.errors.push(`${prefix} pending_user_action missing booking_hint`);
    }
    if (booking?.status !== "pending_user_action" && hasBookingHint) {
      report.errors.push(`${prefix} non-pending booking has booking_hint`);
    }

    for (const [index, action] of record.actions.entries()) {
      const actionPrefix = `${prefix} actions[${index}]`;
      requireFields(action, ["action_type", "label", "requires_user_confirmation"], report.errors, actionPrefix);
      if (!ALLOWED_ACTION_TYPES.has(action.action_type)) {
        report.errors.push(`${actionPrefix} invalid action_type ${action.action_type}`);
      }
      if (action.requires_user_confirmation !== true) {
        report.errors.push(`${actionPrefix} requires_user_confirmation must be true`);
      }
      if (containsForbiddenText(action, ACTION_FORBIDDEN_WORDS)) {
        report.errors.push(`${actionPrefix} contains forbidden text`);
      }
    }

    const navigation = getAction(record, "navigation");
    if (navigation) {
      if (navigation.provider !== "amap_uri") {
        report.errors.push(`${prefix} navigation provider must be amap_uri`);
      }
      if (!isNonEmptyString(navigation.uri)) {
        report.errors.push(`${prefix} navigation uri missing`);
      } else {
        for (const key of ["dlat", "dlon", "dname"]) {
          if (!navigation.uri.includes(`${key}=`)) {
            report.errors.push(`${prefix} navigation uri missing ${key}`);
          }
        }
        if (poi) {
          const dlat = parseUriNumber(navigation.uri, "dlat");
          const dlon = parseUriNumber(navigation.uri, "dlon");
          if (Number.isFinite(dlat) && Math.abs(dlat - poi.latitude) > 0.000001) {
            report.errors.push(`${prefix} navigation dlat does not match POI latitude`);
          }
          if (Number.isFinite(dlon) && Math.abs(dlon - poi.longitude) > 0.000001) {
            report.errors.push(`${prefix} navigation dlon does not match POI longitude`);
          }
        }
      }
    }

    const share = getAction(record, "share");
    if (share && (!share.payload?.title || !share.payload?.content)) {
      report.errors.push(`${prefix} share missing payload.title or payload.content`);
    }

    const reminder = getAction(record, "reminder");
    if (
      reminder &&
      (!reminder.payload?.title || typeof reminder.payload.remind_offset_minutes !== "number" || !reminder.payload?.message)
    ) {
      report.errors.push(`${prefix} reminder missing payload.title, payload.remind_offset_minutes, or payload.message`);
    }

    const copyAddress = getAction(record, "copy_address");
    if (copyAddress) {
      if (!copyAddress.payload?.text) {
        report.errors.push(`${prefix} copy_address missing payload.text`);
      } else if (poi && !String(copyAddress.payload.text).includes(poi.address)) {
        report.errors.push(`${prefix} copy_address does not include POI address`);
      }
    }
  }

  return finishReport(report);
}

export function validateAllMockData(dataset) {
  const report = createReport();
  const providers = [
    ["hours_mock.json", dataset.hours],
    ["price_mock.json", dataset.price],
    ["queue_mock.json", dataset.queue],
    ["booking_mock.json", dataset.booking],
    ["action_mock.json", dataset.action],
  ];

  mergeReport(report, validatePoiDataset(dataset.pois));
  for (const [providerName, records] of providers) {
    mergeReport(report, validateProviderAlignment(providerName, records, dataset.pois));
  }
  mergeReport(report, validateHoursDataset(dataset.hours));
  mergeReport(report, validatePriceDataset(dataset.price, dataset.pois));
  mergeReport(report, validateQueueDataset(dataset.queue));
  mergeReport(report, validateBookingDataset(dataset.booking));
  mergeReport(report, validateActionDataset(dataset.action, dataset.pois, dataset.booking));

  report.distributions = {
    poi_type: collectDistribution(dataset.pois, "type"),
    price_type: collectDistribution(dataset.price, "price_type"),
    budget_level: collectDistribution(dataset.price, "budget_level"),
    queue_default_queue_level: collectDistribution(dataset.queue, "default_queue_level"),
    booking_status: collectDistribution(dataset.booking, "status"),
    action_type: collectActionTypeDistribution(dataset.action),
  };

  return finishReport(report);
}

function printDistribution(label, distribution) {
  console.log(`[mock:validate] ${label}: ${JSON.stringify(distribution)}`);
}

function runCli() {
  let dataset;
  try {
    dataset = loadMockDatasetFromFiles();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`[mock:validate] loaded pois: ${dataset.pois.length}`);
  console.log(`[mock:validate] loaded hours: ${dataset.hours.length}`);
  console.log(`[mock:validate] loaded price: ${dataset.price.length}`);
  console.log(`[mock:validate] loaded queue: ${dataset.queue.length}`);
  console.log(`[mock:validate] loaded booking: ${dataset.booking.length}`);
  console.log(`[mock:validate] loaded action: ${dataset.action.length}`);

  const report = validateAllMockData(dataset);

  if (report.ok) {
    console.log("[mock:validate] poi_id alignment passed");
    console.log("[mock:validate] POI schema passed");
    console.log("[mock:validate] HoursProvider passed");
    console.log("[mock:validate] PriceProvider passed");
    console.log("[mock:validate] QueueProvider passed");
    console.log("[mock:validate] BookingProvider passed");
    console.log("[mock:validate] ActionProvider passed");
  }

  for (const warning of report.warnings) {
    console.warn(`[mock:validate] warning ${warning}`);
  }

  printDistribution("POI type distribution", report.distributions.poi_type);
  printDistribution("price_type distribution", report.distributions.price_type);
  printDistribution("budget_level distribution", report.distributions.budget_level);
  printDistribution("queue default_queue_level distribution", report.distributions.queue_default_queue_level);
  printDistribution("booking status distribution", report.distributions.booking_status);
  printDistribution("action_type distribution", report.distributions.action_type);

  if (!report.ok) {
    for (const error of report.errors) {
      console.error(`[mock:validate] error ${error}`);
    }
    console.error(`[mock:validate] failed with ${report.errors.length} errors`);
    process.exit(1);
  }

  console.log("[mock:validate] all checks passed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
