// Kalorien & Gewicht – installierbare Web-App (PWA).
// Daten liegen nur in localStorage dieses Geräts; die Foto-Analyse ruft die
// Anthropic-API direkt aus dem Browser mit dem eigenen API-Schlüssel auf.

const DATA_KEY = "kalorien-gewicht-v1";
const API_KEY_KEY = "kalorien-api-key";
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
const MAX_SIDE = 1280;

// ---------- helpers ----------
const $ = id => document.getElementById(id);
const fmt = (n, d = 0) => Number(n).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const keyOf = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const todayKey = () => keyOf(new Date());
const weekStart = k => { const d = parseKey(k); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return keyOf(d); };
const isoWeek = k => {
  const d = parseKey(k), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 3 - (t.getUTCDay() + 6) % 7);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - y) / 864e5 - 3 + (y.getUTCDay() + 6) % 7) / 7);
};
const short = k => parseKey(k).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const DEFAULT_SETTINGS = () => ({ goal: 2000, profile: { sex: "m", act: 1.375, rate: 550 } });
const state = { days: {}, settings: DEFAULT_SETTINGS(), date: todayKey() };

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
const day = k => state.days[k] || { meals: [], weight: null };

// ---------- storage (localStorage only) ----------
function loadData() {
  try {
    const s = JSON.parse(localStorage.getItem(DATA_KEY) || "null");
    if (s) { state.days = s.days || {}; state.settings = { ...state.settings, ...s.settings }; }
  } catch {}
}
let saveWarned = false;
function persist() {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify({ days: state.days, settings: state.settings }));
  } catch {
    if (!saveWarned) { saveWarned = true; toast("Speichern fehlgeschlagen – ist der Speicher voll oder privates Surfen aktiv?"); }
  }
}
const store = { saveDay: persist, saveSettings: persist };

function getApiKey() { try { return localStorage.getItem(API_KEY_KEY) || ""; } catch { return ""; } }
function setApiKey(k) {
  try { if (k) localStorage.setItem(API_KEY_KEY, k); else localStorage.removeItem(API_KEY_KEY); return true; }
  catch { return false; }
}
const maskKey = k => k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : "…" + k.slice(-4);

// ---------- mutations ----------
function setDay(k, patch) { state.days[k] = { ...day(k), ...patch }; store.saveDay(k); render(); }
function addMeals(list) {
  const k = state.date, d = day(k);
  setDay(k, { meals: [...d.meals, ...list.map(m => ({ id: uid(), t: Date.now(), ...m }))] });
}

// ---------- render: kcal ----------
function renderToday() {
  const k = state.date, d = day(k), goal = Number(state.settings.goal) || 2000;
  const total = d.meals.reduce((s, m) => s + (Number(m.kcal) || 0), 0);
  const prot = d.meals.reduce((s, m) => s + (Number(m.protein) || 0), 0);
  const t = todayKey();
  $("dayLabel").textContent = k === t ? "Heute" : k === addDays(t, -1) ? "Gestern" : parseKey(k).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  $("nextDay").disabled = k >= t;
  $("ringNum").textContent = fmt(total);
  const C = 301.6, frac = Math.min(total / goal, 1);
  $("ringVal").setAttribute("stroke-dashoffset", String(C * (1 - frac)));
  $("ring").classList.toggle("over", total > goal);
  const left = goal - total;
  $("statLeft").textContent = left >= 0 ? fmt(left) : "+" + fmt(-left);
  $("statLeft").className = "num " + (left >= 0 ? "" : "up");
  $("statCount").textContent = d.meals.length;
  $("statProt").textContent = fmt(prot) + " g";
  if (document.activeElement !== $("goalInput")) $("goalInput").value = goal;
  $("mealsTitle").textContent = k === t ? "Heute gegessen" : "Gegessen am " + short(k);
  $("mealList").innerHTML = d.meals.length ? d.meals.map(m => `
    <li><div style="min-width:0"><div>${esc(m.name)}${m.src === "foto" ? '<span class="chip">Foto</span>' : ""}</div>
    <div class="meta">${new Date(m.t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}${m.portion ? " · " + esc(m.portion) : ""}${m.protein != null ? ` · E ${fmt(Number(m.protein) || 0)} g · K ${fmt(Number(m.carbs) || 0)} g · F ${fmt(Number(m.fat) || 0)} g` : ""}</div></div>
    <span class="num">${fmt(m.kcal)} kcal</span><button class="ghost" data-del="${esc(m.id)}" aria-label="${esc(m.name)} löschen">✕</button></li>`).join("")
    : `<li class="empty">Noch nichts eingetragen. Mach ein Foto von deinem Essen oder trag es oben manuell ein.</li>`;
}

