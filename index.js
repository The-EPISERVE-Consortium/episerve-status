import { banner, alertsLine, lastDays, downloadsSummary, barSummary, dayLabel } from "./render.js";

const RAW_URL =
  "https://raw.githubusercontent.com/The-EPISERVE-Consortium/episerve-status/data/status.json";
const REFRESH_MS = 10 * 60 * 1000;
const BAR_KEYS = new Set(["prefect.scheduler"]);

// ?src= accepts only a same-origin relative path, e.g. sample.json.
function sourceUrl() {
  const src = new URLSearchParams(location.search).get("src");
  if (src && /^[A-Za-z0-9._/-]+$/.test(src) && !src.startsWith("/") &&
      !src.includes("..") && !src.includes("//")) {
    return src;
  }
  return `${RAW_URL}?t=${Date.now()}`;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

function when(iso, short) {
  const span = el("span", "time");
  if (!iso) { span.textContent = "-"; return span; }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) { span.textContent = "-"; return span; }
  span.textContent = short
    ? d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString();
  span.title = `${d.toISOString().replace(".000Z", "Z")} (UTC)`;
  return span;
}

// Status dot: colour plus glyph plus text label (never colour only).
function dot(ok) {
  const d = el("span", `dot ${ok ? "ok" : "down"}`, ok ? "\u2713" : "\u2715");
  d.setAttribute("role", "img");
  d.setAttribute("aria-label", ok ? "OK" : "Down");
  d.title = ok ? "OK" : "Down";
  return d;
}

function bar(history, key, now) {
  const b = el("div", "bar");
  const days = lastDays(history, key, now);
  b.setAttribute("role", "img");
  b.setAttribute("aria-label", barSummary(days));
  for (const d of days) {
    const i = el("i", d.colour);
    i.title = dayLabel(d);
    b.append(i);
  }
  return b;
}

function itemsOf(status, group) {
  return Object.entries(status.items || {}).filter(([, v]) => v.group === group);
}

function dotItem([, v]) {
  const s = el("span", "item");
  s.append(dot(v.ok), document.createTextNode(v.name));
  return s;
}

function barRow(status, key, v, now, word) {
  const r = el("div", "row");
  r.append(el("span", "", v.name));
  const st = el("span", "status");
  st.append(dot(v.ok), document.createTextNode(v.ok ? word[0] : word[1]));
  r.append(st, bar(status.history, key, now));
  return r;
}

function flowRow(name, f, cls) {
  const r = el(cls === "summary" ? "summary" : "div", "flow");
  r.append(el("span", "name", name), when(f.lastRun, true), when(f.nextRun, true), dot(f.ok));
  return r;
}

function render(status, now) {
  const b = banner(status, now);
  const bn = document.getElementById("banner");
  bn.className = `banner level-${b.level}`;
  bn.textContent = b.text;

  const a = alertsLine(status && status.alerts);
  const al = document.getElementById("alerts");
  al.className = `alerts level-${a.level}`;
  al.textContent = a.text;

  const up = document.getElementById("updated");
  up.className = b.level === "stale" ? "updated stale" : "updated";
  up.textContent = "Last data update: ";
  if (status && status.generated_at) up.append(when(status.generated_at, false));
  else up.append("unknown");

  const pub = document.getElementById("public");
  const pre = document.getElementById("prefect");
  const flows = document.getElementById("flows");
  const pods = document.getElementById("pods");
  for (const c of [pub, pre, flows, pods]) c.replaceChildren();
  if (!status) return;

  for (const [k, v] of itemsOf(status, "public")) {
    pub.append(barRow(status, k, v, now, ["online", "offline"]));
  }

  const dots = el("div", "subdots");
  for (const e of itemsOf(status, "prefect")) {
    if (!BAR_KEYS.has(e[0])) dots.append(dotItem(e));
  }
  pre.append(dots);
  for (const [k, v] of itemsOf(status, "prefect")) {
    if (BAR_KEYS.has(k)) pre.append(barRow(status, k, v, now, ["up", "down"]));
  }

  const head = el("div", "flow head");
  head.append(el("span", "", "Flow"), el("span", "", "Last run"), el("span", "", "Next run"), el("span"));
  flows.append(head);
  const list = (status.flows || []).slice().sort((x, y) => x.name.localeCompare(y.name));
  const dl = list.filter((f) => f.group === "downloads");
  let done = dl.length === 0;
  for (const f of list) {
    if (f.group === "downloads") {
      if (done) continue;
      done = true;
      const s = downloadsSummary(list);
      const d = el("details");
      d.append(flowRow(`Dataset downloads (${s.total}), ${s.okCount}/${s.total} OK`,
        { lastRun: s.lastRun, nextRun: s.nextRun, ok: s.ok }, "summary"));
      for (const m of dl) {
        d.append(flowRow(m.name, { lastRun: m.last_run, nextRun: m.next_run, ok: m.ok }, "row"));
      }
      flows.append(d);
    } else {
      flows.append(flowRow(f.name, { lastRun: f.last_run, nextRun: f.next_run, ok: f.ok }, "row"));
    }
  }

  for (const e of itemsOf(status, "pods")) pods.append(dotItem(e));
}

async function refresh() {
  let status = null;
  try {
    const r = await fetch(sourceUrl(), { cache: "no-store" });
    if (r.ok) status = await r.json();
  } catch (e) {
    status = null;
  }
  render(status, new Date());
}

refresh();
setInterval(refresh, REFRESH_MS);
