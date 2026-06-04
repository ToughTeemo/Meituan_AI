import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const POIS_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_mock.json");
const PRICE_PATH = path.join(PROJECT_ROOT, "docs", "mock", "price_mock.json");
const HOURS_PATH = path.join(PROJECT_ROOT, "docs", "mock", "hours_mock.json");
const QUEUE_PATH = path.join(PROJECT_ROOT, "docs", "mock", "queue_mock.json");
const BOOKING_OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "mock", "booking_mock.json");

export const ALLOWED_BOOKING_STATUSES = new Set([
  "not_required",
  "pending_user_action",
  "not_supported",
  "unknown",
]);

const FORBIDDEN_BOOKING_PATTERN =
  /booked|confirmed|ordered|paid|reserved|purchased|success|已预约|已确认|已购票|已下单|已支付|已购买|预订成功|购票成功|系统已为你预约|系统已购票|自动下单|已完成排号|已取号/i;

export function containsForbiddenBookingState(value) {
  return FORBIDDEN_BOOKING_PATTERN.test(String(value ?? ""));
}

function makeBooking(poi, values) {
  return {
    poi_id: poi.poi_id,
    booking_required: values.booking_required,
    booking_supported_by_system: false,
    status: values.status,
    required_user_action: values.required_user_action,
    booking_hint: values.booking_hint,
    source: "stub",
    confidence: values.confidence,
  };
}

function hasTag(poi, tag) {
  return Array.isArray(poi.tags) && poi.tags.some((value) => String(value).includes(tag));
}

export function getBookingRuleForPoi(poi, priceRecord = null, queueRecord = null) {
  if (poi.category === "museum" || poi.category === "exhibition" || hasTag(poi, "展览") || hasTag(poi, "艺术")) {
    return {
      booking_required: true,
      status: "pending_user_action",
      required_user_action: "前往官方渠道预约",
      booking_hint: "热门文化展馆建议提前预约，当前系统仅提供预约提醒，不代为预约。",
      confidence: 0.65,
    };
  }

  if (["aquarium", "family_activity", "indoor_playground"].includes(poi.category) || hasTag(poi, "亲子")) {
    return {
      booking_required: true,
      status: "pending_user_action",
      required_user_action: "前往官方渠道购票或预约",
      booking_hint: "亲子或室内场馆周末客流较高，建议提前确认票务或预约要求。",
      confidence: 0.65,
    };
  }

  if (poi.type === "entertainment" && ["theater", "livehouse", "ktv", "nightlife"].includes(poi.category)) {
    return {
      booking_required: true,
      status: "pending_user_action",
      required_user_action: "前往官方渠道确认场次或预约",
      booking_hint: "娱乐演出类场所以场次、票务或包厢预约为准，当前系统不支持代预约。",
      confidence: 0.6,
    };
  }

  if (poi.type === "restaurant") {
    return {
      booking_required: false,
      status: "not_required",
      required_user_action: "无需预约，可直接前往；高峰期建议提前咨询商户。",
      booking_hint: "餐厅通常可直接前往，但晚餐和周末高峰可能需要等位，当前系统不支持代订座。",
      confidence: 0.65,
    };
  }

  if (poi.type === "cafe") {
    return {
      booking_required: false,
      status: "not_required",
      required_user_action: "无需预约，可直接前往。",
      booking_hint: "咖啡店通常无需预约，周末下午可能短时排队。",
      confidence: 0.7,
    };
  }

  if (poi.type === "mall" || ["park", "landmark", "creative_block"].includes(poi.category)) {
    return {
      booking_required: false,
      status: "not_required",
      required_user_action: "无需预约，可直接前往。",
      booking_hint: "开放空间或商圈型 POI 通常无需预约，主要风险是人流拥挤。",
      confidence: 0.7,
    };
  }

  if (poi.type === "entertainment") {
    return {
      booking_required: true,
      status: "not_supported",
      required_user_action: "当前系统不支持代预约，请自行确认。",
      booking_hint: "休闲娱乐场所可能存在外部预约或票务要求，当前系统仅提供提示，不代为预约。",
      confidence: 0.55,
    };
  }

  return {
    booking_required: false,
    status: "unknown",
    required_user_action: "当前系统不支持代预约，请自行确认。",
    booking_hint: "缺少稳定预约规则，仅保留提示信息，请自行确认是否需要预约。",
    confidence: 0.4,
  };
}

export function buildBookingForPoi(poi, priceRecord = null, hoursRecord = null, queueRecord = null) {
  return makeBooking(poi, getBookingRuleForPoi(poi, priceRecord, queueRecord));
}