// ---------- render: weight ----------
function weeks() {
  const map = {};
  for (const [k, d] of Object.entries(state.days)) {
    const ws = weekStart(k), w = (map[ws] ||= { start: ws, weights: [], kcalDays: [] });
    if (d.weight != null) w.weights.push(Number(d.weight));
    const kc = (d.meals || []).reduce((s, m) => s + (Number(m.kcal) || 0), 0);
    if (kc > 0) w.kcalDays.push(kc);
  }
  return Object.values(map).sort((a, b) => a.start.localeCompare(b.start)).map(w => ({
    ...w, avg: w.weights.length ? w.weights.reduce((a, b) => a + b, 0) / w.weights.length : null,
    kcal: w.kcalDays.length ? w.kcalDays.reduce((a, b) => a + b, 0) / w.kcalDays.length : null,
  }));
}
const delta = (v, cls = true) => v == null ? "–" : `<span class="${cls ? (v < 0 ? "down" : v > 0 ? "up" : "") : ""}">${v > 0 ? "+" : v < 0 ? "−" : "±"}${fmt(Math.abs(v), 1)} kg</span>`;

function renderWeight() {
  const ws = weeks(), withW = ws.filter(w => w.avg != null);
  const curStart = weekStart(todayKey());
  const cur = ws.find(w => w.start === curStart && w.avg != null);
  const prev = [...withW].reverse().find(w => w.start < curStart);
  $("tThis").textContent = cur ? fmt(cur.avg, 1) + " kg" : "–";
  $("tThisN").textContent = cur ? `${cur.weights.length} Messung${cur.weights.length > 1 ? "en" : ""}` : "noch keine Messung";
  $("tDiff").innerHTML = cur && prev ? delta(cur.avg - prev.avg) : "–";
  $("tPrev").textContent = prev ? `Vorwoche ${fmt(prev.avg, 1)} kg` : "keine Vorwoche";
  const first = withW[0], last = withW[withW.length - 1];
  $("tTotal").innerHTML = first && last && first !== last ? delta(last.avg - first.avg) : "–";
  $("tStart").textContent = first ? `Start KW ${isoWeek(first.start)}: ${fmt(first.avg, 1)} kg` : "";

  // table
  const rows = [...ws].reverse();
  $("weekTable").innerHTML = rows.length ? rows.map(w => {
    const i = withW.indexOf(w), p = i > 0 ? withW[i - 1] : null;
    return `<tr class="${w.start === curStart ? "current" : ""}"><td class="num">${isoWeek(w.start)}</td><td>${short(w.start)}–${short(addDays(w.start, 6))}</td>
      <td class="r num">${w.avg != null ? fmt(w.avg, 1) + " kg" : "–"}</td><td class="r num">${w.avg != null && p ? delta(w.avg - p.avg) : "–"}</td>
      <td class="r num">${w.kcal != null ? fmt(w.kcal) : "–"}</td></tr>`;
  }).join("") : `<tr><td colspan="5" class="empty">Sobald du dein Gewicht einträgst, erscheint hier jede Woche mit ihrem Durchschnitt.</td></tr>`;

  // list
  const entries = Object.entries(state.days).filter(([, d]) => d.weight != null).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  $("weightList").innerHTML = entries.length ? entries.map(([k, d]) => `<li><span>${parseKey(k).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span><span class="num">${fmt(d.weight, 1)} kg</span><button class="ghost" data-delw="${esc(k)}" aria-label="Messung vom ${short(k)} löschen">✕</button></li>`).join("")
    : `<li class="empty">Noch keine Messung. Am besten jeden Morgen nüchtern wiegen.</li>`;

  renderChart(withW);
}

