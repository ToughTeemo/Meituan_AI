import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SEED_PATH = path.join(PROJECT_ROOT, "docs", "mock", "amap_poi_seed_queries.json");
const POIS_OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_mock.json");
const RAW_OUTPUT_PATH = path.join(PROJECT_ROOT, "docs", "mock", "pois_amap_raw.json");

const AMAP_V5_TEXT_URL = "https://restapi.amap.com/v5/place/text";
const AMAP_V3_TEXT_URL = "https://restapi.amap.com/v3/place/text";
const ALLOWED_TYPES = new Set([
  "attraction",
  "restaurant",
  "cafe",
  "mall",
  "entertainment",
  "transport",
]);

export function parseAmapLocation(location) {
  if (typeof location !== "string" || !location.includes(",")) {
    return { longitude: null, latitude: null };
  }

  const [longitudeText, latitudeText] = location.split(",");
  const longitude = Number(longitudeText);
  const latitude = Number(latitudeText);

  return {
    longitude: Number.isFinite(longitude) ? longitude : null,
    latitude: Number.isFinite(latitude) ? latitude : null,
  };
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Array.isArray(value) ? value[0] : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function firstString(...values) {
  for (const value of values) {
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0].trim();
    }
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeName(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/上海市?/g, "")
    .replace(/[()\[\]（）【】\s·\-_/]/g, "");
}

function containsShanghai(poi) {
  return [poi.pname, poi.cityname, poi.adname, poi.district]
    .filter(Boolean)
    .some((value) => String(value).includes("上海"));
}

function categoryKeyword(category) {
  const keywords = {
    museum: ["博物馆", "文化", "展览"],
    exhibition: ["展览", "美术馆", "艺术"],
    park: ["公园", "绿地"],
    aquarium: ["水族馆", "海洋"],
    landmark: ["风景名胜", "地标", "旅游"],
    shopping_mall: ["购物", "商场"],
    cafe: ["咖啡", "咖啡厅"],
    shanghai_food: ["餐饮", "中餐", "本帮"],
    western_food: ["西餐", "餐饮"],
    hotpot: ["火锅", "餐饮"],
    chinese_food: ["中餐", "餐饮"],
    family_activity: ["娱乐", "主题", "亲子"],
    indoor_playground: ["娱乐", "室内", "儿童"],
    theater: ["剧场", "剧院", "演出"],
    ktv: ["KTV", "娱乐"],
    livehouse: ["演出", "音乐"],
    nightlife: ["娱乐", "舞厅"],
    creative_block: ["商务住宅", "风景名胜", "购物"],
  };
  return keywords[category] ?? [];
}

export function resolveSeedQueries(seed) {
  if (Array.isArray(seed.queries) && seed.queries.length > 0) {
    return [...new Set(seed.queries.map((query) => String(query).trim()).filter(Boolean))];
  }

  if (typeof seed.query === "string" && seed.query.trim()) {
    return [seed.query.trim()];
  }

  return [];
}