function byPoiId(records) {
  return new Map((records ?? []).map((record) => [record.poi_id, record]));
}

export function generateBookingDataset(pois, priceRecords = [], hoursRecords = [], queueRecords = []) {
  const prices = byPoiId(priceRecords);
  const hours = byPoiId(hoursRecords);
  const queues = byPoiId(queueRecords);
  return pois.map((poi) => buildBookingForPoi(poi, prices.get(poi.poi_id), hours.get(poi.poi_id), queues.get(poi.poi_id)));
}

function generatedBookingText(booking) {
  return JSON.stringify({
    booking_supported_by_system: booking.booking_supported_by_system,
    status: booking.status,
    required_user_action: booking.required_user_action,
    booking_hint: booking.booking_hint,
    source: booking.source,
  });
}

export function validateBookingDataset(bookings, pois) {
  const errors = [];
  const poiIds = new Set(pois.map((poi) => poi.poi_id));
  const bookingIds = new Set();
  const duplicateIds = new Set();

  if (bookings.length !== pois.length) errors.push(`Count mismatch: bookings=${bookings.length}, pois=${pois.length}`);

  for (const booking of bookings) {
    if (bookingIds.has(booking.poi_id)) duplicateIds.add(booking.poi_id);
    bookingIds.add(booking.poi_id);

    if (!poiIds.has(booking.poi_id)) errors.push(`Unknown poi_id: ${booking.poi_id}`);

    for (const field of [
      "poi_id",
      "booking_required",
      "booking_supported_by_system",
      "status",
      "required_user_action",
      "booking_hint",
      "source",
      "confidence",
    ]) {
      if (booking[field] === undefined || booking[field] === null || booking[field] === "") {
        errors.push(`Missing required field ${field}: ${booking.poi_id}`);
      }
    }

    if (typeof booking.booking_required !== "boolean") errors.push(`booking_required is not boolean: ${booking.poi_id}`);
    if (booking.booking_supported_by_system !== false) {
      errors.push(`booking_supported_by_system is not false: ${booking.poi_id}`);
    }
    if (!ALLOWED_BOOKING_STATUSES.has(booking.status)) errors.push(`Invalid status: ${booking.poi_id} (${booking.status})`);
    if (booking.source !== "stub") errors.push(`source is not stub: ${booking.poi_id}`);
    if (typeof booking.confidence !== "number" || booking.confidence < 0 || booking.confidence > 1) {
      errors.push(`Invalid confidence: ${booking.poi_id}`);
    }
    if (!booking.booking_hint) errors.push(`Missing booking_hint: ${booking.poi_id}`);
    if (booking.status === "pending_user_action" && !booking.required_user_action) {
      errors.push(`pending_user_action missing required_user_action: ${booking.poi_id}`);
    }
    if (containsForbiddenBookingState(generatedBookingText(booking))) {
      errors.push(`forbidden booking state: ${booking.poi_id}`);
    }
  }

  for (const poi of pois) {
    if (!bookingIds.has(poi.poi_id)) errors.push(`Missing booking for poi_id: ${poi.poi_id}`);
  }
  for (const poiId of duplicateIds) errors.push(`Duplicate poi_id: ${poiId}`);

  return {
    ok: errors.length === 0,
    errors,
    count: bookings.length,
    missing_poi_ids: pois.map((poi) => poi.poi_id).filter((poiId) => !bookingIds.has(poiId)),
    extra_poi_ids: bookings.map((booking) => booking.poi_id).filter((poiId) => !poiIds.has(poiId)),
    duplicate_poi_ids: [...duplicateIds],
  };
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

export async function runGenerateBookingMock() {
  const pois = await readJsonIfExists(POIS_PATH, []);
  const prices = await readJsonIfExists(PRICE_PATH, []);
  const hours = await readJsonIfExists(HOURS_PATH, []);
  const queues = await readJsonIfExists(QUEUE_PATH, []);
  const bookings = generateBookingDataset(pois, prices, hours, queues);

  await writeJson(BOOKING_OUTPUT_PATH, bookings);

  const report = validateBookingDataset(bookings, pois);
  console.log(`[mock:booking] loaded ${pois.length} POIs`);
  console.log(`[mock:booking] generated ${bookings.length} booking records`);

  if (report.ok) {
    console.log("[mock:booking] validation passed");
  } else {
    for (const error of report.errors) console.error(`[mock:booking] error ${error}`);
    process.exitCode = 1;
  }

  return { pois, bookings, report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGenerateBookingMock().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
