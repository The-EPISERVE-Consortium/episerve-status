import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STALE_MS, isStale, banner, alertsLine, dayColour, lastDays, downloadsSummary, barSummary, dayLabel,
} from "../render.js";

const now = new Date("2026-11-26T18:00:00Z");
const ago = (min) => new Date(now.getTime() - min * 60000).toISOString();
const fresh = (items = { a: { ok: true } }, flows = []) => ({
  generated_at: ago(10), items, flows,
});

test("stale constant is 2.5 hours", () => {
  assert.equal(STALE_MS, 2.5 * 3600 * 1000);
});

test("isStale boundary", () => {
  assert.equal(isStale(ago(149), now), false);
  assert.equal(isStale(ago(151), now), true);
});

test("test_banner_when_data_missing", () => {
  assert.deepEqual(banner(null, now), { level: "missing", text: "Status data unavailable" });
});

test("banner stale wins over down", () => {
  const s = { generated_at: ago(200), items: { a: { ok: false } }, flows: [] };
  assert.deepEqual(banner(s, now), { level: "stale", text: "Status data is outdated" });
});

test("banner down on item or flow", () => {
  assert.deepEqual(banner(fresh({ a: { ok: false } }), now),
    { level: "down", text: "Partial outage" });
  assert.equal(banner(fresh({ a: { ok: true } }, [{ ok: false }]), now).level, "down");
});

test("banner ok", () => {
  assert.deepEqual(banner(fresh({ a: { ok: true } }, [{ ok: true }]), now),
    { level: "ok", text: "All systems operational" });
});

test("alertsLine", () => {
  assert.deepEqual(alertsLine({ warning: 1, critical: 0 }),
    { level: "warning", text: "Active alerts: 1 warning, 0 critical" });
  assert.deepEqual(alertsLine({ warning: 0, critical: 2 }),
    { level: "critical", text: "Active alerts: 0 warning, 2 critical" });
  assert.equal(alertsLine({ warning: 1, critical: 1 }).level, "critical");
  assert.equal(alertsLine({ warning: 0, critical: 0 }).level, "ok");
  assert.deepEqual(alertsLine(null),
    { level: "unknown", text: "Active alerts: unknown" });
});

test("dayColour", () => {
  assert.equal(dayColour([24, 24]), "ok");
  assert.equal(dayColour([20, 24]), "partial");
  assert.equal(dayColour([0, 24]), "down");
});

test("test_day_colour_no_samples_is_grey", () => {
  assert.equal(dayColour(undefined), "nodata");
  assert.equal(dayColour([0, 0]), "nodata");
});

test("lastDays", () => {
  const today = new Date("2026-11-26T18:00:00Z");
  const days = lastDays({ k: { "2026-11-26": [1, 1], "2026-11-25": [0, 2] } }, "k", today);
  assert.equal(days.length, 30);
  assert.equal(days[29].date, "2026-11-26");
  assert.equal(days[29].colour, "ok");
  assert.equal(days[28].colour, "down");
  assert.equal(days[0].date, "2026-10-28");
  assert.equal(days[0].colour, "nodata");
  assert.equal(lastDays({}, "missing", today).length, 30);
});

test("downloadsSummary", () => {
  const flows = [
    { name: "x", group: "other", last_run: "2030-01-01T00:00:00Z", next_run: "2020-01-01T00:00:00Z", ok: true },
    { name: "a", group: "downloads", last_run: "2026-11-26T01:00:00Z", next_run: "2026-11-27T01:00:00Z", ok: true },
    { name: "b", group: "downloads", last_run: "2026-11-25T01:00:00Z", next_run: "2026-11-27T00:00:00Z", ok: false },
    { name: "c", group: "downloads", last_run: "2026-11-24T01:00:00Z", next_run: null, ok: true },
  ];
  assert.deepEqual(downloadsSummary(flows), {
    okCount: 2, total: 3, ok: false,
    lastRun: "2026-11-26T01:00:00Z", nextRun: "2026-11-27T00:00:00Z",
  });
});

test("barSummary", () => {
  const days = [
    ...Array.from({ length: 28 }, () => ({ colour: "ok" })),
    { colour: "partial" }, { colour: "down" },
  ];
  assert.equal(barSummary(days), "30-day history, 28 of 30 days fully up, 1 partly down, 1 down");
  assert.equal(barSummary([{ colour: "nodata" }, { colour: "ok" }]),
    "2-day history, 1 of 2 days fully up, 1 without data");
});

test("dayLabel", () => {
  assert.equal(dayLabel({ date: "2026-11-25", colour: "ok" }), "2026-11-25: fully up");
  assert.equal(dayLabel({ date: "2026-11-25", colour: "partial" }), "2026-11-25: partly down");
  assert.equal(dayLabel({ date: "2026-11-25", colour: "down" }), "2026-11-25: down");
  assert.equal(dayLabel({ date: "2026-11-25", colour: "nodata" }), "2026-11-25: no data");
});