function renderChart(withW) {
  const el = $("chart");
  const from = addDays(weekStart(todayKey()), -7 * 9);
  const pts = Object.entries(state.days).filter(([k, d]) => d.weight != null && k >= from).map(([k, d]) => ({ k, v: Number(d.weight) }));
  if (pts.length < 2) { el.innerHTML = `<p class="empty">Ab zwei Messungen siehst du hier deinen Verlauf der letzten 10 Wochen.</p>`; return; }
  const avgs = withW.filter(w => w.start >= from).map(w => ({ k: addDays(w.start, 3), v: w.avg }));
  const W = 600, H = 220, L = 46, R = 12, T = 12, B = 28;
  const all = [...pts, ...avgs].map(p => p.v);
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = Math.max(0.5, (hi - lo) * 0.15); lo = Math.floor((lo - pad) * 2) / 2; hi = Math.ceil((hi + pad) * 2) / 2;
  const t0 = parseKey(pts.reduce((a, p) => p.k < a ? p.k : a, pts[0].k)).getTime();
  const t1 = Math.max(parseKey(todayKey()).getTime(), t0 + 864e5 * 6);
  // Clamp to the visible range: a week's Ø sits on its Thursday, which may lie before
  // the first measurement or after today (current week Mon–Wed).
  const x = k => L + (Math.min(Math.max(parseKey(k).getTime(), t0), t1) - t0) / (t1 - t0) * (W - L - R);
  const y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + (hi - lo) * i / 4);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf">
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v, 1)}</text>`).join("")}
    <text class="axis" x="${L}" y="${H - 8}">${short(keyOf(new Date(t0)))}</text>
    <text class="axis" x="${W - R}" y="${H - 8}" text-anchor="end">${short(keyOf(new Date(t1)))}</text>
    ${pts.map(p => `<circle class="dot" cx="${x(p.k)}" cy="${y(p.v)}" r="3.5"/>`).join("")}
    ${avgs.length > 1 ? `<polyline class="avg" points="${avgs.map(p => x(p.k) + "," + y(p.v)).join(" ")}"/>` : ""}
    ${avgs.map(p => `<circle class="avgdot" cx="${x(p.k)}" cy="${y(p.v)}" r="4.5"/>`).join("")}
  </svg>`;
}

// ---------- render: daily need (Mifflin-St Jeor) ----------
function latestWeight() {
  const e = Object.entries(state.days).filter(([, d]) => d.weight != null).sort((a, b) => b[0].localeCompare(a[0]))[0];
  return e ? { k: e[0], v: Number(e[1].weight) } : null;
}
function renderProfile() {
  const p = state.settings.profile || {}, lw = latestWeight();
  $("setupIntro").hidden = !!(p.height && p.age);
  if (!$("profileForm").contains(document.activeElement)) {
    $("pHeight").value = p.height ?? ""; $("pAge").value = p.age ?? "";
    $("pSex").value = p.sex || "m"; $("pAct").value = String(p.act ?? 1.375); $("pRate").value = String(p.rate ?? 550);
    $("pWeight").value = lw ? lw.v : "";
  }
  const h = Number(p.height), a = Number(p.age), w = lw?.v;
  const out = $("tdeeOut");
  if (!(h >= 120 && a >= 14 && w >= 30)) {
    out.innerHTML = `<p class="empty">Trag Größe, Gewicht und Alter ein. Dann rechne ich dir aus, wie viel du am Tag verbrauchst und wie viel du essen solltest, um abzunehmen.</p>`;
    return;
  }
  const bmr = 10 * w + 6.25 * h - 5 * a + (p.sex === "w" ? -161 : 5);
  const tdee = bmr * Number(p.act || 1.375), rate = Number(p.rate ?? 550);
  const target = Math.round((tdee - rate) / 10) * 10;
  const floor = Math.max(bmr, p.sex === "w" ? 1200 : 1500);
  out.innerHTML = `
    <div class="tiles">
      <div class="tile"><span class="label">Grundumsatz</span><span class="num">${fmt(bmr)}</span><span class="sub">kcal in Ruhe</span></div>
      <div class="tile"><span class="label">Tagesverbrauch</span><span class="num">${fmt(tdee)}</span><span class="sub">kcal mit Aktivität</span></div>
      <div class="tile"><span class="label">Defizit</span><span class="num">−${fmt(rate)}</span><span class="sub">${rate ? `≈ ${fmt(rate * 7 / 7700, 2)} kg/Woche` : "Gewicht halten"}</span></div>
    </div>
    <div class="target"><div><span class="label">Deine Zielkalorien pro Tag</span><div class="num">${fmt(target)} kcal</div></div>
      <button class="primary" id="applyGoal" ${Number(state.settings.goal) === target ? "disabled" : ""}>${Number(state.settings.goal) === target ? "Ist dein Tagesziel" : "Als Tagesziel übernehmen"}</button></div>
    ${target < floor ? `<p class="warn">Das liegt unter ${target < bmr ? "deinem Grundumsatz" : fmt(floor) + " kcal"}. So wenig zu essen ist auf Dauer nicht gesund. Wähle lieber ein langsameres Tempo.</p>` : ""}
    <p class="sub">Berechnet mit ${lw ? `deinem Gewicht vom ${short(lw.k)}` : "deinem Gewicht"} nach der Mifflin-St-Jeor-Formel. 1 kg Körperfett entspricht etwa 7.700 kcal. Die Werte sind Schätzungen. Wenn sich dein Wochen-Ø nach 2–3 Wochen anders bewegt als geplant, passe das Tempo an.</p>`;
  $("applyGoal").onclick = () => { state.settings.goal = target; store.saveSettings(); render(); toast(`Tagesziel auf ${fmt(target)} kcal gesetzt`); };
}

