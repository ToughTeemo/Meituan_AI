import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import {
  chooseBestCandidate,
  findSeedMatch,
  mapAmapPoiToMockPoi,
  parseAmapLocation,
  resolveSeedQueries,
  runSeed,
  validatePois,
} from "./seed-amap-pois.mjs";

test("parseAmapLocation splits longitude and latitude into numbers", () => {
  assert.deepEqual(parseAmapLocation("121.4622,31.2354"), {
    longitude: 121.4622,
    latitude: 31.2354,
  });
});

test("mapAmapPoiToMockPoi preserves seed fields and maps Amap business fields", () => {
  const seed = {
    poi_id: "poi_sh_natural_history_museum",
    query: "上海自然博物馆",
    type: "attraction",
    category: "museum",
    tags: ["亲子", "室内", "科普"],
    suitable_for: ["family", "kids", "rainy_day"],
    recommended_duration_minutes: 120,
  };

  const poi = {
    id: "B001",
    name: "上海自然博物馆",
    address: "北京西路510号",
    adname: "静安区",
    location: "121.4622,31.2354",
    type: "科教文化服务;博物馆;博物馆",
    typecode: "140100",
    business: {
      rating: "4.8",
      cost: "80",
      business_area: "南京西路",
    },
  };

  assert.deepEqual(mapAmapPoiToMockPoi(seed, poi, true), {
    poi_id: "poi_sh_natural_history_museum",
    external_ids: {
      amap_poi_id: "B001",
    },
    name: "上海自然博物馆",
    type: "attraction",
    category: "museum",
    district: "静安区",
    address: "北京西路510号",
    latitude: 31.2354,
    longitude: 121.4622,
    tags: ["亲子", "室内", "科普"],
    suitable_for: ["family", "kids", "rainy_day"],
    recommended_duration_minutes: 120,
    rating: 4.8,
    amap: {
      type: "科教文化服务;博物馆;博物馆",
      typecode: "140100",
      business_area: "南京西路",
      cost: 80,
    },
    source: {
      provider: "amap",
      source_type: "api_seed",
      verified: true,
    },
  });
});

test("chooseBestCandidate prefers Shanghai candidates with location and matching name", () => {
  const seed = { query: "上海自然博物馆", category: "museum" };
  const candidates = [
    { id: "B001", name: "自然博物馆", cityname: "北京市", location: "116,39" },
    {
      id: "B002",
      name: "上海自然博物馆",
      cityname: "上海市",
      adname: "静安区",
      address: "北京西路510号",
      location: "121,31",
      type: "科教文化服务;博物馆;博物馆",
    },
  ];

  const result = chooseBestCandidate(seed, candidates);
  assert.equal(result.poi.id, "B002");
  assert.equal(result.verified, true);
});

test("validatePois fails hard on duplicate poi_id and invalid type", () => {
  const pois = [
    {
      poi_id: "same",
      name: "A",
      type: "bad",
      category: "museum",
      district: "静安区",
      address: "x",
      latitude: 31,
      longitude: 121,
      tags: ["室内"],
      recommended_duration_minutes: 60,
      source: { provider: "amap", source_type: "api_seed", verified: true },
    },
    {
      poi_id: "same",
      name: "B",
      type: "attraction",
      category: "museum",
      district: "静安区",
      address: "x",
      latitude: 31,
      longitude: 121,
      tags: ["室内"],
      recommended_duration_minutes: 60,
      source: { provider: "amap", source_type: "api_seed", verified: true },
    },
  ];

  const report = validatePois(pois, { minCount: 0 });
  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Duplicate poi_id/);
  assert.match(report.errors.join("\n"), /Invalid type/);
});

test("validatePois uses the expanded 60-80 output count range", () => {
  const makePoi = (index) => ({
    poi_id: `poi_${index}`,
    name: `POI ${index}`,
    type: "attraction",
    category: "museum",
    district: "黄浦区",
    address: `Address ${index}`,
    latitude: 31 + index / 10000,
    longitude: 121 + index / 10000,
    tags: ["室内"],
    recommended_duration_minutes: 60,
    external_ids: { amap_poi_id: `B${index}` },
    amap: { cost: 10 },
    rating: 4.5,
    source: { provider: "amap", source_type: "api_seed", verified: true },
  });

  const inRange = validatePois(Array.from({ length: 73 }, (_, index) => makePoi(index)));
  assert.equal(inRange.ok, true);
  assert.equal(inRange.warnings.some((warning) => warning.includes("above 40")), false);
  assert.equal(inRange.warnings.some((warning) => warning.includes("above 80")), false);

  const belowRange = validatePois(Array.from({ length: 59 }, (_, index) => makePoi(index)));
  assert.equal(belowRange.ok, false);
  assert.match(belowRange.errors.join("\n"), /Output count 59 is below 60/);

  const aboveRange = validatePois(Array.from({ length: 81 }, (_, index) => makePoi(index)));
  assert.equal(aboveRange.ok, true);
  assert.match(aboveRange.warnings.join("\n"), /Output count 81 is above 80/);
});

test("resolveSeedQueries keeps backward compatibility with query", () => {
  assert.deepEqual(resolveSeedQueries({ query: "上海自然博物馆" }), ["上海自然博物馆"]);
});

test("resolveSeedQueries supports ordered queries", () => {
  assert.deepEqual(resolveSeedQueries({ query: "old", queries: ["田子坊", "上海田子坊"] }), [
    "田子坊",
    "上海田子坊",
  ]);
});

