import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_BOOKING_STATUSES,
  buildBookingForPoi,
  containsForbiddenBookingState,
  generateBookingDataset,
  validateBookingDataset,
} from "./generate-booking-mock.mjs";

const basePoi = {
  poi_id: "poi_test",
  name: "Test POI",
  type: "attraction",
  category: "museum",
  tags: ["室内", "文化"],
};

test("generateBookingDataset creates one booking record for every POI", () => {
  const pois = [
    { ...basePoi, poi_id: "poi_a" },
    { ...basePoi, poi_id: "poi_b", type: "restaurant", category: "shanghai_food" },
  ];

  const bookings = generateBookingDataset(pois, [], [], []);

  assert.deepEqual(bookings.map((item) => item.poi_id), ["poi_a", "poi_b"]);
});

test("validateBookingDataset rejects records for unknown poi_id", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }];
  const bookings = [
    buildBookingForPoi(pois[0]),
    { ...buildBookingForPoi(pois[0]), poi_id: "poi_missing" },
  ];

  const report = validateBookingDataset(bookings, pois);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Unknown poi_id/);
});

test("booking_supported_by_system is always false", () => {
  const booking = buildBookingForPoi(basePoi);

  assert.equal(booking.booking_supported_by_system, false);
});

test("source is always stub", () => {
  const booking = buildBookingForPoi(basePoi);

  assert.equal(booking.source, "stub");
});

test("status is in allowed enum", () => {
  const booking = buildBookingForPoi(basePoi);

  assert.ok(ALLOWED_BOOKING_STATUSES.has(booking.status));
});

test("forbidden completed states are detected", () => {
  assert.equal(containsForbiddenBookingState("booked and paid"), true);
  assert.equal(containsForbiddenBookingState("已预约"), true);
  assert.equal(containsForbiddenBookingState("请前往官方渠道预约"), false);
});

test("museum and exhibition require pending user action", () => {
  const museum = buildBookingForPoi({ ...basePoi, category: "museum" });
  const exhibition = buildBookingForPoi({ ...basePoi, category: "exhibition" });

  assert.equal(museum.status, "pending_user_action");
  assert.equal(exhibition.status, "pending_user_action");
});

test("aquarium and family activity require pending user action", () => {
  const aquarium = buildBookingForPoi({ ...basePoi, category: "aquarium" });
  const family = buildBookingForPoi({ ...basePoi, type: "entertainment", category: "family_activity" });

  assert.equal(aquarium.status, "pending_user_action");
  assert.equal(family.status, "pending_user_action");
});

test("theater livehouse ktv entertainment require user action or not supported", () => {
  const theater = buildBookingForPoi({ ...basePoi, type: "entertainment", category: "theater" });
  const livehouse = buildBookingForPoi({ ...basePoi, type: "entertainment", category: "livehouse" });
  const ktv = buildBookingForPoi({ ...basePoi, type: "entertainment", category: "ktv" });

  assert.ok(["pending_user_action", "not_supported"].includes(theater.status));
  assert.ok(["pending_user_action", "not_supported"].includes(livehouse.status));
  assert.ok(["pending_user_action", "not_supported"].includes(ktv.status));
  assert.equal(containsForbiddenBookingState(JSON.stringify([theater, livehouse, ktv])), false);
});

test("restaurant defaults to not_required with consultation hint", () => {
  const booking = buildBookingForPoi({ ...basePoi, type: "restaurant", category: "hotpot" });

  assert.equal(booking.status, "not_required");
  assert.match(booking.booking_hint, /高峰|咨询|等位/);
});

test("cafe defaults to not_required", () => {
  const booking = buildBookingForPoi({ ...basePoi, type: "cafe", category: "cafe" });

  assert.equal(booking.status, "not_required");
});

test("mall park and landmark default to not_required", () => {
  const mall = buildBookingForPoi({ ...basePoi, type: "mall", category: "shopping_mall" });
  const park = buildBookingForPoi({ ...basePoi, category: "park" });
  const landmark = buildBookingForPoi({ ...basePoi, category: "landmark", tags: ["地标"] });

  assert.equal(mall.status, "not_required");
  assert.equal(park.status, "not_required");
  assert.equal(landmark.status, "not_required");
});

test("pending_user_action has required_user_action", () => {
  const booking = buildBookingForPoi(basePoi);

  assert.equal(booking.status, "pending_user_action");
  assert.ok(booking.required_user_action);
});

test("booking_hint is non-empty", () => {
  const booking = buildBookingForPoi(basePoi);

  assert.ok(booking.booking_hint);
});

test("confidence is between 0 and 1", () => {
  const booking = buildBookingForPoi(basePoi);

  assert.ok(booking.confidence >= 0 && booking.confidence <= 1);
});

test("validateBookingDataset catches duplicate poi_id", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const booking = buildBookingForPoi(poi);
  const report = validateBookingDataset([booking, booking], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Duplicate poi_id/);
});

test("validateBookingDataset catches missing poi_id coverage", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }, { ...basePoi, poi_id: "poi_b" }];
  const report = validateBookingDataset([buildBookingForPoi(pois[0])], pois);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Count mismatch|Missing booking/);
});

test("validateBookingDataset catches booking_supported_by_system true", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const booking = { ...buildBookingForPoi(poi), booking_supported_by_system: true };
  const report = validateBookingDataset([booking], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /booking_supported_by_system is not false/);
});

test("validateBookingDataset catches source not stub", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const booking = { ...buildBookingForPoi(poi), source: "official" };
  const report = validateBookingDataset([booking], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /source is not stub/);
});

test("validateBookingDataset catches invalid status", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const booking = { ...buildBookingForPoi(poi), status: "booked" };
  const report = validateBookingDataset([booking], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Invalid status|forbidden booking state/);
});

test("validateBookingDataset catches forbidden word", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const booking = { ...buildBookingForPoi(poi), booking_hint: "系统已购票" };
  const report = validateBookingDataset([booking], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /forbidden booking state/);
});