function render() { renderToday(); renderWeight(); renderProfile(); }

// ---------- tabs ----------
function showTab(t) {
  $("panelToday").hidden = t !== "today"; $("panelWeight").hidden = t !== "weight";
  $("tabToday").setAttribute("aria-selected", t === "today"); $("tabWeight").setAttribute("aria-selected", t === "weight");
  try { localStorage.setItem("kg-tab", t); } catch {}
}
$("tabToday").onclick = () => showTab("today");
$("tabWeight").onclick = () => showTab("weight");
try { if (localStorage.getItem("kg-tab") === "weight") showTab("weight"); } catch {}

// ---------- settings sheet ----------
function openSettings(focusId) {
  $("settingsSheet").hidden = false; renderProfile(); renderKey();
  const el = $(focusId || "closeSettings");
  el.focus();
  if (focusId) el.scrollIntoView({ block: "center", behavior: "smooth" });
}
function closeSettings() {
  $("settingsSheet").hidden = true; hideImportConfirm(); setDataStatus("");
  $("openSettings").focus();
}
$("openSettings").onclick = () => openSettings();
$("closeSettings").onclick = closeSettings;
$("settingsSheet").onclick = e => { if (e.target === $("settingsSheet")) closeSettings(); };
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("settingsSheet").hidden) closeSettings(); });
let setupChecked = false;
function maybeSetup() {
  if (setupChecked) return; setupChecked = true;
  const p = state.settings.profile || {};
  if (!(p.height && p.age)) openSettings();
}

// ---------- settings: API key ----------
function renderKey() {
  const k = getApiKey();
  $("keyStatus").textContent = k ? `Gespeichert: ${maskKey(k)}` : "Noch kein Schlüssel gespeichert.";
  $("removeKeyBtn").disabled = !k;
  if (k) $("keyNeeded").hidden = true;
}
$("keyForm").onsubmit = e => {
  e.preventDefault();
  const k = $("apiKeyInput").value.replace(/\s+/g, "");
  if (!k) { toast("Bitte zuerst einen Schlüssel einfügen."); $("apiKeyInput").focus(); return; }
  if (!setApiKey(k)) { toast("Schlüssel konnte nicht gespeichert werden."); return; }
  $("apiKeyInput").value = "";
  renderKey();
  toast(k.startsWith("sk-ant-") ? "API-Schlüssel gespeichert" : "Gespeichert – der Schlüssel beginnt aber nicht mit „sk-ant-“. Bitte prüfen.");
};
$("removeKeyBtn").onclick = () => { setApiKey(""); renderKey(); toast("API-Schlüssel entfernt"); };
$("keyNeededBtn").onclick = () => openSettings("apiKeyInput");

// ---------- settings: export / import ----------
let pendingImport = null; // validated backup waiting for confirmation
function setDataStatus(msg, err) { const s = $("dataStatus"); s.hidden = !msg; s.textContent = msg || ""; s.classList.toggle("err", !!err); }
function hideImportConfirm() { pendingImport = null; $("importConfirm").hidden = true; $("importInput").value = ""; }

