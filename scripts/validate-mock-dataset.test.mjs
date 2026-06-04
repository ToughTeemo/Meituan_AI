import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  containsForbiddenText,
  collectDistribution,
  loadJsonArray,
  validateActionDataset,
  validateAllMockData,
  validateBookingDataset,
  validateHoursDataset,
  validatePoiDataset,
  validatePriceDataset,
  validateProviderAlignment,
  validateQueueDataset,
} from "./validate-mock-dataset.mjs";

const forbiddenChineseBooked = "\u5df2\u9884\u7ea6";
const forbiddenChineseLive = "\u5b9e\u65f6";
const forbiddenChineseNavigated = "\u5df2\u5bfc\u822a";

function createValidDataset() {
  const pois = [
    {
      poi_id: "poi_restaurant",
      external_ids: { amap_poi_id: "amap_restaurant" },
      name: "Restaurant",
      type: "restaurant",
      category: "shanghai_food",
      district: "Huangpu",
      address: "Road 1",
      latitude: 31.1,
      longitude: 121.1,
      tags: ["food"],
      recommended_duration_minutes: 60,
      source: { provider: "amap" },
    },
    {
      poi_id: "poi_park",
      name: "Park",
      type: "attraction",
      category: "park",
      district: "Pudong",
      address: "Road 2",
      latitude: 31.2,
      longitude: 121.2,
      tags: ["outdoor"],
      recommended_duration_minutes: 90,
      source: { provider: "manual_mock" },
    },
  ];

  const hours = pois.map((poi) => ({
    poi_id: poi.poi_id,
    hours_label: "09:00-17:00",
    open_intervals: [{ day_of_week: "Mon-Sun", start: "09:00", end: "17:00" }],
    closed_days: [],
    last_entry_time: null,
    source: "manual_mock",
    confidence: 0.8,
  }));

  const price = [
    {
      poi_id: "poi_restaurant",
      price_type: "restaurant_avg",
      currency: "CNY",
      avg_price: 120,
      adult_price: 120,
      child_price: 60,
      estimated_total_for_family: { "2_adults_1_child": 300 },
      budget_level: "medium",
      source: "manual_mock",
      confidence: 0.8,
    },
    {
      poi_id: "poi_park",
      price_type: "free",
      currency: "CNY",
      avg_price: 0,
      adult_price: 0,
      child_price: 0,
      estimated_total_for_family: { "2_adults_1_child": 0 },
      budget_level: "low",
      source: "manual_mock",
      confidence: 0.8,
    },
  ];

  const queue = pois.map((poi) => ({
    poi_id: poi.poi_id,
    queue_profiles: [{ scenario: "weekday", queue_level: "low", estimated_wait_minutes: 5 }],
    default_queue_level: "low",
    default_wait_minutes: 5,
    reason: "Estimated mock only",
    source: "estimated_mock",
    confidence: 0.7,
  }));

  const booking = [
    {
      poi_id: "poi_restaurant",
      booking_required: false,
      booking_supported_by_system: false,
      status: "not_required",
      required_user_action: "None",
      booking_hint: "Walk-in is usually available.",
      source: "stub",
      confidence: 0.7,
    },
    {
      poi_id: "poi_park",
      booking_required: true,
      booking_supported_by_system: false,
      status: "pending_user_action",
      required_user_action: "Check official channel",
      booking_hint: "Check official visitor requirements before departure.",
      source: "stub",
      confidence: 0.7,
    },
  ];

  const action = [
    {
      poi_id: "poi_restaurant",
      actions: [
        navigation("poi_restaurant", pois[0]),
        share("Restaurant"),
        reminder("Restaurant"),
        copyAddress("Road 1"),
      ],
    },
    {
      poi_id: "poi_park",
      actions: [
        navigation("poi_park", pois[1]),
        share("Park"),
        reminder("Park"),
        copyAddress("Road 2"),
        bookingHint(),
      ],
    },
  ];

  return { pois, hours, price, queue, booking, action };
}

function navigation(_poiId, poi) {
  return {
    action_type: "navigation",
    label: "Navigate",
    provider: "amap_uri",
    uri: `amapuri://route/plan/?dlat=${poi.latitude}&dlon=${poi.longitude}&dname=${encodeURIComponent(poi.name)}`,
    requires_user_confirmation: true,
  };
}

function share(title) {
  return {
    action_type: "share",
    label: "Share",
    payload: { title, content: `Share ${title}` },
    requires_user_confirmation: true,
  };
}

function reminder(title) {
  return {
    action_type: "reminder",
    label: "Reminder",
    payload: { title, remind_offset_minutes: 30, message: "Prepare to leave." },
    requires_user_confirmation: true,
  };
}

function copyAddress(text) {
  return {
    action_type: "copy_address",
    label: "Copy address",
    payload: { text },
    requires_user_confirmation: true,
  };
}

function bookingHint() {
  return {
    action_type: "booking_hint",
    label: "Booking hint",
    payload: {
      required_user_action: "Check official channel",
      booking_hint: "Check official visitor requirements before departure.",
    },
    requires_user_confirmation: true,
  };
}

function expectErrors(report, pattern) {
  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), pattern);
}

test("complete valid dataset passes", () => {
  const report = validateAllMockData(createValidDataset());

  assert.equal(report.ok, true);
  assert.deepEqual(report.errors, []);
});

test("missing provider file reports an error", () => {
  const missingPath = path.join(os.tmpdir(), `missing-${Date.now()}.json`);

  assert.throws(() => loadJsonArray(missingPath, "missing"), /missing file/);
});

