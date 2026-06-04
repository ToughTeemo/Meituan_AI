import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_BUDGET_LEVELS,
  ALLOWED_PRICE_SOURCES,
  ALLOWED_PRICE_TYPES,
  buildPriceForPoi,
  calculateFamilyTotal,
  classifyBudgetLevel,
  extractAmapCost,
  generatePriceDataset,
  validatePriceDataset,
} from "./generate-price-mock.mjs";

const basePoi = {
  poi_id: "poi_test",
  name: "Test POI",
  type: "attraction",
  category: "museum",
  tags: ["室内", "文化"],
  amap: { cost: null },
};

test("generatePriceDataset creates one price record for every POI", () => {
  const pois = [
    { ...basePoi, poi_id: "poi_a" },
    { ...basePoi, poi_id: "poi_b", type: "restaurant", category: "shanghai_food" },
  ];

  const prices = generatePriceDataset(pois, []);

  assert.deepEqual(prices.map((item) => item.poi_id), ["poi_a", "poi_b"]);
});

test("validatePriceDataset rejects records for unknown poi_id", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }];
  const prices = [
    buildPriceForPoi(pois[0]),
    { ...buildPriceForPoi(pois[0]), poi_id: "poi_missing" },
  ];

  const report = validatePriceDataset(prices, pois);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Unknown poi_id/);
});

test("restaurant defaults to restaurant_avg with positive price", () => {
  const price = buildPriceForPoi({ ...basePoi, type: "restaurant", category: "shanghai_food" });

  assert.equal(price.price_type, "restaurant_avg");
  assert.ok(price.avg_price > 0);
  assert.ok(price.estimated_total_for_family["2_adults_1_child"] > 0);
});

test("cafe defaults to cafe_avg with positive price", () => {
  const price = buildPriceForPoi({ ...basePoi, type: "cafe", category: "cafe" });

  assert.equal(price.price_type, "cafe_avg");
  assert.ok(price.avg_price > 0);
});

test("mall defaults to free with zero total", () => {
  const price = buildPriceForPoi({ ...basePoi, type: "mall", category: "shopping_mall" });

  assert.equal(price.price_type, "free");
  assert.equal(price.estimated_total_for_family["2_adults_1_child"], 0);
});

test("park and landmark default to free", () => {
  const park = buildPriceForPoi({ ...basePoi, category: "park" });
  const landmark = buildPriceForPoi({ ...basePoi, category: "landmark", tags: ["地标"] });

  assert.equal(park.price_type, "free");
  assert.equal(landmark.price_type, "free");
});

test("museum and exhibition default to ticket", () => {
  const museum = buildPriceForPoi({ ...basePoi, category: "museum" });
  const exhibition = buildPriceForPoi({ ...basePoi, category: "exhibition" });

  assert.equal(museum.price_type, "ticket");
  assert.equal(exhibition.price_type, "ticket");
});

test("aquarium and family activity default to ticket", () => {
  const aquarium = buildPriceForPoi({ ...basePoi, category: "aquarium" });
  const family = buildPriceForPoi({ ...basePoi, type: "entertainment", category: "family_activity" });

  assert.equal(aquarium.price_type, "ticket");
  assert.equal(family.price_type, "ticket");
});

test("entertainment defaults to activity_fee or ticket", () => {
  const livehouse = buildPriceForPoi({ ...basePoi, type: "entertainment", category: "livehouse" });
  const indoor = buildPriceForPoi({ ...basePoi, type: "entertainment", category: "indoor_playground" });

  assert.equal(livehouse.price_type, "activity_fee");
  assert.equal(indoor.price_type, "ticket");
});

test("extractAmapCost parses numeric prices from poi amap cost", () => {
  const cost = extractAmapCost({ ...basePoi, amap: { cost: "88元" } });

  assert.equal(cost, 88);
});

test("estimated family total is calculated correctly", () => {
  assert.equal(calculateFamilyTotal({ price_type: "ticket", adult_price: 30, child_price: 15, avg_price: 30 }), 75);
  assert.equal(calculateFamilyTotal({ price_type: "restaurant_avg", avg_price: 100 }), 250);
  assert.equal(calculateFamilyTotal({ price_type: "cafe_avg", avg_price: 35 }), 105);
});

test("budget level is classified by family total", () => {
  assert.equal(classifyBudgetLevel(0), "low");
  assert.equal(classifyBudgetLevel(100), "low");
  assert.equal(classifyBudgetLevel(101), "medium");
  assert.equal(classifyBudgetLevel(350), "medium");
  assert.equal(classifyBudgetLevel(351), "high");
});

test("confidence is between 0 and 1 and enums are allowed", () => {
  const price = buildPriceForPoi(basePoi);

  assert.ok(price.confidence >= 0 && price.confidence <= 1);
  assert.ok(ALLOWED_PRICE_TYPES.has(price.price_type));
  assert.ok(ALLOWED_BUDGET_LEVELS.has(price.budget_level));
  assert.ok(ALLOWED_PRICE_SOURCES.has(price.source));
});

test("validatePriceDataset catches restaurant missing price", () => {
  const poi = { ...basePoi, type: "restaurant", category: "shanghai_food" };
  const price = { ...buildPriceForPoi(poi), avg_price: 0, estimated_total_for_family: { "2_adults_1_child": 0 } };

  const report = validatePriceDataset([price], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /restaurant missing price/);
});

test("validatePriceDataset catches duplicate poi_id", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const price = buildPriceForPoi(poi);

  const report = validatePriceDataset([price, price], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Duplicate poi_id/);
});

test("Disneytown is a manual free open commercial street", () => {
  const price = buildPriceForPoi({
    ...basePoi,
    poi_id: "poi_sh_disneytown",
    type: "entertainment",
    category: "family_activity",
  });

  assert.deepEqual(price, {
    poi_id: "poi_sh_disneytown",
    price_type: "free",
    currency: "CNY",
    avg_price: 0,
    adult_price: 0,
    child_price: 0,
    estimated_total_for_family: { "2_adults_1_child": 0 },
    budget_level: "low",
    source: "manual_mock",
    confidence: 0.75,
  });
});

test("Yuyuan Garden is a manual low-price garden ticket", () => {
  const price = buildPriceForPoi({
    ...basePoi,
    poi_id: "poi_sh_yuyuan_garden",
    name: "上海豫园",
    type: "attraction",
    category: "landmark",
    tags: ["地标", "古典园林", "拍照"],
  });

  assert.deepEqual(price, {
    poi_id: "poi_sh_yuyuan_garden",
    price_type: "ticket",
    currency: "CNY",
    avg_price: 40,
    adult_price: 40,
    child_price: 20,
    estimated_total_for_family: { "2_adults_1_child": 100 },
    budget_level: "low",
    source: "manual_mock",
    confidence: 0.75,
  });
});