$("exportBtn").onclick = async () => {
  const name = `kalorien-backup-${todayKey()}.json`;
  let json;
  try { json = JSON.stringify({ days: state.days, settings: state.settings }, null, 2); }
  catch { setDataStatus("Export fehlgeschlagen.", true); return; }
  // iPhone: share sheet ("In Dateien sichern"). Only on touch devices – on a PC a normal download is better.
  try {
    const file = new File([json], name, { type: "application/json" });
    if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Kalorien-Sicherung" });
      setDataStatus("Export erstellt. Tipp: Im Teilen-Menü „In Dateien sichern“ wählen.");
      return;
    }
  } catch (e) {
    if (e?.name === "AbortError") return; // user closed the share sheet
    // any other share error: fall back to the download below
  }
  try {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setDataStatus("Export erstellt. Die Datei liegt in deinen Downloads bzw. in der Dateien-App.");
  } catch {
    setDataStatus("Export fehlgeschlagen.", true);
  }
};

// Validate and normalise an imported backup. Returns { days, settings } or null.
function normaliseBackup(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const { days, settings } = obj;
  if (!days || typeof days !== "object" || Array.isArray(days)) return null;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const outDays = {};
  for (const [k, d] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !d || typeof d !== "object") continue;
    const meals = (Array.isArray(d.meals) ? d.meals : [])
      .filter(m => m && typeof m === "object" && typeof m.name === "string")
      .map(m => ({ ...m, id: String(m.id || uid()), kcal: Math.max(0, Math.round(Number(m.kcal) || 0)), t: Number(m.t) || parseKey(k).getTime() }));
    const w = d.weight == null || d.weight === "" ? null : Number(d.weight);
    outDays[k] = { meals, weight: Number.isFinite(w) && w >= 30 && w <= 300 ? w : null };
  }
  const def = DEFAULT_SETTINGS();
  const goal = Number(settings.goal);
  const profile = settings.profile && typeof settings.profile === "object" && !Array.isArray(settings.profile) ? settings.profile : {};
  return {
    days: outDays,
    settings: { ...def, ...settings, goal: goal >= 800 && goal <= 6000 ? goal : def.goal, profile: { ...def.profile, ...profile } },
  };
}

$("importInput").onchange = async e => {
  const f = e.target.files?.[0]; if (!f) return;
  setDataStatus("");
  let data = null;
  try { data = normaliseBackup(JSON.parse(await f.text())); } catch {}
  if (!data) { hideImportConfirm(); setDataStatus("Diese Datei ist keine gültige Sicherung dieser App.", true); return; }
  pendingImport = data;
  const all = Object.values(data.days);
  const nDays = all.filter(d => d.meals.length || d.weight != null).length;
  const nWeights = all.filter(d => d.weight != null).length;
  $("importInfo").textContent = `„${f.name}“ enthält ${fmt(nDays)} Tag${nDays === 1 ? "" : "e"} mit Einträgen (${fmt(nWeights)} Gewichtsmessung${nWeights === 1 ? "" : "en"}). Beim Import werden alle Daten auf diesem Gerät ersetzt.`;
  $("importConfirm").hidden = false;
  $("importYes").focus();
};
$("importYes").onclick = () => {
  if (!pendingImport) return;
  state.days = pendingImport.days; state.settings = pendingImport.settings;
  hideImportConfirm();
  store.saveSettings(); render();
  setDataStatus("Import abgeschlossen. Deine Daten wurden ersetzt.");
  toast("Daten importiert");
};
$("importNo").onclick = () => { hideImportConfirm(); setDataStatus("Import abgebrochen."); };