export function chooseBestCandidate(seed, pois, query = seed.query) {
  if (!Array.isArray(pois) || pois.length === 0) {
    return { poi: null, verified: false, score: 0 };
  }

  const normalizedQuery = normalizeName(query);
  const keywords = categoryKeyword(seed.category);

  const scored = pois.map((poi, index) => {
    const name = normalizeName(poi.name);
    const type = String(poi.type ?? "");
    let score = Math.max(0, 30 - index);

    if (containsShanghai(poi)) score += 40;
    if (poi.location) score += 20;
    if (poi.address) score += 10;
    if (normalizedQuery && name && (normalizedQuery.includes(name) || name.includes(normalizedQuery))) score += 40;
    if (normalizedQuery && name && normalizedQuery.slice(0, 4) && name.includes(normalizedQuery.slice(0, 4))) score += 12;
    if (keywords.some((keyword) => type.includes(keyword))) score += 12;

    return { poi, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return {
    poi: best.poi,
    verified: best.score >= 80,
    score: best.score,
  };
}

export function mapAmapPoiToMockPoi(seed, poi, verified, apiVersion = undefined) {
  const business = poi.business ?? {};
  const bizExt = poi.biz_ext ?? {};
  const { longitude, latitude } = parseAmapLocation(poi.location);
  const rating = numberOrNull(business.rating ?? bizExt.rating);
  const cost = numberOrNull(business.cost ?? bizExt.cost);

  const mapped = {
    poi_id: seed.poi_id,
    external_ids: {
      amap_poi_id: poi.id ?? null,
    },
    name: firstString(poi.name),
    type: seed.type,
    category: seed.category,
    district: firstString(poi.adname, poi.district),
    address: firstString(poi.address),
    latitude,
    longitude,
    tags: Array.isArray(seed.tags) ? seed.tags : [],
    suitable_for: Array.isArray(seed.suitable_for) ? seed.suitable_for : [],
    recommended_duration_minutes: seed.recommended_duration_minutes,
    rating,
    amap: {
      type: poi.type ?? null,
      typecode: poi.typecode ?? null,
      business_area: firstString(business.business_area, poi.business_area, bizExt.business_area) || null,
      cost,
    },
    source: {
      provider: "amap",
      source_type: "api_seed",
      ...(apiVersion ? { api_version: apiVersion } : {}),
      verified,
    },
  };

  if (!verified) {
    mapped.source.warning = "low_confidence_match";
  }

  return mapped;
}

function buildAmapV5Url(query, apiKey) {
  const url = new URL(AMAP_V5_TEXT_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("keywords", query);
  url.searchParams.set("region", "上海市");
  url.searchParams.set("city_limit", "true");
  url.searchParams.set("show_fields", "business");
  url.searchParams.set("page_size", "10");
  url.searchParams.set("page_num", "1");
  return url;
}

function buildAmapV3Url(query, apiKey) {
  const url = new URL(AMAP_V3_TEXT_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("keywords", query);
  url.searchParams.set("city", "上海");
  url.searchParams.set("citylimit", "true");
  url.searchParams.set("offset", "10");
  url.searchParams.set("page", "1");
  url.searchParams.set("extensions", "all");
  url.searchParams.set("output", "json");
  return url;
}

async function requestAmapPois(query, apiKey, apiVersion, fetchImpl = fetch) {
  const url = apiVersion === "v3" ? buildAmapV3Url(query, apiKey) : buildAmapV5Url(query, apiKey);
  const response = await fetchImpl(url);
  const body = await response.json();

  return {
    api_version: apiVersion,
    query,
    url: maskKey(url),
    ok: response.ok,
    status: response.status,
    body,
    pois: Array.isArray(body.pois) ? body.pois : [],
  };
}

function hasBasicPoiFields(poi) {
  const location = parseAmapLocation(poi?.location);
  return Boolean(poi?.id && firstString(poi.name) && location.latitude !== null && location.longitude !== null);
}

function summarizeAttempt(result, match = { poi: null, score: 0 }) {
  return {
    query: result.query,
    api_version: result.api_version,
    request_url: result.url,
    http_status: result.status,
    amap_status: result.body.status ?? null,
    amap_info: result.body.info ?? null,
    amap_infocode: result.body.infocode ?? null,
    result_count: result.pois.length,
    selected_amap_poi_id: match.poi?.id ?? null,
    selected_score: match.score,
    response: result.body,
  };
}

export async function findSeedMatch(seed, apiKey, fetchImpl = fetch) {
  const queries = resolveSeedQueries(seed);
  const attempts = [];

  for (const query of queries) {
    for (const apiVersion of ["v5", "v3"]) {
      const result = await requestAmapPois(query, apiKey, apiVersion, fetchImpl);
      const match = chooseBestCandidate(seed, result.pois, query);
      attempts.push(summarizeAttempt(result, match));

      if (!match.poi) {
        continue;
      }

      if (!hasBasicPoiFields(match.poi)) {
        continue;
      }

      const mapped = mapAmapPoiToMockPoi(seed, match.poi, match.verified, apiVersion);
      return {
        mapped,
        match,
        matched_query: query,
        matched_api_version: apiVersion,
        attempts,
        raw: {
          seed,
          queries,
          attempts,
          matched_query: query,
          matched_api_version: apiVersion,
          selected_amap_poi_id: mapped.external_ids?.amap_poi_id ?? null,
          selected_score: match.score,
        },
      };
    }
  }

  return {
    mapped: null,
    match: { poi: null, verified: false, score: 0 },
    matched_query: null,
    matched_api_version: null,
    attempts,
    raw: {
      seed,
      queries,
      attempts,
      matched_query: null,
      matched_api_version: null,
      selected_amap_poi_id: null,
      selected_score: 0,
    },
  };
}

function maskKey(url) {
  const masked = new URL(url);
  masked.searchParams.set("key", "***");
  return masked.toString();
}

export function validatePois(pois, options = {}) {
  const minCount = options.minCount ?? 60;
  const maxWarningCount = options.maxWarningCount ?? 80;
  const errors = [];
  const warnings = [];
  const poiIds = new Set();
  const amapIds = new Set();
  const duplicatePoiIds = new Set();
  const duplicateAmapIds = new Set();

  for (const poi of pois) {
    if (poiIds.has(poi.poi_id)) duplicatePoiIds.add(poi.poi_id);
    poiIds.add(poi.poi_id);

    const amapId = poi.external_ids?.amap_poi_id;
    if (amapId) {
      if (amapIds.has(amapId)) duplicateAmapIds.add(amapId);
      amapIds.add(amapId);
    }

    if (!poi.name) errors.push(`Missing name: ${poi.poi_id}`);
    if (poi.latitude === null || poi.latitude === undefined || poi.longitude === null || poi.longitude === undefined) {
      errors.push(`Missing latitude/longitude: ${poi.poi_id}`);
    }
    if (!ALLOWED_TYPES.has(poi.type)) errors.push(`Invalid type: ${poi.poi_id} (${poi.type})`);
    if (!Array.isArray(poi.tags) || poi.tags.length === 0) warnings.push(`Missing tags: ${poi.poi_id}`);
    if (poi.rating === null) warnings.push(`Missing rating: ${poi.poi_id}`);
    if (poi.amap?.cost === null) warnings.push(`Missing cost: ${poi.poi_id}`);
  }

  for (const poiId of duplicatePoiIds) errors.push(`Duplicate poi_id: ${poiId}`);
  for (const amapId of duplicateAmapIds) warnings.push(`Duplicate amap_poi_id after output: ${amapId}`);
  if (pois.length < minCount) errors.push(`Output count ${pois.length} is below ${minCount}`);
  if (pois.length > maxWarningCount) warnings.push(`Output count ${pois.length} is above ${maxWarningCount}`);

  return {
    ok: errors.length === 0,
    count: pois.length,
    errors,
    warnings,
    duplicate_poi_ids: [...duplicatePoiIds],
    duplicate_amap_poi_ids: [...duplicateAmapIds],
  };
}

async function readSeeds() {
  const text = await fs.readFile(SEED_PATH, "utf8");
  return JSON.parse(text);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function runSeed({
  apiKey = process.env.AMAP_WEB_SERVICE_KEY,
  fetchImpl = fetch,
  seeds,
  minCount,
  writeOutputs = true,
} = {}) {
  if (!apiKey) {
    throw new Error("Missing AMAP_WEB_SERVICE_KEY");
  }

  const seedList = seeds ?? await readSeeds();
  const pois = [];
  const raw = {
    provider: "amap",
    api: "v5/place/text with v3/place/text fallback",
    generated_at: new Date().toISOString(),
    responses: [],
    failures: [],
    low_confidence_matches: [],
    duplicate_amap_poi_ids: [],
  };
  const seenAmapIds = new Map();

  for (const seed of seedList) {
    try {
      const result = await findSeedMatch(seed, apiKey, fetchImpl);
      raw.responses.push(result.raw);

      if (!result.mapped) {
        const failure = {
          poi_id: seed.poi_id,
          queries: resolveSeedQueries(seed),
          reason: "no_results",
          attempts: result.attempts.map((attempt) => ({
            query: attempt.query,
            api_version: attempt.api_version,
            http_status: attempt.http_status,
            amap_status: attempt.amap_status,
            amap_info: attempt.amap_info,
            amap_infocode: attempt.amap_infocode,
            result_count: attempt.result_count,
          })),
        };
        raw.failures.push(failure);
        printUnmatchedWarning(failure);
        continue;
      }

      const mapped = result.mapped;
      const amapId = mapped.external_ids?.amap_poi_id;

      if (amapId && seenAmapIds.has(amapId)) {
        const duplicate = {
          amap_poi_id: amapId,
          kept_poi_id: seenAmapIds.get(amapId),
          skipped_poi_id: seed.poi_id,
          matched_query: result.matched_query,
          api_version: result.matched_api_version,
        };
        raw.duplicate_amap_poi_ids.push(duplicate);
        console.warn(`[seed:pois] warning duplicate Amap POI ${amapId}: kept ${duplicate.kept_poi_id}, skipped ${seed.poi_id}`);
        continue;
      }

      if (amapId) seenAmapIds.set(amapId, seed.poi_id);
      if (!result.match.verified) {
        raw.low_confidence_matches.push({
          poi_id: seed.poi_id,
          matched_query: result.matched_query,
          api_version: result.matched_api_version,
          amap_poi_id: amapId,
          score: result.match.score,
        });
      }

      pois.push(mapped);
    } catch (error) {
      const failure = {
        poi_id: seed.poi_id,
        queries: resolveSeedQueries(seed),
        reason: "request_error",
        message: error instanceof Error ? error.message : String(error),
      };
      raw.failures.push(failure);
      console.warn(`[seed:pois] warning request failed for ${seed.poi_id}: ${failure.message}`);
    }
  }

  const report = validatePois(pois, minCount === undefined ? {} : { minCount });
  raw.quality_report = report;

  if (writeOutputs) {
    await writeJson(POIS_OUTPUT_PATH, pois);
    await writeJson(RAW_OUTPUT_PATH, raw);
  }

  printReport(report, raw);

  if (!report.ok) {
    process.exitCode = 1;
  }

  return { pois, raw, report };
}

function printUnmatchedWarning(failure) {
  console.warn(`[seed:pois] warning no results for ${failure.poi_id}`);
  console.warn(`[seed:pois]   tried queries: ${failure.queries.join(" | ")}`);
  for (const attempt of failure.attempts) {
    console.warn(
      `[seed:pois]   ${attempt.api_version} "${attempt.query}": http=${attempt.http_status}, status=${attempt.amap_status ?? "n/a"}, info=${attempt.amap_info ?? "n/a"}, infocode=${attempt.amap_infocode ?? "n/a"}, count=${attempt.result_count}`,
    );
  }
}

function printReport(report, raw) {
  console.log(`[seed:pois] generated ${report.count} POIs`);
  for (const warning of report.warnings) {
    console.warn(`[seed:pois] warning ${warning}`);
  }
  for (const error of report.errors) {
    console.error(`[seed:pois] error ${error}`);
  }
  console.log(`[seed:pois] unmatched queries: ${raw.failures.length}`);
  console.log(`[seed:pois] low confidence matches: ${raw.low_confidence_matches.length}`);
  console.log(`[seed:pois] duplicate Amap POI IDs: ${raw.duplicate_amap_poi_ids.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runSeed().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