test("provider file that is not an array reports an error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mock-validate-"));
  const file = path.join(dir, "bad.json");
  fs.writeFileSync(file, JSON.stringify({ ok: true }), "utf8");

  assert.throws(() => loadJsonArray(file, "bad"), /must be a JSON array/);
});

test("missing poi_id reports an error", () => {
  const data = createValidDataset();
  delete data.hours[0].poi_id;

  const report = validateProviderAlignment("hours_mock.json", data.hours, data.pois);

  expectErrors(report, /missing poi_id/);
});

test("extra provider poi_id reports an error", () => {
  const data = createValidDataset();
  data.price[0].poi_id = "poi_extra";

  const report = validateProviderAlignment("price_mock.json", data.price, data.pois);

  expectErrors(report, /extra poi_id/);
});

test("missing provider poi_id reports an error", () => {
  const data = createValidDataset();
  data.queue.pop();

  const report = validateProviderAlignment("queue_mock.json", data.queue, data.pois);

  expectErrors(report, /missing in queue_mock\.json/);
});

test("duplicate provider poi_id reports an error", () => {
  const data = createValidDataset();
  data.booking[1].poi_id = data.booking[0].poi_id;

  const report = validateProviderAlignment("booking_mock.json", data.booking, data.pois);

  expectErrors(report, /duplicate poi_id/);
});

test("invalid POI type reports an error", () => {
  const data = createValidDataset();
  data.pois[0].type = "hotel";

  const report = validatePoiDataset(data.pois);

  expectErrors(report, /invalid type/);
});

test("invalid Hours source reports an error", () => {
  const data = createValidDataset();
  data.hours[0].source = "live_api";

  const report = validateHoursDataset(data.hours);

  expectErrors(report, /invalid source/);
});

test("Hours closed_days conflict with open_intervals reports an error", () => {
  const data = createValidDataset();
  data.hours[0].open_intervals[0].day_of_week = "Tue-Sun";
  data.hours[0].closed_days = ["Tuesday"];

  const report = validateHoursDataset(data.hours);

  expectErrors(report, /closed_days conflicts/);
});

test("restaurant POI without restaurant price reports an error", () => {
  const data = createValidDataset();
  data.price[0].avg_price = 0;

  const report = validatePriceDataset(data.price, data.pois);

  expectErrors(report, /restaurant price/);
});

test("free price with non-zero values reports an error", () => {
  const data = createValidDataset();
  data.price[1].adult_price = 20;

  const report = validatePriceDataset(data.price, data.pois);

  expectErrors(report, /free price/);
});

test("Queue source must be estimated_mock", () => {
  const data = createValidDataset();
  data.queue[0].source = "manual_mock";

  const report = validateQueueDataset(data.queue);

  expectErrors(report, /source must be estimated_mock/);
});

test("Queue realtime text reports an error", () => {
  const data = createValidDataset();
  data.queue[0].reason = `Uses ${forbiddenChineseLive} data`;

  const report = validateQueueDataset(data.queue);

  expectErrors(report, /forbidden text/);
});

test("Booking booking_supported_by_system true reports an error", () => {
  const data = createValidDataset();
  data.booking[0].booking_supported_by_system = true;

  const report = validateBookingDataset(data.booking);

  expectErrors(report, /booking_supported_by_system/);
});

test("Booking forbidden text reports an error", () => {
  const data = createValidDataset();
  data.booking[0].booking_hint = `User is ${forbiddenChineseBooked}`;

  const report = validateBookingDataset(data.booking);

  expectErrors(report, /forbidden text/);
});

test("Action requires_user_confirmation false reports an error", () => {
  const data = createValidDataset();
  data.action[0].actions[0].requires_user_confirmation = false;

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /requires_user_confirmation/);
});

test("Action missing required base action reports an error", () => {
  const data = createValidDataset();
  data.action[0].actions = data.action[0].actions.filter((action) => action.action_type !== "share");

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /missing required action share/);
});

test("Action pending_user_action missing booking_hint reports an error", () => {
  const data = createValidDataset();
  data.action[1].actions = data.action[1].actions.filter((action) => action.action_type !== "booking_hint");

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /pending_user_action missing booking_hint/);
});

test("Action non-pending booking with booking_hint reports an error", () => {
  const data = createValidDataset();
  data.action[0].actions.push(bookingHint());

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /non-pending booking has booking_hint/);
});

test("Action forbidden text reports an error", () => {
  const data = createValidDataset();
  data.action[0].actions[0].label = `${forbiddenChineseNavigated} success`;

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /forbidden text/);
});

test("Action navigation uri missing dlat dlon or dname reports an error", () => {
  const data = createValidDataset();
  data.action[0].actions[0].uri = "amapuri://route/plan/?dlat=31.1";

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /navigation uri missing/);
});

test("Action copy_address missing payload.text reports an error", () => {
  const data = createValidDataset();
  delete data.action[0].actions.find((action) => action.action_type === "copy_address").payload.text;

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /copy_address missing payload.text/);
});

test("Action copy_address that does not match POI address reports an error", () => {
  const data = createValidDataset();
  data.action[0].actions.find((action) => action.action_type === "copy_address").payload.text = "Other road";

  const report = validateActionDataset(data.action, data.pois, data.booking);

  expectErrors(report, /copy_address does not include POI address/);
});

test("containsForbiddenText and collectDistribution expose reusable helpers", () => {
  assert.equal(containsForbiddenText("booked", ["booked"]), true);
  assert.equal(containsForbiddenText("poi_sh_mao_livehouse", ["live"]), false);
  assert.deepEqual(collectDistribution([{ type: "a" }, { type: "a" }, { type: "b" }], "type"), {
    a: 2,
    b: 1,
  });
});
