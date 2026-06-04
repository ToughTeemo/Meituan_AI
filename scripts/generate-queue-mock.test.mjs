import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_QUEUE_LEVELS,
  buildQueueForPoi,
  generateQueueDataset,
  validateQueueDataset,
} from "./generate-queue-mock.mjs";

const basePoi = {
  poi_id: "poi_test",
  name: "Test POI",
  type: "attraction",
  category: "museum",
  tags: ["室内", "文化"],
};

function profileByScenario(record, scenario) {
  return record.queue_profiles.find((profile) => profile.scenario === scenario);
}

test("generateQueueDataset creates one queue record for every POI", () => {
  const pois = [
    { ...basePoi, poi_id: "poi_a" },
    { ...basePoi, poi_id: "poi_b", type: "restaurant", category: "shanghai_food" },
  ];

  const queues = generateQueueDataset(pois, [], []);

  assert.deepEqual(queues.map((item) => item.poi_id), ["poi_a", "poi_b"]);
});

test("validateQueueDataset rejects records for unknown poi_id", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }];
  const queues = [
    buildQueueForPoi(pois[0]),
    { ...buildQueueForPoi(pois[0]), poi_id: "poi_missing" },
  ];

  const report = validateQueueDataset(queues, pois);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Unknown poi_id/);
});

test("all queue records use estimated_mock source", () => {
  const queue = buildQueueForPoi(basePoi);

  assert.equal(queue.source, "estimated_mock");
});

test("queue records do not contain realtime or live wording", () => {
  const queue = buildQueueForPoi(basePoi);
  const text = JSON.stringify(queue);

  assert.doesNotMatch(text, /realtime|real_time|live|当前实时|实时/i);
});

test("restaurant generates lunch and dinner profiles", () => {
  const queue = buildQueueForPoi({ ...basePoi, type: "restaurant", category: "hotpot" });
  const scenarios = queue.queue_profiles.map((profile) => profile.scenario);

  assert.ok(scenarios.includes("weekday_lunch"));
  assert.ok(scenarios.includes("weekday_dinner"));
  assert.ok(scenarios.includes("weekend_dinner"));
});

test("cafe generates weekday and weekend afternoon profiles", () => {
  const queue = buildQueueForPoi({ ...basePoi, type: "cafe", category: "cafe" });
  const scenarios = queue.queue_profiles.map((profile) => profile.scenario);

  assert.ok(scenarios.includes("weekday_afternoon"));
  assert.ok(scenarios.includes("weekend_afternoon"));
});

test("museum weekend afternoon is higher than weekday afternoon", () => {
  const queue = buildQueueForPoi({ ...basePoi, category: "museum" });

  assert.ok(profileByScenario(queue, "weekend_afternoon").estimated_wait_minutes > profileByScenario(queue, "weekday_afternoon").estimated_wait_minutes);
});

test("park and landmark have low default wait", () => {
  const park = buildQueueForPoi({ ...basePoi, category: "park" });
  const landmark = buildQueueForPoi({ ...basePoi, category: "landmark", tags: ["地标"] });

  assert.equal(park.default_queue_level, "low");
  assert.ok(park.default_wait_minutes <= 10);
  assert.equal(landmark.default_queue_level, "low");
  assert.ok(landmark.default_wait_minutes <= 10);
});

test("family activity and aquarium have high weekend or holiday afternoon", () => {
  const aquarium = buildQueueForPoi({ ...basePoi, category: "aquarium" });
  const family = buildQueueForPoi({ ...basePoi, type: "entertainment", category: "family_activity" });

  assert.equal(profileByScenario(aquarium, "holiday_afternoon").queue_level, "high");
  assert.equal(profileByScenario(family, "weekend_afternoon").queue_level, "high");
});

test("entertainment weekend evening wait is higher than weekday afternoon", () => {
  const queue = buildQueueForPoi({ ...basePoi, type: "entertainment", category: "livehouse" });

  assert.ok(profileByScenario(queue, "weekend_evening").estimated_wait_minutes > profileByScenario(queue, "weekday_afternoon").estimated_wait_minutes);
});

test("queue levels and wait minutes are valid", () => {
  const queue = buildQueueForPoi(basePoi);

  assert.ok(ALLOWED_QUEUE_LEVELS.has(queue.default_queue_level));
  for (const profile of queue.queue_profiles) {
    assert.ok(ALLOWED_QUEUE_LEVELS.has(profile.queue_level));
    assert.equal(typeof profile.estimated_wait_minutes, "number");
    assert.ok(profile.estimated_wait_minutes >= 0);
  }
});

test("confidence is between 0 and 1", () => {
  const queue = buildQueueForPoi(basePoi);

  assert.ok(queue.confidence >= 0 && queue.confidence <= 1);
});

test("validateQueueDataset catches duplicate poi_id", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const queue = buildQueueForPoi(poi);

  const report = validateQueueDataset([queue, queue], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Duplicate poi_id/);
});

test("validateQueueDataset catches missing poi_id coverage", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }, { ...basePoi, poi_id: "poi_b" }];
  const report = validateQueueDataset([buildQueueForPoi(pois[0])], pois);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Count mismatch|Missing queue/);
});

test("validateQueueDataset catches non-estimated source", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const queue = { ...buildQueueForPoi(poi), source: "realtime" };

  const report = validateQueueDataset([queue], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /source is not estimated_mock|forbidden realtime wording/);
});

test("validateQueueDataset does not flag live substring in stable poi_id", () => {
  const poi = { ...basePoi, poi_id: "poi_sh_mao_livehouse", type: "entertainment", category: "livehouse" };
  const report = validateQueueDataset([buildQueueForPoi(poi)], [poi]);

  assert.equal(report.ok, true);
});

test("validateQueueDataset catches empty queue profiles", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const queue = { ...buildQueueForPoi(poi), queue_profiles: [] };

  const report = validateQueueDataset([queue], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /queue_profiles is empty/);
});

test("validateQueueDataset catches invalid queue level", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const queue = buildQueueForPoi(poi);
  queue.queue_profiles[0].queue_level = "busy";

  const report = validateQueueDataset([queue], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Invalid queue_level/);
});

test("validateQueueDataset catches invalid wait minutes", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const queue = buildQueueForPoi(poi);
  queue.queue_profiles[0].estimated_wait_minutes = -1;

  const report = validateQueueDataset([queue], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Invalid estimated_wait_minutes/);
});

test("validateQueueDataset catches empty reason", () => {
  const poi = { ...basePoi, poi_id: "poi_a" };
  const queue = { ...buildQueueForPoi(poi), reason: "" };

  const report = validateQueueDataset([queue], [poi]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Missing reason/);
});