test("findSeedMatch tries multiple queries in order", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(new URL(url).searchParams.get("keywords"));
    const keywords = new URL(url).searchParams.get("keywords");
    return {
      ok: true,
      status: 200,
      async json() {
        return keywords === "second"
          ? {
              status: "1",
              infocode: "10000",
              pois: [
                {
                  id: "B002",
                  name: "Second POI",
                  cityname: "上海市",
                  adname: "黄浦区",
                  address: "Test address",
                  location: "121.49,31.23",
                },
              ],
            }
          : { status: "1", infocode: "10000", pois: [] };
      },
    };
  };

  const result = await findSeedMatch(
    {
      poi_id: "poi_test",
      queries: ["first", "second"],
      type: "attraction",
      category: "landmark",
      tags: ["地标"],
      recommended_duration_minutes: 60,
    },
    "fake-key",
    fetchImpl,
  );

  assert.equal(result.mapped.name, "Second POI");
  assert.equal(result.matched_query, "second");
  assert.deepEqual(calls, ["first", "first", "second"]);
});

test("findSeedMatch falls back to v3 when v5 has no results", async () => {
  const apiVersions = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(url);
    const isV3 = parsed.pathname.includes("/v3/");
    apiVersions.push(isV3 ? "v3" : "v5");
    return {
      ok: true,
      status: 200,
      async json() {
        return isV3
          ? {
              status: "1",
              info: "OK",
              infocode: "10000",
              pois: [
                {
                  id: "B003",
                  name: "V3 POI",
                  cityname: "上海市",
                  adname: "静安区",
                  address: "V3 address",
                  location: "121.45,31.22",
                  biz_ext: { rating: "4.7", cost: "50" },
                },
              ],
            }
          : { status: "1", info: "OK", infocode: "10000", pois: [] };
      },
    };
  };

  const result = await findSeedMatch(
    {
      poi_id: "poi_test_v3",
      query: "fallback",
      type: "attraction",
      category: "landmark",
      tags: ["地标"],
      recommended_duration_minutes: 60,
    },
    "fake-key",
    fetchImpl,
  );

  assert.equal(result.mapped.source.api_version, "v3");
  assert.equal(result.matched_query, "fallback");
  assert.deepEqual(apiVersions, ["v5", "v3"]);
});

test("findSeedMatch records matched_query in debug output", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        status: "1",
        info: "OK",
        infocode: "10000",
        pois: [
          {
            id: "B004",
            name: "Debug POI",
            cityname: "上海市",
            adname: "浦东新区",
            address: "Debug address",
            location: "121.52,31.24",
          },
        ],
      };
    },
  });

  const result = await findSeedMatch(
    {
      poi_id: "poi_test_debug",
      queries: ["debug"],
      type: "attraction",
      category: "landmark",
      tags: ["地标"],
      recommended_duration_minutes: 60,
    },
    "fake-key",
    fetchImpl,
  );

  assert.equal(result.raw.matched_query, "debug");
  assert.equal(result.raw.matched_api_version, "v5");
});

test("runSeed successful match does not reference an undefined match variable", async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        status: "1",
        info: "OK",
        infocode: "10000",
        pois: [
          {
            id: "B005",
            name: "Run Seed POI",
            cityname: "上海市",
            adname: "静安区",
            address: "Run seed address",
            location: "121.46,31.23",
            business: { rating: "4.8", cost: "60" },
          },
        ],
      };
    },
  });

  const result = await runSeed({
    apiKey: "fake-key",
    fetchImpl,
    seeds: [
      {
        poi_id: "poi_run_seed",
        query: "run seed",
        type: "attraction",
        category: "landmark",
        tags: ["地标"],
        recommended_duration_minutes: 60,
      },
    ],
    minCount: 0,
    writeOutputs: false,
  });

  assert.equal(result.pois.length, 1);
  assert.equal(result.raw.failures.length, 0);
  assert.equal(result.raw.responses[0].matched_query, "run seed");
  assert.equal(result.pois[0].source.api_version, "v5");
});

test("amap seed query file stays structurally valid for expanded dataset", () => {
  const allowedTypes = new Set(["attraction", "restaurant", "cafe", "mall", "entertainment", "transport"]);
  const seeds = JSON.parse(fs.readFileSync(new URL("../docs/mock/amap_poi_seed_queries.json", import.meta.url), "utf8"));
  const poiIds = new Set();
  const normalizedQueries = new Set();

  assert.ok(seeds.length >= 70 && seeds.length <= 80, `seed count should be 70-80, got ${seeds.length}`);

  for (const seed of seeds) {
    assert.equal(typeof seed.poi_id, "string");
    assert.ok(seed.poi_id.length > 0);
    assert.equal(poiIds.has(seed.poi_id), false, `duplicate poi_id: ${seed.poi_id}`);
    poiIds.add(seed.poi_id);

    const queries = resolveSeedQueries(seed);
    assert.ok(queries.length > 0, `${seed.poi_id} must have query or queries`);
    for (const query of queries) {
      const normalized = query.trim().toLowerCase();
      assert.ok(normalized.length > 0, `${seed.poi_id} has empty query`);
      assert.equal(normalizedQueries.has(normalized), false, `duplicate query: ${query}`);
      normalizedQueries.add(normalized);
    }

    assert.ok(allowedTypes.has(seed.type), `${seed.poi_id} has invalid type ${seed.type}`);
    assert.equal(typeof seed.category, "string", `${seed.poi_id} must have category`);
    assert.ok(seed.category.length > 0, `${seed.poi_id} must have category`);
    assert.ok(Array.isArray(seed.tags) && seed.tags.length > 0, `${seed.poi_id} must have tags`);
    assert.ok(
      typeof seed.recommended_duration_minutes === "number" && seed.recommended_duration_minutes > 0,
      `${seed.poi_id} must have positive recommended_duration_minutes`,
    );
  }
});
