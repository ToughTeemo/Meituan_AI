import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ALLOWED_ACTION_TYPES,
  buildActionsForPoi,
  buildNavigationAction,
  containsForbiddenActionText,
  generateActionDataset,
  validateActionDataset,
} from "./generate-action-mock.mjs";

const basePoi = {
  poi_id: "poi_test",
  name: "上海自然博物馆",
  address: "北京西路510号",
  latitude: 31.235021,
  longitude: 121.462672,
  tags: ["亲子", "室内", "科普"],
  type: "attraction",
  category: "museum",
};

const pendingBooking = {
  poi_id: "poi_test",
  status: "pending_user_action",
  required_user_action: "前往官方渠道预约",
  booking_hint: "热门文化展馆建议提前预约，当前系统仅提供预约提醒，不代为预约。",
};

const notRequiredBooking = {
  poi_id: "poi_test",
  status: "not_required",
  required_user_action: "无需预约，可直接前往。",
  booking_hint: "通常无需预约。",
};

function actionTypes(record) {
  return record.actions.map((action) => action.action_type);
}

test("generateActionDataset creates one action record for every POI", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }, { ...basePoi, poi_id: "poi_b" }];
  const bookings = pois.map((poi) => ({ ...notRequiredBooking, poi_id: poi.poi_id }));

  const records = generateActionDataset(pois, bookings);

  assert.deepEqual(records.map((record) => record.poi_id), ["poi_a", "poi_b"]);
});

test("validateActionDataset rejects records for unknown poi_id", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }];
  const records = [
    { poi_id: "poi_missing", actions: buildActionsForPoi(pois[0], notRequiredBooking) },
  ];

  const report = validateActionDataset(records, pois, []);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Unknown poi_id/);
});

test("every POI includes navigation share reminder and copy_address", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);
  const types = actionTypes({ actions });

  assert.ok(types.includes("navigation"));
  assert.ok(types.includes("share"));
  assert.ok(types.includes("reminder"));
  assert.ok(types.includes("copy_address"));
});

test("pending_user_action generates booking_hint", () => {
  const actions = buildActionsForPoi(basePoi, pendingBooking);

  assert.ok(actions.some((action) => action.action_type === "booking_hint"));
});

test("not_required does not generate booking_hint", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);

  assert.ok(!actions.some((action) => action.action_type === "booking_hint"));
});

test("all actions require user confirmation", () => {
  const actions = buildActionsForPoi(basePoi, pendingBooking);

  assert.ok(actions.every((action) => action.requires_user_confirmation === true));
});

test("action types are in allowed enum", () => {
  const actions = buildActionsForPoi(basePoi, pendingBooking);

  assert.ok(actions.every((action) => ALLOWED_ACTION_TYPES.has(action.action_type)));
});

test("navigation uri contains dlat dlon and dname", () => {
  const action = buildNavigationAction(basePoi);

  assert.match(action.uri, /dlat=31\.235021/);
  assert.match(action.uri, /dlon=121\.462672/);
  assert.match(action.uri, /dname=/);
});

test("navigation dname uses encodeURIComponent", () => {
  const action = buildNavigationAction(basePoi);

  assert.match(action.uri, new RegExp(`dname=${encodeURIComponent(basePoi.name)}`));
});

test("share payload contains title and content", () => {
  const share = buildActionsForPoi(basePoi, notRequiredBooking).find((action) => action.action_type === "share");

  assert.equal(share.payload.title, basePoi.name);
  assert.ok(share.payload.content.includes(basePoi.name));
});

test("reminder payload contains title offset and message", () => {
  const reminder = buildActionsForPoi(basePoi, notRequiredBooking).find((action) => action.action_type === "reminder");

  assert.ok(reminder.payload.title);
  assert.equal(typeof reminder.payload.remind_offset_minutes, "number");
  assert.ok(reminder.payload.message);
});

test("copy_address payload contains text", () => {
  const copyAddress = buildActionsForPoi(basePoi, notRequiredBooking).find((action) => action.action_type === "copy_address");

  assert.equal(copyAddress.payload.text, basePoi.address);
});

test("forbidden Chinese action text is detected", () => {
  assert.equal(containsForbiddenActionText("已预约"), true);
  assert.equal(containsForbiddenActionText("导航到上海自然博物馆"), false);
});

test("forbidden English action text is detected", () => {
  assert.equal(containsForbiddenActionText("booked successfully"), true);
  assert.equal(containsForbiddenActionText("set reminder"), false);
});

test("validateActionDataset catches duplicate poi_id", () => {
  const record = { poi_id: "poi_a", actions: buildActionsForPoi({ ...basePoi, poi_id: "poi_a" }, notRequiredBooking) };
  const report = validateActionDataset([record, record], [{ ...basePoi, poi_id: "poi_a" }], []);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Duplicate poi_id/);
});

test("validateActionDataset catches missing poi_id coverage", () => {
  const pois = [{ ...basePoi, poi_id: "poi_a" }, { ...basePoi, poi_id: "poi_b" }];
  const record = { poi_id: "poi_a", actions: buildActionsForPoi(pois[0], notRequiredBooking) };

  const report = validateActionDataset([record], pois, []);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /Count mismatch|Missing action/);
});

test("validateActionDataset catches empty actions", () => {
  const report = validateActionDataset([{ poi_id: "poi_test", actions: [] }], [basePoi], []);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /actions is empty/);
});

test("validateActionDataset catches requires_user_confirmation false", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);
  actions[0].requires_user_confirmation = false;
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [notRequiredBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /requires_user_confirmation is not true/);
});

test("validateActionDataset catches pending_user_action missing booking_hint", () => {
  const actions = buildActionsForPoi(basePoi, pendingBooking).filter((action) => action.action_type !== "booking_hint");
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [pendingBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /pending_user_action missing booking_hint/);
});

test("validateActionDataset catches booking_hint for non-pending booking", () => {
  const actions = [...buildActionsForPoi(basePoi, notRequiredBooking), buildActionsForPoi(basePoi, pendingBooking).find((action) => action.action_type === "booking_hint")];
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [notRequiredBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /non-pending booking generated booking_hint/);
});

test("validateActionDataset catches navigation missing uri", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);
  delete actions.find((action) => action.action_type === "navigation").uri;
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [notRequiredBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /navigation missing uri/);
});

test("validateActionDataset catches share missing payload", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);
  delete actions.find((action) => action.action_type === "share").payload;
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [notRequiredBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /share missing payload/);
});

test("validateActionDataset catches reminder missing payload", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);
  delete actions.find((action) => action.action_type === "reminder").payload;
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [notRequiredBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /reminder missing payload/);
});

test("validateActionDataset catches copy_address missing payload text", () => {
  const actions = buildActionsForPoi(basePoi, notRequiredBooking);
  delete actions.find((action) => action.action_type === "copy_address").payload.text;
  const report = validateActionDataset([{ poi_id: "poi_test", actions }], [basePoi], [notRequiredBooking]);

  assert.equal(report.ok, false);
  assert.match(report.errors.join("\n"), /copy_address missing payload.text/);
});