// ---------- events ----------
$("prevDay").onclick = () => { state.date = addDays(state.date, -1); resetPhoto(); render(); };
$("nextDay").onclick = () => { if (state.date < todayKey()) { state.date = addDays(state.date, 1); resetPhoto(); render(); } };
$("goalInput").onchange = e => { const v = Math.round(Number(e.target.value)); if (v >= 800 && v <= 6000) { state.settings.goal = v; store.saveSettings(); render(); } };
$("manualForm").onsubmit = e => {
  e.preventDefault();
  const name = $("mName").value.trim(), kcal = Math.round(Number($("mKcal").value));
  if (!name || !(kcal >= 0)) return;
  addMeals([{ name, kcal, src: "manuell" }]);
  $("mName").value = ""; $("mKcal").value = ""; $("mName").focus();
  toast(`${name} hinzugefügt`);
};
$("mealList").onclick = e => {
  const id = e.target.closest("[data-del]")?.dataset.del; if (!id) return;
  setDay(state.date, { meals: day(state.date).meals.filter(m => m.id !== id) });
};
$("wDate").value = todayKey(); $("wDate").max = todayKey();
$("weightForm").onsubmit = e => {
  e.preventDefault();
  const k = $("wDate").value, v = Math.round(Number(String($("wVal").value).replace(",", ".")) * 10) / 10;
  if (!k || !(v >= 30 && v <= 300)) { toast("Bitte ein Gewicht zwischen 30 und 300 kg eingeben."); return; }
  setDay(k, { weight: v }); $("wVal").value = ""; toast(`${fmt(v, 1)} kg am ${short(k)} gespeichert`);
};
$("profileForm").onsubmit = e => e.preventDefault();
$("profileForm").onchange = e => {
  const p = { ...state.settings.profile };
  const n = id => { const v = Number(String($(id).value).replace(",", ".")); return Number.isFinite(v) && $(id).value !== "" ? v : null; };
  if (e.target.id === "pWeight") {
    const v = n("pWeight");
    if (v >= 30 && v <= 300) { setDay(todayKey(), { weight: Math.round(v * 10) / 10 }); toast(`${fmt(v, 1)} kg für heute gespeichert`); }
    return;
  }
  p.height = n("pHeight"); p.age = n("pAge"); p.sex = $("pSex").value; p.act = Number($("pAct").value); p.rate = Number($("pRate").value);
  state.settings.profile = p; store.saveSettings(); render();
};
$("weightList").onclick = e => { const k = e.target.closest("[data-delw]")?.dataset.delw; if (k) setDay(k, { weight: null }); };

// ---------- photo analysis ----------
let photo = null, ctl = null, result = null, previewUrl = null;
let sdkPromise = null; // cached dynamic import of the Anthropic SDK

function setStatus(msg, err) { const s = $("photoStatus"); s.hidden = !msg; s.textContent = msg || ""; s.classList.toggle("err", !!err); }
function resetPhoto() {
  ctl?.abort(); photo = null; result = null;
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  $("photoPreview").removeAttribute("src");
  $("photoBox").hidden = true; $("resultBox").hidden = true; $("keyNeeded").hidden = true;
  $("photoHint").value = ""; setStatus("");
  $("camInput").value = ""; $("fileInput").value = "";
}
function pick(e) {
  const f = e.target.files?.[0]; if (!f) return;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  photo = f; previewUrl = URL.createObjectURL(f); $("photoPreview").src = previewUrl;
  $("photoBox").hidden = false; $("resultBox").hidden = true; $("keyNeeded").hidden = true; setStatus("");
}
$("camInput").onchange = pick; $("fileInput").onchange = pick;
$("discardBtn").onclick = resetPhoto;
$("stopBtn").onclick = () => ctl?.abort();

function loadSdk() {
  sdkPromise ||= import(SDK_URL).then(m => m.default).catch(e => { sdkPromise = null; throw e; });
  return sdkPromise;
}

// Downscale to max. 1280 px (longest side) and re-encode as JPEG.
// Also converts HEIC photos from the iPhone into something the API accepts.
async function imageToJpegBase64(file) {
  let src, w, h, cleanup = () => {};
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
    w = src.width; h = src.height; cleanup = () => src.close?.();
  } catch {
    const url = URL.createObjectURL(file);
    src = new Image(); src.src = url;
    try { await src.decode(); } catch (e) { URL.revokeObjectURL(url); throw Object.assign(new Error("decode"), { code: "decode" }); }
    w = src.naturalWidth; h = src.naturalHeight; cleanup = () => URL.revokeObjectURL(url);
  }
  const canvas = document.createElement("canvas");
  try {
    if (!w || !h) throw Object.assign(new Error("decode"), { code: "decode" });
    const s = Math.min(1, MAX_SIDE / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * s)); canvas.height = Math.max(1, Math.round(h * s));
    const g = canvas.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height); // transparent PNGs → white
    g.drawImage(src, 0, 0, canvas.width, canvas.height);
  } finally { cleanup(); }
  const blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.85));
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

