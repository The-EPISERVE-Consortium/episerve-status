// Pure helpers for the status page. No DOM access.

export const STALE_MS = 2.5 * 3600 * 1000;

export function isStale(generatedAt, now) {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return true;
  return now.getTime() - t > STALE_MS;
}

export function banner(status, now) {
  if (!status || typeof status !== "object") {
    return { level: "missing", text: "Status data unavailable" };
  }
  if (isStale(status.generated_at, now)) {
    return { level: "stale", text: "Status data is outdated" };
  }
  const items = Object.values(status.items || {});
  const flows = status.flows || [];
  if (items.some((i) => i.ok === false) || flows.some((f) => f.ok === false)) {
    return { level: "down", text: "Partial outage" };
  }
  return { level: "ok", text: "All systems operational" };
}

export function alertsLine(alerts) {
  if (!alerts || typeof alerts.warning !== "number" || typeof alerts.critical !== "number") {
    return { level: "unknown", text: "Active alerts: unknown" };
  }
  const level = alerts.critical > 0 ? "critical" : alerts.warning > 0 ? "warning" : "ok";
  return {
    level,
    text: `Active alerts: ${alerts.warning} warning, ${alerts.critical} critical`,
  };
}

export function dayColour(sample) {
  if (!Array.isArray(sample) || !sample[1]) return "nodata";
  const [ok, total] = sample;
  if (ok >= total) return "ok";
  if (ok <= 0) return "down";
  return "partial";
}

const isoDay = (d) => d.toISOString().slice(0, 10);

export function lastDays(history, key, today, n = 30) {
  const series = (history && history[key]) || {};
  const base = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = isoDay(new Date(base - i * 86400000));
    const sample = series[date];
    const [ok, total] = Array.isArray(sample) ? sample : [0, 0];
    out.push({ date, colour: dayColour(sample), ok, total });
  }
  return out;
}

const DAY_TEXT = { ok: "fully up", partial: "partly down", down: "down", nodata: "no data" };

// lastCheck (e.g. "22:05") is given for today's square only; the day is then not complete.
export function dayLabel(day, lastCheck) {
  let s = `${day.date}: ${DAY_TEXT[day.colour]}`;
  if (day.colour === "nodata" || !day.total) return s;
  const soFar = lastCheck ? " so far" : "";
  if (day.total === 1) s += `, 1 hourly check${soFar}, ${day.ok ? "OK" : "not OK"}`;
  else if (day.ok === day.total) s += `, all ${day.total} hourly checks${soFar} OK`;
  else s += `, ${day.ok} of ${day.total} hourly checks${soFar} OK`;
  if (lastCheck) s += `, last check ${lastCheck}`;
  return s;
}

export function barSummary(days) {
  const n = (c) => days.filter((d) => d.colour === c).length;
  let s = `${days.length}-day history, ${n("ok")} of ${days.length} days fully up`;
  if (n("partial")) s += `, ${n("partial")} partly down`;
  if (n("down")) s += `, ${n("down")} down`;
  if (n("nodata")) s += `, ${n("nodata")} without data`;
  return s;
}

export function compareRelease(a, b) {
  const x = String(a).split(".").map(Number);
  const y = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const UNKNOWN = () => ({ level: "unknown", text: "unknown" });
const DOT = " · ";

export function specCells(row, latest) {
  if (!row) return { github: UNKNOWN(), catalog: UNKNOWN(), api: UNKNOWN() };
  const { github: gh, api, catalog: cat } = row;
  const key = (v) => v.slice().sort((a, b) => a - b).join(",");
  const ghVersions = gh ? key(gh.versions) : null;

  const github = gh
    ? { level: "none", text: `v${gh.release}${DOT}${gh.versions.map((v) => `v${v}`).join(", ")}` }
    : UNKNOWN();

  let apiCell = UNKNOWN();
  if (api) {
    const text = `${api.release}${DOT}${api.versions.map((v) => `v${v}`).join(", ")}`;
    if (latest == null) apiCell = { level: "unknown", text };
    else if (compareRelease(api.release, latest) < 0 ||
             (ghVersions !== null && key(api.versions) !== ghVersions)) {
      apiCell = { level: "behind", text: `${text}${DOT}behind` };
    } else apiCell = { level: "ok", text };
  }

  let catalog = UNKNOWN();
  if (cat && cat.recorded === false) {
    catalog = { level: "notrecorded", text: "not recorded" };
  } else if (cat && cat.total > 0) {
    const rel = cat.releases.length ? `${cat.releases.join(", ")}${DOT}` : "";
    let text = `${rel}${cat.valid}/${cat.total} valid`;
    if (cat.warnings > 0) text += ` (${cat.warnings} with warnings)`;
    if (cat.valid < cat.total) catalog = { level: "invalid", text: `${text}${DOT}invalid` };
    else if (latest == null) catalog = { level: "unknown", text };
    else if (cat.releases.some((r) => compareRelease(r, latest) < 0)) catalog = { level: "behind", text: `${text}${DOT}behind` };
    else catalog = { level: "ok", text };
  }
  return { github, catalog, api: apiCell };
}

// The Workflow Server's components; the "Components" row is up only when all are up.
const COMPONENTS = [
  ["prefect.server", "Server"],
  ["prefect.worker", "Worker"],
  ["prefect.database", "Database"],
  ["prefect.scheduler", "Scheduler"],
];

export function componentsStatus(items) {
  const all = items || {};
  const down = COMPONENTS
    .filter(([key]) => !(all[key] && all[key].ok === true))
    .map(([key, name]) => (all[key] && all[key].name) || name);
  return down.length ? { ok: false, text: `down (${down.join(", ")})` } : { ok: true, text: "up" };
}

// Why a flow is not OK, most specific first.
function flowError(f) {
  if (f.last_state === "failed") return "last run failed";
  if (f.last_state !== "ok") return "never ran";
  if (!f.next_run) return "not scheduled";
  return "late";
}

export function flowsSummary(flows) {
  const list = (flows || []).slice().sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  const errors = list.filter((f) => f.ok !== true).map((f) => ({ name: f.name, reason: flowError(f) }));
  return {
    ok: list.length > 0 && errors.length === 0,
    total: list.length,
    lastOk: list.filter((f) => f.last_state === "ok").length,
    scheduled: list.filter((f) => f.next_run).length,
    errors,
  };
}

// The CronJob runs at minute 5 of every hour (UTC); the next data update is the next such time.
export const UPDATE_MINUTE = 5;

export function nextUpdate(now) {
  const t = new Date(now.getTime());
  t.setUTCSeconds(0, 0);
  t.setUTCMinutes(UPDATE_MINUTE);
  if (t <= now) t.setUTCHours(t.getUTCHours() + 1);
  return t;
}
