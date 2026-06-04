import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const POIS_PATH = path.join(ROOT_DIR, "docs", "mock", "pois_mock.json");
const BOOKING_PATH = path.join(ROOT_DIR, "docs", "mock", "booking_mock.json");
const OUTPUT_PATH = path.join(ROOT_DIR, "docs", "mock", "action_mock.json");

export const ALLOWED_ACTION_TYPES = new Set([
  "navigation",
  "share",
  "reminder",
  "booking_hint",
  "copy_address",
]);

const REQUIRED_BASE_ACTIONS = ["navigation", "share", "reminder", "copy_address"];

const FORBIDDEN_ACTION_TEXT = [
  "已预约",
  "已购票",
  "已下单",
  "已支付",
  "已购买",
  "已导航",
  "已分享",
  "已提醒",
  "已复制",
  "自动预约",
  "自动下单",
  "自动导航",
  "booked",
  "confirmed",
  "ordered",
  "paid",
  "purchased",
  "reserved",
  "success",
  "auto_book",
  "auto_order",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

export function containsForbiddenActionText(value) {
  const text = normalizeText(value).toLowerCase();
  return FORBIDDEN_ACTION_TEXT.some((phrase) => text.includes(phrase.toLowerCase()));
}

function tagsText(poi) {
  return Array.isArray(poi.tags) && poi.tags.length > 0 ? poi.tags.join("、") : "目的地";
}

function hasAnyText(values, candidates) {
  const haystack = values
    .filter(Boolean)
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .join(" ")
    .toLowerCase();

  return candidates.some((candidate) => haystack.includes(candidate.toLowerCase()));
}

function reminderOffsetMinutes(poi) {
  if (hasAnyText([poi.type, poi.category, poi.tags], ["restaurant", "cafe", "coffee", "餐", "咖啡"])) {
    return 20;
  }

  if (
    hasAnyText(
      [poi.type, poi.category, poi.tags, poi.suitable_for],
      [
        "entertainment",
        "theme_park",
        "aquarium",
        "museum",
        "indoor_playground",
        "family",
        "kids",
        "亲子",
        "乐园",
        "水族馆",
        "博物馆",
        "主题",
      ],
    )
  ) {
    return 60;
  }

  return 30;
}

export function buildNavigationAction(poi) {
  return {
    action_type: "navigation",
    label: `导航到${poi.name}`,
    provider: "amap_uri",
    uri: `amapuri://route/plan/?dlat=${poi.latitude}&dlon=${poi.longitude}&dname=${encodeURIComponent(
      poi.name,
    )}&dev=0&t=0`,
    requires_user_confirmation: true,
  };
}

function buildShareAction(poi) {
  return {
    action_type: "share",
    label: "分享地点",
    payload: {
      title: poi.name,
      content: `推荐地点：${poi.name}；地址：${poi.address}；标签：${tagsText(poi)}`,
    },
    requires_user_confirmation: true,
  };
}

function buildReminderAction(poi) {
  const offset = reminderOffsetMinutes(poi);

  return {
    action_type: "reminder",
    label: "设置出发提醒",
    payload: {
      title: `准备出发：${poi.name}`,
      remind_offset_minutes: offset,
      message: `建议提前 ${offset} 分钟准备出发，出行前确认路线、营业时间和现场要求。`,
    },
    requires_user_confirmation: true,
  };
}

function buildCopyAddressAction(poi) {
  return {
    action_type: "copy_address",
    label: "复制地址",
    payload: {
      text: poi.address,
    },
    requires_user_confirmation: true,
  };
}

function buildBookingHintAction(booking) {
  return {
    action_type: "booking_hint",
    label: "查看预约提示",
    payload: {
      required_user_action: booking.required_user_action,
      booking_hint: booking.booking_hint,
    },
    requires_user_confirmation: true,
  };
}

export function buildActionsForPoi(poi, booking) {
  const actions = [
    buildNavigationAction(poi),
    buildShareAction(poi),
    buildReminderAction(poi),
    buildCopyAddressAction(poi),
  ];

  if (booking?.status === "pending_user_action") {
    actions.push(buildBookingHintAction(booking));
  }

  return actions;
}

export function generateActionDataset(pois, bookings) {
  const bookingByPoiId = new Map(bookings.map((booking) => [booking.poi_id, booking]));

  return pois.map((poi) => ({
    poi_id: poi.poi_id,
    actions: buildActionsForPoi(poi, bookingByPoiId.get(poi.poi_id)),
  }));
}

function validateNavigationAction(action, poi, errors, prefix) {
  if (typeof poi.latitude !== "number" || typeof poi.longitude !== "number") {
    errors.push(`${prefix} navigation source POI missing latitude/longitude`);
  }

  if (action.provider !== "amap_uri") {
    errors.push(`${prefix} navigation provider is not amap_uri`);
  }

  if (!action.uri) {
    errors.push(`${prefix} navigation missing uri`);
    return;
  }

  for (const part of ["dlat=", "dlon=", "dname="]) {
    if (!action.uri.includes(part)) {
      errors.push(`${prefix} navigation uri missing ${part}`);
    }
  }
}

function validateActionPayload(action, errors, prefix) {
  if (action.action_type === "share") {
    if (!action.payload?.title || !action.payload?.content) {
      errors.push(`${prefix} share missing payload title/content`);
    }
  }

  if (action.action_type === "reminder") {
    if (
      !action.payload?.title ||
      typeof action.payload.remind_offset_minutes !== "number" ||
      !action.payload?.message
    ) {
      errors.push(`${prefix} reminder missing payload title/remind_offset_minutes/message`);
    }
  }

  if (action.action_type === "copy_address") {
    if (!action.payload?.text) {
      errors.push(`${prefix} copy_address missing payload.text`);
    }
  }

  if (action.action_type === "booking_hint") {
    if (!action.payload?.required_user_action || !action.payload?.booking_hint) {
      errors.push(`${prefix} booking_hint missing payload required_user_action/booking_hint`);
    }
  }
}

export function validateActionDataset(records, pois, bookings) {
  const errors = [];
  const poiById = new Map(pois.map((poi) => [poi.poi_id, poi]));
  const bookingByPoiId = new Map(bookings.map((booking) => [booking.poi_id, booking]));
  const seenPoiIds = new Set();

  if (records.length !== pois.length) {
    errors.push(`Count mismatch: action records ${records.length}, POIs ${pois.length}`);
  }

  for (const record of records) {
    if (!record.poi_id) {
      errors.push("Record missing poi_id");
      continue;
    }

    const prefix = `${record.poi_id}:`;
    const poi = poiById.get(record.poi_id);
    const booking = bookingByPoiId.get(record.poi_id);

    if (seenPoiIds.has(record.poi_id)) {
      errors.push(`Duplicate poi_id: ${record.poi_id}`);
    }
    seenPoiIds.add(record.poi_id);

    if (!poi) {
      errors.push(`Unknown poi_id: ${record.poi_id}`);
    }

    if (!Array.isArray(record.actions)) {
      errors.push(`${prefix} actions is not an array`);
      continue;
    }

    if (record.actions.length === 0) {
      errors.push(`${prefix} actions is empty`);
      continue;
    }

    const actionTypes = record.actions.map((action) => action.action_type);
    for (const requiredType of REQUIRED_BASE_ACTIONS) {
      if (!actionTypes.includes(requiredType)) {
        errors.push(`${prefix} missing required action ${requiredType}`);
      }
    }

    const hasBookingHint = actionTypes.includes("booking_hint");
    if (booking?.status === "pending_user_action" && !hasBookingHint) {
      errors.push(`${prefix} pending_user_action missing booking_hint`);
    }
    if (booking?.status !== "pending_user_action" && hasBookingHint) {
      errors.push(`${prefix} non-pending booking generated booking_hint`);
    }

    for (const [index, action] of record.actions.entries()) {
      const actionPrefix = `${prefix} action[${index}]`;

      if (!action.action_type) {
        errors.push(`${actionPrefix} missing action_type`);
      }
      if (!action.label) {
        errors.push(`${actionPrefix} missing label`);
      }
      if (!ALLOWED_ACTION_TYPES.has(action.action_type)) {
        errors.push(`${actionPrefix} unsupported action_type ${action.action_type}`);
      }
      if (action.requires_user_confirmation !== true) {
        errors.push(`${actionPrefix} requires_user_confirmation is not true`);
      }
      if (containsForbiddenActionText(action)) {
        errors.push(`${actionPrefix} contains forbidden completed/automated action text`);
      }

      if (action.action_type === "navigation" && poi) {
        validateNavigationAction(action, poi, errors, actionPrefix);
      }
      validateActionPayload(action, errors, actionPrefix);
    }
  }

  for (const poi of pois) {
    if (!seenPoiIds.has(poi.poi_id)) {
      errors.push(`Missing action record for POI: ${poi.poi_id}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function generateActionMock({
  poisPath = POIS_PATH,
  bookingPath = BOOKING_PATH,
  outputPath = OUTPUT_PATH,
} = {}) {
  const pois = readJson(poisPath);
  const bookings = readJson(bookingPath);
  const records = generateActionDataset(pois, bookings);
  const report = validateActionDataset(records, pois, bookings);

  console.log(`[mock:action] loaded ${pois.length} POIs`);
  console.log(`[mock:action] loaded ${bookings.length} booking records`);
  console.log(`[mock:action] generated ${records.length} action records`);

  if (!report.ok) {
    for (const error of report.errors) {
      console.error(`[mock:action] error ${error}`);
    }
    throw new Error(`Validation failed with ${report.errors.length} error(s)`);
  }

  writeJson(outputPath, records);
  console.log("[mock:action] validation passed");

  return records;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    generateActionMock();
  } catch (error) {
    console.error(`[mock:action] error ${error.message}`);
    process.exit(1);
  }
}
