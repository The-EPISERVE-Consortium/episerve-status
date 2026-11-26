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
    out.push({ date, colour: dayColour(series[date]) });
  }
  return out;
}

export function downloadsSummary(flows) {
  const dl = (flows || []).filter((f) => f.group === "downloads");
  const lastRuns = dl.map((f) => f.last_run).filter(Boolean).sort();
  const nextRuns = dl.map((f) => f.next_run).filter(Boolean).sort();
  const okCount = dl.filter((f) => f.ok).length;
  return {
    okCount,
    total: dl.length,
    lastRun: lastRuns.length ? lastRuns[lastRuns.length - 1] : null,
    nextRun: nextRuns.length ? nextRuns[0] : null,
    ok: okCount === dl.length,
  };
}
