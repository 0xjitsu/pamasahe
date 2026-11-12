import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import data from './data/fares.json';
import { DICT, type Lang } from './i18n';
import { computeFare, haversineKm, type Mode, type NewsVerifiedMode } from './lib/fare';
import { classifyDistance, formatDate, peso } from './lib/format';

// TODO: placeholder until the donation account is chosen. Set to '' to hide the link.
const DONATE_URL = 'https://github.com/sponsors/0xjitsu';

const modes = data.modes as Mode[];
const RATE = data.discount.rate;
let lang: Lang = (localStorage.getItem('lang') as Lang) || (navigator.language.startsWith('fil') || navigator.language.startsWith('tl') ? 'tl' : 'en');
let km: number | null = null;
let points: [number, number][] = [];
let straightKm: number | null = null;
let roadKm: number | null = null;
let roadIsEstimate = false;
let mapFailed = false;

const t = (k: string) => DICT[lang][k] ?? k;
const approx = (n: number) => '≈ ' + peso(n);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const app = document.getElementById('app')!;
app.innerHTML = `
<header><button id="lang" type="button"></button><h1 id="h1"></h1><p id="sub"></p></header>
<main>
  <section class="panel">
    <label for="km" id="kmLabel"></label>
    <input id="km" type="number" inputmode="decimal" min="0" step="0.1" />
    <p id="rounding" class="note"></p>
    <p id="estimate" class="muted"></p>
  </section>
  <section id="results"></section>
  <p id="live" class="sr-only" aria-live="polite"></p>
  <details id="mapBox" class="panel">
    <summary id="mapTitle"></summary>
    <p id="mapHelp" class="muted"></p>
    <div id="map"></div>
    <p id="mapMsg" class="warn" role="status"></p>
    <div id="mapOut" class="muted"></div>
  </details>
  <section class="panel small"><p id="who"></p><p id="disclaimer"></p><p id="checked"></p></section>
</main>
<footer><p id="foot"></p><p id="attr" class="muted"></p><p id="donate"></p></footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const kmInput = $<HTMLInputElement>('km');

function regularHow(m: NewsVerifiedMode, extraKm: number, d: number) {
  return m.baseKm > 0
    ? `${peso(m.regular.base)} + ${extraKm.toFixed(2)} × ${peso(m.regular.perKm)}`
    : `${d.toFixed(2)} km × ${peso(m.regular.perKm)}`;
}

function discountedHow(m: NewsVerifiedMode, extraKm: number, regular: number) {
  if (!m.discounted) return `${peso(regular)} × (1 − ${Math.round(RATE * 100)}%)`;
  return m.baseKm > 0
    ? `${peso(m.discounted.base)} + ${extraKm.toFixed(2)} × ${peso(m.discounted.perKm)}`
    : `${peso(m.discounted.perKm)} × ${extraKm.toFixed(2)}`;
}

function renderResults() {
  const el = $('results');
  const state = classifyDistance(km);
  if (state.kind !== 'ok') {
    el.innerHTML = `<div class="panel"><p class="${state.kind === 'tooFar' ? 'warn' : 'muted'}">${esc(t(state.kind === 'tooFar' ? 'tooFar' : 'enterDistance'))}</p></div>`;
    return;
  }
  const d = state.km;
  const rows: string[] = [];
  const details: string[] = [];
  for (const m of modes) {
    const name = esc(m.name[lang]);
    if (m.status !== 'verified-news') {
      rows.push(`<tr><th scope="row">${name}</th><td colspan="2" class="muted">${esc(t('unverified'))}</td></tr>`);
      continue;
    }
    const r = computeFare(m, d, RATE);
    rows.push(`<tr><th scope="row">${name}</th><td><b>${esc(approx(r.regular))}</b></td><td><b>${esc(approx(r.discounted))}</b></td></tr>`);
    const links = m.sources.map((s) => `<a class="tap" href="${esc(s.url)}" rel="noopener">${esc(s.name.split(',')[0])}</a>`).join(', ');
    details.push(`<div class="mode"><h3>${name}</h3>
      <p class="muted">${esc(t('regular'))}: ${esc(regularHow(m, r.extraKm, d))} = ${esc(peso(r.regular))}</p>
      <p class="muted">${esc(t('discounted'))}: ${esc(discountedHow(m, r.extraKm, r.regular))} = ${esc(peso(r.discounted))}</p>
      ${r.discountDerived ? `<p class="muted">${esc(t('discDerived'))}</p>` : ''}
      <p class="muted">${esc(t('effective'))}: ${esc(formatDate(m.effective))} · ${esc(t('source'))}: ${links}</p></div>`);
  }
  el.innerHTML = `<div class="panel">
    <p class="muted"><span class="badge">${esc(t('badge'))}</span></p>
    <table class="fares"><thead><tr><th></th><th scope="col">${esc(t('regular'))}</th><th scope="col">${esc(t('discounted'))}</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>
    <details class="how"><summary>${esc(t('details'))}</summary>${details.join('')}</details></div>`;
}

let liveTimer: number | undefined;
function scheduleLive() {
  window.clearTimeout(liveTimer);
  liveTimer = window.setTimeout(() => {
    const state = classifyDistance(km);
    const live = $('live');
    if (state.kind === 'empty') live.textContent = t('enterDistance');
    else if (state.kind === 'tooFar') live.textContent = t('tooFar');
    else live.textContent = `${t('liveSummary')} ${state.km} km.`;
  }, 600);
}

function setKm(v: number | null) {
  km = v;
  renderResults();
  scheduleLive();
}

function renderMapOut() {
  const el = $('mapOut');
  if (straightKm === null) { el.textContent = ''; return; }
  const parts = [`<button type="button" data-use="${straightKm}">${esc(t('straight'))}: ${straightKm.toFixed(2)} km — ${esc(t('useDistance'))}</button>`];
  if (roadKm !== null) {
    const label = roadIsEstimate ? t('roadEst') : t('road');
    parts.push(`<button type="button" data-use="${roadKm}">${esc(label)}: ${roadKm.toFixed(2)} km — ${esc(t('useDistance'))}</button>`);
  }
  el.innerHTML = parts.join('');
  el.querySelectorAll<HTMLButtonElement>('button[data-use]').forEach((b) => b.addEventListener('click', () => {
    const v = Math.round(Number(b.dataset.use) * 100) / 100;
    kmInput.value = String(v);
    setKm(v);
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function renderMapMsg() {
  $('mapMsg').textContent = mapFailed ? t('mapUnavailable') : '';
}

function renderStatic() {
  document.documentElement.lang = lang;
  document.title = t('title');
  $('h1').textContent = t('title');
  $('sub').textContent = t('subtitle');
  $('lang').textContent = t('lang');
  $('kmLabel').textContent = t('distance');
  $('rounding').textContent = t('rounding');
  $('estimate').textContent = t('estimate');
  $('mapTitle').textContent = t('pickMap');
  $('mapHelp').textContent = t('mapHelp');
  $('who').textContent = t('discountWho');
  $('disclaimer').textContent = t('disclaimer');
  $('checked').textContent = `${t('lastChecked')}: ${formatDate(data.lastChecked)}`;
  $('foot').innerHTML = `${esc(t('footerLicense'))} ${data.discount.laws.map((l) => `<a class="tap" href="${esc(l.url)}" rel="noopener">${esc(l.name.split(' (')[0])}</a>`).join(', ')}`;
  $('attr').innerHTML = esc(t('mapAttr')).replace('OpenStreetMap', '<a class="tap" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>').replace('OpenFreeMap', '<a class="tap" href="https://openfreemap.org">OpenFreeMap</a>');
  $('donate').innerHTML = DONATE_URL ? `<a class="tap" href="${esc(DONATE_URL)}" rel="noopener">♥ ${esc(t('donate'))}</a>` : '';
  renderResults();
  renderMapOut();
  renderMapMsg();
}

$('lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'tl' : 'en';
  localStorage.setItem('lang', lang);
  renderStatic();
  scheduleLive();
});
kmInput.addEventListener('input', () => {
  const v = parseFloat(kmInput.value);
  setKm(Number.isFinite(v) ? v : null);
});

// --- Map (OpenFreeMap vector tiles, no key; OSM data). Created lazily when "Pick on map" is first opened. ---
let map: maplibregl.Map | undefined;
const markers: maplibregl.Marker[] = [];
const lineId = 'route';
let clickToken = 0;

function setLine(coords: [number, number][]) {
  if (!map) return;
  const src = map.getSource(lineId) as maplibregl.GeoJSONSource | undefined;
  const geo = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } as GeoJSON.Feature;
  if (src) src.setData(geo);
  else map.addSource(lineId, { type: 'geojson', data: geo }).addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': '#0a4fd6', 'line-width': 4 } });
}

async function fetchRoad(a: [number, number], b: [number, number], token: number) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[0]},${a[1]};${b[0]},${b[1]}?overview=false`, { signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    if (!j.routes?.[0]) throw new Error('no route');
    if (token !== clickToken) return;
    roadKm = j.routes[0].distance / 1000;
    roadIsEstimate = false;
  } catch {
    if (token !== clickToken) return;
    roadKm = haversineKm(a, b) * 1.3;
    roadIsEstimate = true;
  }
  renderMapOut();
}