// Tolerant JSON parsing: whole text, then a ``` code block, then first "{" … last "}".
function parseJsonLoose(text) {
  const tries = [text];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) tries.push(fence[1]);
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) tries.push(text.slice(a, b + 1));
  for (const t of tries) { try { return JSON.parse(t.trim()); } catch {} }
  return null;
}

function buildPrompt(hint) {
  return `Du bist Ernährungsberater. Auf dem Foto ist eine Mahlzeit. Erkenne jedes Lebensmittel bzw. jede Komponente, schätze die Portion anhand von Teller, Besteck und Verpackung und berechne Kalorien und Makronährstoffe.
${hint ? `Hinweis der Person zum Essen: "${hint.slice(0, 300)}"\n` : ""}Antworte NUR mit JSON in genau dieser Form, alle Texte auf Deutsch:
{"dish":"Kurzer Name des Gerichts","items":[{"name":"Lebensmittel","portion":"ca. 150 g","kcal":250,"protein":10,"carbs":30,"fat":8}],"note":"Ein Satz zur Unsicherheit der Schätzung"}
kcal als ganze Zahl, Makros in Gramm. Ist kein Essen zu sehen, gib {"dish":"","items":[],"note":"Kein Essen erkannt"} zurück.`;
}

const MSG = {
  refused: "Auf dem Bild wurde kein Essen erkannt. Versuch ein anderes Foto.",
  invalidJson: "Die Antwort war unvollständig. Tippe nochmal auf „Kalorien berechnen“.",
  offline: "Foto-Erkennung braucht Internet.",
  decode: "Dieses Bild kann nicht gelesen werden. Nimm ein JPG- oder PNG-Foto.",
  auth: "API-Schlüssel ungültig – prüfe ihn im Zahnrad.",
  permission: "Dein API-Schlüssel hat keine Berechtigung für diese Anfrage. Prüfe ihn auf console.anthropic.com.",
  rateLimit: "Zu viele Anfragen oder Guthaben-Limit erreicht. Warte kurz oder prüfe dein Limit auf console.anthropic.com.",
  connection: "Keine Verbindung – bist du online?",
  aborted: "Abgebrochen.",
  overloaded: "Der Dienst ist gerade überlastet. Versuch es in ein paar Minuten nochmal.",
  generic: "Die Analyse ist fehlgeschlagen. Versuch es nochmal.",
};

function apiErrorText(e) {
  return e?.error?.error?.message || e?.message || "";
}
function errorMessage(Anthropic, e, signal) {
  if (signal?.aborted || e?.name === "AbortError" || (Anthropic && e instanceof Anthropic.APIUserAbortError)) return MSG.aborted;
  if (e?.code === "decode") return MSG.decode;
  if (!Anthropic) return MSG.generic;
  if (e instanceof Anthropic.AuthenticationError) return MSG.auth;
  if (e instanceof Anthropic.PermissionDeniedError) return MSG.permission;
  if (e instanceof Anthropic.RateLimitError) return MSG.rateLimit;
  if (e instanceof Anthropic.BadRequestError) {
    const text = apiErrorText(e);
    if (/credit balance/i.test(text)) return `Dein Anthropic-Guthaben reicht nicht – lade es auf console.anthropic.com auf. (${text})`;
    return `Die Anfrage wurde abgelehnt: ${text}`;
  }
  if (e instanceof Anthropic.APIConnectionError) return MSG.connection;
  if (e instanceof Anthropic.APIError && Number(e.status) >= 500) return MSG.overloaded;
  return MSG.generic;
}

