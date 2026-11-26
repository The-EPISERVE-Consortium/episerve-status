import { banner, alertsLine, lastDays, barSummary, dayLabel, specCells, componentsStatus, flowsSummary, nextUpdate } from "./render.js";

const RAW_URL =
  "https://raw.githubusercontent.com/The-EPISERVE-Consortium/episerve-status/data/status.json";
const REFRESH_MS = 10 * 60 * 1000;

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

const SPEC_DOTS = {
  ok: ["ok", "\u2713", "OK"],
  behind: ["behind", "!", "Behind"],
  invalid: ["down", "\u2715", "Invalid"],
  unknown: ["nodata", "\u2013", "Unknown"],
  notrecorded: ["nodata", "\u2013", "Not recorded"],
};

function specDot(level) {
  const [cls, glyph, label] = SPEC_DOTS[level];
  const d = el("span", `dot ${cls}`, glyph);
  d.setAttribute("role", "img");
  d.setAttribute("aria-label", label);
  d.title = label;
  return d;
}

function specCell(cell, label) {
  const td = el("td");
  td.dataset.label = label;
  const w = el("span", "speccell");
  if (cell.level !== "none") w.append(specDot(cell.level));
  w.append(document.createTextNode(cell.text));
  td.append(w);
  return td;
}

function specsTable(specs) {
  const t = el("table", "spectable");
  const hr = el("tr");
  const tips = {
    "Data hub sync check": "Release the data hub sync uses to check the model cards, and how many passed",
  };
  for (const h of ["Spec", "GitHub", "Data hub sync check", "API"]) {
    const th = el("th", "", h);
    if (tips[h]) th.title = tips[h];
    hr.append(th);
  }
  const head = el("thead");
  head.append(hr);
  t.append(head);
  const body = el("tbody");
  const latest = specs && typeof specs.latest === "string" ? specs.latest : null;
  const rows = specs && Array.isArray(specs.rows) && specs.rows.length
    ? specs.rows : [{ spec: "model-card" }, { spec: "fdo" }];
  for (const r of rows) {
    const c = specCells(specs ? r : undefined, latest);
    const tr = el("tr");
    const th = el("th", "", r.spec);
    th.scope = "row";
    tr.append(th);
    tr.append(specCell(c.github, "GitHub"), specCell(c.catalog, "Data hub sync check"), specCell(c.api, "API"));
    body.append(tr);
  }
  t.append(body);
  return t;
}

// Local time of the last check, shown in the tooltip of today's square.
let lastCheck = null;

function bar(history, key, now) {
  const b = el("div", "bar");
  const days = lastDays(history, key, now);
  b.setAttribute("role", "img");
  b.setAttribute("aria-label", barSummary(days));
  days.forEach((d, n) => {
    const i = el("i", d.colour);
    i.title = dayLabel(d, n === days.length - 1 ? lastCheck : null);
    b.append(i);
  });
  return b;
}

function itemsOf(status, group) {
  return Object.entries(status.items || {}).filter(([, v]) => v.group === group);
}

function barRow(status, key, v, now, word) {
  const r = el("div", "row");
  r.append(el("span", "", v.name));
  const st = el("span", "status");
  st.append(dot(v.ok), document.createTextNode(v.ok ? word[0] : word[1]));
  r.append(st, bar(status.history, key, now));
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
  up.replaceChildren();
  const last = el("span", "part", "Last data update: ");
  if (status && status.generated_at) last.append(when(status.generated_at, false));
  else last.append("unknown");
  const next = el("span", "part", "Next data update: ");
  next.append(when(nextUpdate(now).toISOString(), false));
  up.append(last, el("span", "sep", " \u00b7 "), next);

  const gen = status && status.generated_at ? new Date(status.generated_at) : null;
  lastCheck = gen && !Number.isNaN(gen.getTime()) &&
    gen.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
    ? gen.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const pub = document.getElementById("public");
  const pre = document.getElementById("prefect");
  const specs = document.getElementById("specs");
  for (const c of [pub, pre, specs]) c.replaceChildren();
  if (!status) return;

  for (const [k, v] of itemsOf(status, "public")) {
    pub.append(barRow(status, k, v, now, ["online", "offline"]));
  }

  const comp = componentsStatus(status.items);
  const cr = el("div", "row");
  cr.append(el("span", "", "All components"));
  const cs = el("span", "status");
  cs.append(dot(comp.ok), document.createTextNode(comp.text));
  cr.append(cs, bar(status.history, "prefect.components", now));
  pre.append(cr);

  const fs = flowsSummary(status.flows);
  const fr = el("div", "row");
  fr.append(el("span", "", "All flows"));
  const fst = el("span", "status");
  const n = fs.errors.length;
  fst.append(dot(fs.ok), document.createTextNode(
    fs.ok ? "up" : n ? `${n} error${n === 1 ? "" : "s"}` : "no flows"));
  fr.append(fst, bar(status.history, "prefect.flows", now));
  const det = el("div", "rowdetail");
  det.append(el("div", "", `${fs.lastOk} of ${fs.total} last runs OK · ${fs.scheduled} of ${fs.total} scheduled`));
  for (const e of fs.errors) {
    const line = el("div", "flowerror");
    line.append(dot(false), document.createTextNode(`${e.name}: ${e.reason}`));
    det.append(line);
  }
  fr.append(det);
  pre.append(fr);

  try {
    specs.append(specsTable(status.specs));
  } catch (e) {
    specs.replaceChildren(specsTable(undefined));
  }
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
