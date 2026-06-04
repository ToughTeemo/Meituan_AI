import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_HOURS_SOURCES,
  buildHoursForPoi,
  generateHoursDataset,
  validateHoursDataset,
} from "./generate-hours-mock.mjs";

const basePoi = {
  poi_id: "poi_test",
  type: "attraction",
  category: "museum",
  tags: ["室内", "文化"],
};

test("generateHoursDataset creates one hours record for every POI", () => {
  const pois = [
    { ...basePoi, poi_id: "poi_a" },
    { ...basePoi, poi_id: "poi_b", type: "restaurant", category: "shanghai_food" },
  ];

  const hours = generateHoursDataset(pois, []);

  assert.deepEqual(hours.map((item) => item.poi_id), ["poi_a", "poi_b"]);
});

test("validateHoursDataset rejects records for unknown poi_id", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }];
  const hours = [
    buildHoursForPoi(pois[0]),
    { ...buildHoursForPoi(pois[0]), poi_id: "poi_missing" },
  ];

  const report = validateHoursDataset(hours, pois);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Unknown poi_id/);
});

test("museum defaults to Tuesday-Sunday and closes Monday", () => {
  const hours = buildHoursForPoi({ ...basePoi, category: "museum" });

  assert.equal(hours.hours_label, "09:00-17:00");
  assert.deepEqual(hours.closed_days, ["Monday"]);
  assert.deepEqual(hours.open_intervals, [{ day_of_week: "Tue-Sun", start: "09:00", end: "17:00" }]);
});

test("park and landmark use long or all-day opening defaults", () => {
  const park = buildHoursForPoi({ ...basePoi, category: "park", tags: ["公园"] });
  const landmark = buildHoursForPoi({ ...basePoi, category: "landmark", tags: ["地标"] });

  assert.equal(park.hours_label, "05:00-21:00");
  assert.equal(landmark.hours_label, "全天开放");
  assert.deepEqual(landmark.open_intervals, [{ day_of_week: "Mon-Sun", start: "00:00", end: "24:00" }]);
});

test("restaurant defaults to 11:00-21:30", () => {
  const hours = buildHoursForPoi({ ...basePoi, type: "restaurant", category: "shanghai_food" });

  assert.equal(hours.hours_label, "11:00-21:30");
  assert.deepEqual(hours.open_intervals, [{ day_of_week: "Mon-Sun", start: "11:00", end: "21:30" }]);
});

test("cafe defaults to 08:00-21:00", () => {
  const hours = buildHoursForPoi({ ...basePoi, type: "cafe", category: "cafe" });

  assert.equal(hours.hours_label, "08:00-21:00");
  assert.deepEqual(hours.open_intervals, [{ day_of_week: "Mon-Sun", start: "08:00", end: "21:00" }]);
});

test("mall defaults to 10:00-22:00", () => {
  const hours = buildHoursForPoi({ ...basePoi, type: "mall", category: "shopping_mall" });

  assert.equal(hours.hours_label, "10:00-22:00");
  assert.deepEqual(hours.open_intervals, [{ day_of_week: "Mon-Sun", start: "10:00", end: "22:00" }]);
});

test("entertainment defaults to 10:00-21:00", () => {
  const hours = buildHoursForPoi({ ...basePoi, type: "entertainment", category: "family_activity" });

  assert.equal(hours.hours_label, "10:00-21:00");
  assert.deepEqual(hours.open_intervals, [{ day_of_week: "Mon-Sun", start: "10:00", end: "21:00" }]);
});

test("confidence is between 0 and 1 and source is allowed", () => {
  const hours = buildHoursForPoi(basePoi);

  assert.equal(typeof hours.confidence, "number");
  assert.ok(hours.confidence >= 0 && hours.confidence <= 1);
  assert.ok(ALLOWED_HOURS_SOURCES.has(hours.source));
});

test("Amap opentime raw data is preferred when parseable", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week: "周二-周日 09:00-17:00开放 最晚进入16:00；周一 全天不开放",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.equal(hours.source, "amap");
  assert.equal(hours.confidence, 0.9);
  assert.equal(hours.hours_label, "09:00-17:00");
  assert.deepEqual(hours.closed_days, ["Monday"]);
  assert.equal(hours.last_entry_time, "16:00");
});

test("Amap closed day parser handles non-Monday closed days", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week: "周一, 周三-周日 09:00-17:00开放；周二 全天不开放",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.deepEqual(hours.closed_days, ["Tuesday"]);
  assert.equal(hours.open_intervals[0].day_of_week, "Mon,Wed-Sun");
});

test("Amap parser handles Tuesday-Sunday open with Monday closed", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week: "周二至周日 09:00-17:00开放；周一闭馆",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.equal(hours.open_intervals[0].day_of_week, "Tue-Sun");
  assert.deepEqual(hours.closed_days, ["Monday"]);
});

test("Amap parser handles Monday-Sunday open with no closed days", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week: "周一至周日 10:00-22:00",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.equal(hours.open_intervals[0].day_of_week, "Mon-Sun");
  assert.deepEqual(hours.closed_days, []);
});

test("Amap parser handles all-year no-rest text", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week: "全年无休 10:00-22:00",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.equal(hours.open_intervals[0].day_of_week, "Mon-Sun");
  assert.deepEqual(hours.closed_days, []);
});

test("Amap parser can extract Monday closed without treating Tuesday-Sunday as closed", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week: "周二至周日 09:00-17:00；周一闭馆",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.deepEqual(hours.closed_days, ["Monday"]);
  assert.ok(!hours.closed_days.includes("Tuesday"));
});

test("validateHoursDataset warns when closed days conflict with open intervals", () => {
  const pois = [{ ...basePoi, poi_id: "poi_conflict" }];
  const hours = [
    {
      ...buildHoursForPoi(pois[0]),
      open_intervals: [{ day_of_week: "Tue-Sun", start: "09:00", end: "17:00" }],
      closed_days: ["Tuesday"],
    },
  ];

  const report = validateHoursDataset(hours, pois);

  assert.equal(report.ok, true);
  assert.match(report.warnings.join("\n"), /closed_days conflicts with open_intervals/);
});

test("complex multi-segment Amap hours fall back to category estimate", () => {
  const rawRecord = {
    seed: { poi_id: "poi_test" },
    selected_amap_poi_id: "B001",
    attempts: [
      {
        response: {
          pois: [
            {
              id: "B001",
              business: {
                opentime_week:
                  "04/01-12/31 周一, 周三-周五, 周日 09:00-17:00开放；04/01-12/31 周二 全天不开放；04/01-12/31 周六 09:00-20:00开放；端午节,中秋节,国庆节 09:00-20:00开放",
              },
            },
          ],
        },
      },
    ],
  };

  const hours = buildHoursForPoi(basePoi, rawRecord);

  assert.equal(hours.source, "category_estimated_mock");
  assert.deepEqual(hours.closed_days, ["Monday"]);
});