function initMap() {
  if (map) { map.resize(); return; }
  maplibregl.setWorkerUrl(workerUrl);
  const m = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/liberty',
    center: [121.0, 14.6],
    zoom: 10,
    attributionControl: { compact: true },
  });
  map = m;
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  const fail = () => { mapFailed = true; renderMapMsg(); };
  m.on('error', fail);
  let loaded = false;
  m.on('load', () => { loaded = true; });
  window.setTimeout(() => { if (!loaded) fail(); }, 15000);

  m.on('click', (e) => {
    clickToken++;
    if (points.length >= 2) {
      points = [];
      markers.splice(0).forEach((mk) => mk.remove());
      straightKm = roadKm = null;
      if (m.getSource(lineId)) setLine([]);
      renderMapOut();
      return;
    }
    const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    points.push(p);
    markers.push(new maplibregl.Marker({ color: points.length === 1 ? '#16a34a' : '#dc2626' }).setLngLat(p).addTo(m));
    if (points.length === 2) {
      straightKm = haversineKm(points[0], points[1]);
      roadKm = null;
      setLine(points);
      renderMapOut();
      void fetchRoad(points[0], points[1], clickToken);
    }
  });
}

const mapBox = $<HTMLDetailsElement>('mapBox');
mapBox.addEventListener('toggle', () => { if (mapBox.open) initMap(); });

renderStatic();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
