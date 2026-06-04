import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const POIS_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_mock.json");
const RAW_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_amap_raw.json");
const PRICE_OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "mock", "price_mock.json");

export const ALLOWED_PRICE_TYPES = new Set(["free", "ticket", "restaurant_avg", "cafe_avg", "activity_fee"]);
export const ALLOWED_BUDGET_LEVELS = new Set(["low", "medium", "high"]);
export const ALLOWED_PRICE_SOURCES = new Set(["amap", "category_estimated_mock", "manual_mock", "unknown"]);

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Array.isArray(value) ? value[0] : value;
  const match = String(normalized).match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function findValuesByKey(value, keyPattern, results = []) {
  if (!value || typeof value !== "object") return results;

  if (Array.isArray(value)) {
    for (const item of value) findValuesByKey(item, keyPattern, results);
    return results;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (keyPattern.test(key)) results.push(nested);
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

export function extractAmapCost(poi, rawRecord = null) {
  const poiCost = numberOrNull(poi?.amap?.cost);
  if (poiCost !== null) return poiCost;

  const rawPoi = selectedRawPoi(rawRecord);
  const rawCost = findValuesByKey(rawPoi, /^cost$/i).map(numberOrNull).find((value) => value !== null);
  return rawCost ?? null;
}

export function classifyBudgetLevel(familyTotal) {
  if (familyTotal <= 100) return "low";
  if (familyTotal <= 350) return "medium";
  return "high";
}

export function calculateFamilyTotal(priceRecord) {
  if (priceRecord.price_type === "free") return 0;
  if (priceRecord.price_type === "restaurant_avg") return Math.round(priceRecord.avg_price * 2.5);
  if (priceRecord.price_type === "cafe_avg") return Math.round(priceRecord.avg_price * 3);
  if (priceRecord.price_type === "ticket") {
    const childPrice = priceRecord.child_price ?? priceRecord.adult_price;
    return Math.round(priceRecord.adult_price * 2 + childPrice);
  }
  if (priceRecord.price_type === "activity_fee") {
    if (priceRecord.adult_price !== null && priceRecord.child_price !== null) {
      return Math.round(priceRecord.adult_price * 2 + priceRecord.child_price);
    }
    return Math.round(priceRecord.avg_price * 3);
  }
  return Math.round((priceRecord.avg_price ?? 0) * 3);
}

function baseRecord(poi, values) {
  const familyTotal = calculateFamilyTotal(values);
  return {
    poi_id: poi.poi_id,
    price_type: values.price_type,
    currency: "CNY",
    avg_price: values.avg_price,
    adult_price: values.adult_price,
    child_price: values.child_price,
    estimated_total_for_family: {
      "2_adults_1_child": familyTotal,
    },
    budget_level: classifyBudgetLevel(familyTotal),
    source: values.source,
    confidence: values.confidence,
  };
}

function freePrice(poi, confidence = 0.7) {
  return baseRecord(poi, {
    price_type: "free",
    avg_price: 0,
    adult_price: 0,
    child_price: 0,
    source: "category_estimated_mock",
    confidence,
  });
}

function manualFreePrice(poi) {
  return baseRecord(poi, {
    price_type: "free",
    avg_price: 0,
    adult_price: 0,
    child_price: 0,
    source: "manual_mock",
    confidence: 0.75,
  });
}

function manualTicketPrice(poi, adultPrice, childPrice) {
  return baseRecord(poi, {
    price_type: "ticket",
    avg_price: adultPrice,
    adult_price: adultPrice,
    child_price: childPrice,
    source: "manual_mock",
    confidence: 0.75,
  });
}

function ticketPrice(poi, adultPrice, childPrice, confidence = 0.7) {
  return baseRecord(poi, {
    price_type: "ticket",
    avg_price: adultPrice,
    adult_price: adultPrice,
    child_price: childPrice,
    source: "category_estimated_mock",
    confidence,
  });
}

function averagePrice(poi, priceType, avgPrice, source, confidence) {
  return baseRecord(poi, {
    price_type: priceType,
    avg_price: avgPrice,
    adult_price: null,
    child_price: null,
    source,
    confidence,
  });
}

function activityFee(poi, avgPrice, source = "category_estimated_mock", confidence = 0.7) {
  return baseRecord(poi, {
    price_type: "activity_fee",
    avg_price: avgPrice,
    adult_price: avgPrice,
    child_price: null,
    source,
    confidence,
  });
}

function categoryDefault(poi) {
  if (poi.type === "mall" || poi.category === "park" || poi.category === "landmark" || poi.category === "creative_block") {
    return freePrice(poi);
  }

  if (poi.type === "restaurant") {
    const defaults = {
      shanghai_food: 100,
      hotpot: 130,
      western_food: 150,
      chinese_food: 100,
      casual_food: 80,
    };
    return averagePrice(poi, "restaurant_avg", defaults[poi.category] ?? 100, "category_estimated_mock", 0.7);
  }

  if (poi.type === "cafe") return averagePrice(poi, "cafe_avg", 35, "category_estimated_mock", 0.7);

  if (poi.category === "museum") return ticketPrice(poi, 30, 15, 0.75);
  if (poi.category === "exhibition") return ticketPrice(poi, 60, 30, 0.75);
  if (poi.category === "aquarium") return ticketPrice(poi, 160, 100, 0.7);
  if (["family_activity", "indoor_playground"].includes(poi.category)) return ticketPrice(poi, 150, 100, 0.7);

  if (poi.type === "entertainment") {
    if (["theater", "livehouse", "ktv", "nightlife"].includes(poi.category)) return activityFee(poi, 150);
    return activityFee(poi, 120);
  }

  return averagePrice(poi, "activity_fee", 80, "unknown", 0.4);
}

function manualOverride(poi) {
  if (poi.poi_id === "poi_sh_disneytown") {
    return manualFreePrice(poi);
  }

  if (poi.poi_id === "poi_sh_yuyuan_garden") {
    return manualTicketPrice(poi, 40, 20);
  }

  return null;
}

export function buildPriceForPoi(poi, rawRecord = null) {
  const manual = manualOverride(poi);
  if (manual) return manual;

  const amapCost = extractAmapCost(poi, rawRecord);

  if (amapCost !== null && poi.type === "restaurant") {
    return averagePrice(poi, "restaurant_avg", amapCost, "amap", 0.8);
  }
  if (amapCost !== null && poi.type === "cafe") {
    return averagePrice(poi, "cafe_avg", amapCost, "amap", 0.8);
  }
  if (amapCost !== null && poi.type === "entertainment") {
    return activityFee(poi, amapCost, "amap", 0.8);
  }

  return categoryDefault(poi);
}

function rawRecordsByPoiId(rawRecords) {
  const map = new Map();
  for (const record of rawRecords ?? []) {
    const poiId = record.seed?.poi_id;
    if (poiId) map.set(poiId, record);
  }
  return map;
}

export function generatePriceDataset(pois, rawRecords = []) {
  const rawByPoiId = rawRecordsByPoiId(rawRecords);
  return pois.map((poi) => buildPriceForPoi(poi, rawByPoiId.get(poi.poi_id)));
}

export function validatePriceDataset(prices, pois) {
  const errors = [];
  const poiIds = new Set(pois.map((poi) => poi.poi_id));
  const poiById = new Map(pois.map((poi) => [poi.poi_id, poi]));
  const priceIds = new Set();
  const duplicateIds = new Set();

  if (prices.length !== pois.length) errors.push(`Count mismatch: prices=${prices.length}, pois=${pois.length}`);

  for (const price of prices) {
    if (priceIds.has(price.poi_id)) duplicateIds.add(price.poi_id);
    priceIds.add(price.poi_id);

    if (!poiIds.has(price.poi_id)) errors.push(`Unknown poi_id: ${price.poi_id}`);

    for (const field of [
      "poi_id",
      "price_type",
      "currency",
      "avg_price",
      "estimated_total_for_family",
      "budget_level",
      "source",
      "confidence",
    ]) {
      if (price[field] === undefined || price[field] === null || price[field] === "") {
        errors.push(`Missing required field ${field}: ${price.poi_id}`);
      }
    }

    if (!ALLOWED_PRICE_TYPES.has(price.price_type)) errors.push(`Invalid price_type: ${price.poi_id} (${price.price_type})`);
    if (!ALLOWED_BUDGET_LEVELS.has(price.budget_level)) errors.push(`Invalid budget_level: ${price.poi_id} (${price.budget_level})`);
    if (!ALLOWED_PRICE_SOURCES.has(price.source)) errors.push(`Invalid source: ${price.poi_id} (${price.source})`);
    if (typeof price.confidence !== "number" || price.confidence < 0 || price.confidence > 1) {
      errors.push(`Invalid confidence: ${price.poi_id}`);
    }
    if (typeof price.avg_price !== "number" || price.avg_price < 0) errors.push(`Invalid avg_price: ${price.poi_id}`);

    const familyTotal = price.estimated_total_for_family?.["2_adults_1_child"];
    if (typeof familyTotal !== "number" || familyTotal < 0) errors.push(`Invalid family total: ${price.poi_id}`);

    const poi = poiById.get(price.poi_id);
    if (poi?.type === "restaurant" && (price.price_type !== "restaurant_avg" || price.avg_price <= 0 || familyTotal <= 0)) {
      errors.push(`restaurant missing price: ${price.poi_id}`);
    }
    if (poi?.type === "cafe" && (price.price_type !== "cafe_avg" || price.avg_price <= 0 || familyTotal <= 0)) {
      errors.push(`cafe missing price: ${price.poi_id}`);
    }
    if (
      price.price_type === "free" &&
      (price.avg_price !== 0 ||
        price.adult_price !== 0 ||
        price.child_price !== 0 ||
        familyTotal !== 0 ||
        price.budget_level !== "low")
    ) {
      errors.push(`free price is not zero: ${price.poi_id}`);
    }
  }

  for (const poi of pois) {
    if (!priceIds.has(poi.poi_id)) errors.push(`Missing price for poi_id: ${poi.poi_id}`);
  }
  for (const poiId of duplicateIds) errors.push(`Duplicate poi_id: ${poiId}`);

  return {
    ok: errors.length === 0,
    errors,
    count: prices.length,
    missing_poi_ids: pois.map((poi) => poi.poi_id).filter((poiId) => !priceIds.has(poiId)),
    extra_poi_ids: prices.map((price) => price.poi_id).filter((poiId) => !poiIds.has(poiId)),
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

export async function runGeneratePriceMock() {
  const pois = await readJsonIfExists(POIS_PATH, []);
  const raw = await readJsonIfExists(RAW_PATH, { responses: [] });
  const rawRecords = Array.isArray(raw.responses) ? raw.responses : [];
  const prices = generatePriceDataset(pois, rawRecords);

  await writeJson(PRICE_OUTPUT_PATH, prices);

  const report = validatePriceDataset(prices, pois);
  console.log(`[mock:price] loaded ${pois.length} POIs`);
  console.log(`[mock:price] generated ${prices.length} price records`);

  if (report.ok) {
    console.log("[mock:price] validation passed");
  } else {
    for (const error of report.errors) console.error(`[mock:price] error ${error}`);
    process.exitCode = 1;
  }

  return { pois, prices, report };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runGeneratePriceMock().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