$("analyzeBtn").onclick = async () => {
  if (!photo) return;
  const apiKey = getApiKey();
  if (!apiKey) { setStatus(""); $("keyNeeded").hidden = false; return; }
  $("keyNeeded").hidden = true;

  ctl = new AbortController();
  const myCtl = ctl, myPhoto = photo;
  const stale = () => photo !== myPhoto; // photo discarded or replaced meanwhile
  $("analyzeBtn").disabled = true; $("stopBtn").hidden = false; $("resultBox").hidden = true;
  setStatus("Bild wird vorbereitet …");
  const hint = $("photoHint").value.trim();
  let Anthropic = null;
  try {
    try { Anthropic = await loadSdk(); }
    catch { setStatus(MSG.offline, true); return; }
    const base64 = await imageToJpegBase64(photo);
    const mediaType = "image/jpeg";
    if (myCtl.signal.aborted) { if (!stale()) setStatus(MSG.aborted); return; }

    setStatus("Claude schaut sich dein Essen an … das dauert meist 10–30 Sekunden.");
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
    const msg = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000, // thinking is always on for this model and counts toward max_tokens

      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: buildPrompt(hint) } ] }],
    }, { signal: myCtl.signal });

    if (stale()) return;
    if (msg.stop_reason === "refusal") { setStatus(MSG.refused, true); return; }
    const text = (msg.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const r = parseJsonLoose(text);
    if (!r || typeof r !== "object") { setStatus(MSG.invalidJson, true); return; }

    const items = (Array.isArray(r.items) ? r.items : []).map(i => ({
      name: String(i?.name || "Unbekannt").slice(0, 80), portion: String(i?.portion || "").slice(0, 40),
      kcal: Math.max(0, Math.round(Number(i?.kcal) || 0)), protein: Math.round(Number(i?.protein) || 0),
      carbs: Math.round(Number(i?.carbs) || 0), fat: Math.round(Number(i?.fat) || 0), on: true,
    }));
    if (!items.length) { setStatus(r.note || "Kein Essen erkannt. Versuch ein anderes Foto.", true); return; }
    result = { dish: String(r.dish || "Mahlzeit"), note: String(r.note || ""), items };
    setStatus(""); renderResult();
  } catch (e) {
    if (stale()) return;
    const m = errorMessage(Anthropic, e, myCtl.signal);
    setStatus(m, m !== MSG.aborted);
  } finally {
    $("analyzeBtn").disabled = false; $("stopBtn").hidden = true;
    if (ctl === myCtl) ctl = null;
  }
};

function renderResult() {
  $("resultBox").hidden = false;
  $("dishName").textContent = result.dish;
  $("dishNote").textContent = result.note;
  $("resultItems").innerHTML = result.items.map((it, i) => `
    <div class="item"><input type="checkbox" id="ri${i}" data-i="${i}" ${it.on ? "checked" : ""} style="width:auto">
    <label class="name" for="ri${i}">${esc(it.name)}<small>${esc(it.portion)} · E ${it.protein} g · K ${it.carbs} g · F ${it.fat} g</small></label>
    <input type="number" id="rk${i}" data-k="${i}" value="${it.kcal}" min="0" inputmode="numeric" aria-label="kcal für ${esc(it.name)}"></div>`).join("");
  updateTotal();
}
function updateTotal() {
  const sel = result.items.filter(i => i.on);
  $("dishTotal").textContent = fmt(sel.reduce((s, i) => s + i.kcal, 0)) + " kcal";
  $("addResultBtn").disabled = !sel.length;
}
$("resultItems").oninput = e => {
  if (!result) return;
  const t = e.target;
  if (t.dataset.i != null) result.items[t.dataset.i].on = t.checked;
  if (t.dataset.k != null) result.items[t.dataset.k].kcal = Math.max(0, Math.round(Number(t.value) || 0));
  updateTotal();
};
$("addResultBtn").onclick = () => {
  if (!result) return;
  const sel = result.items.filter(i => i.on); if (!sel.length) return;
  addMeals(sel.map(({ on, ...i }) => ({ ...i, src: "foto" })));
  toast(`${result.dish} hinzugefügt (${fmt(sel.reduce((s, i) => s + i.kcal, 0))} kcal)`);
  resetPhoto();
};

// ---------- boot ----------
loadData();
$("syncNote").textContent = "Auf diesem Gerät gespeichert";
render();
renderKey();
maybeSetup();
// A home-screen app stays in memory for days: when it comes back after midnight,
// move from the old "today" to the new one (otherwise entries land on yesterday).
let shownToday = todayKey();
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  const t = todayKey(); if (t === shownToday) return;
  if (state.date === shownToday) state.date = t;
  if ($("wDate").value === shownToday) $("wDate").value = t;
  $("wDate").max = t; shownToday = t;
  render();
});
try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch {}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
