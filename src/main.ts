import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import data from './data/fares.json';
import { DICT, type Lang } from './i18n';
import { computeFare, haversineKm, type Mode } from './lib/fare';

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

const t = (k: string) => DICT[lang][k] ?? k;
const peso = (n: number) => '₱' + n.toFixed(2);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const app = document.getElementById('app')!;
app.innerHTML = `
<header><button id="lang" type="button"></button><h1 id="h1"></h1><p id="sub"></p></header>
<main>
  <section class="panel">
    <label for="km" id="kmLabel"></label>
    <input id="km" type="number" inputmode="decimal" min="0" step="0.1" />
    <h2 id="mapTitle"></h2>
    <p id="mapHelp" class="muted"></p>
    <div id="map"></div>
    <div id="mapOut" class="muted"></div>
  </section>
  <section id="results" aria-live="polite"></section>
  <section class="panel small"><p id="who"></p><p id="disclaimer"></p><p id="checked"></p></section>
</main>
<footer><p id="foot"></p><p id="attr" class="muted"></p><p id="donate"></p></footer>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const kmInput = $<HTMLInputElement>('km');

function renderResults() {
  const el = $('results');
  if (km === null || !(km >= 0)) {
    el.innerHTML = `<p class="muted">${esc(t('enterDistance'))}</p>`;
    return;
  }
  el.innerHTML = modes.map((m) => {
    const name = esc(m.name[lang]);
    if (m.status !== 'verified') {
      return `<article class="card unv"><h3>${name}</h3><p>${esc(t('unverified'))}</p></article>`;
    }
    const r = computeFare(m, km!, RATE);
    const how = `${t('base')} ${peso(m.baseFare)} (${m.baseKm} km) + ${r.extraKm.toFixed(2)} km × ${peso(m.perKm)} = ${peso(m.baseFare + r.extraCost)}`;
    return `<article class="card"><h3>${name}</h3>
      <div class="fares"><div><span>${esc(t('regular'))}</span><b>${peso(r.regular)}</b></div>
      <div><span>${esc(t('discounted'))}</span><b>${peso(r.discounted)}</b></div></div>
      <p class="muted">${esc(t('how'))}: ${esc(how)}</p>
      <p class="muted">${esc(t('memo'))}: ${esc(m.source.memo)} · ${esc(t('effective'))}: ${esc(m.source.effectiveDate)} · <a href="${esc(m.source.url)}" rel="noopener">${esc(t('source'))}</a></p></article>`;
  }).join('');
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
    km = Math.round(Number(b.dataset.use) * 100) / 100;
    kmInput.value = String(km);
    renderResults();
  }));
}

function renderStatic() {
  document.documentElement.lang = lang;
  document.title = t('title');
  $('h1').textContent = t('title');
  $('sub').textContent = t('subtitle');
  $('lang').textContent = t('lang');
  $('kmLabel').textContent = t('distance');
  $('mapTitle').textContent = t('pickMap');
  $('mapHelp').textContent = t('mapHelp');
  $('who').textContent = t('discountWho');
  $('disclaimer').textContent = t('disclaimer');
  $('checked').textContent = `${t('lastChecked')}: ${data.lastChecked}`;
  $('foot').innerHTML = `${esc(t('footerLicense'))} ${data.discount.laws.map((l) => `<a href="${esc(l.url)}" rel="noopener">${esc(l.name.split(' (')[0])}</a>`).join(', ')}`;
  $('attr').innerHTML = esc(t('mapAttr')).replace('OpenStreetMap', '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>').replace('OpenFreeMap', '<a href="https://openfreemap.org">OpenFreeMap</a>');
  $('donate').innerHTML = DONATE_URL ? `<a href="${esc(DONATE_URL)}" rel="noopener">♥ ${esc(t('donate'))}</a>` : '';
  renderResults();
  renderMapOut();
}

$('lang').addEventListener('click', () => {
  lang = lang === 'en' ? 'tl' : 'en';
  localStorage.setItem('lang', lang);
  renderStatic();
});
kmInput.addEventListener('input', () => {
  const v = parseFloat(kmInput.value);
  km = Number.isFinite(v) && v >= 0 ? v : null;
  renderResults();
});

// --- Map (OpenFreeMap vector tiles, no key; OSM data) ---
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [121.0, 14.6],
  zoom: 10,
  attributionControl: { compact: true },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
const markers: maplibregl.Marker[] = [];
const lineId = 'route';

function setLine(coords: [number, number][]) {
  const src = map.getSource(lineId) as maplibregl.GeoJSONSource | undefined;
  const geo = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } as GeoJSON.Feature;
  if (src) src.setData(geo);
  else map.addSource(lineId, { type: 'geojson', data: geo }).addLayer({ id: lineId, type: 'line', source: lineId, paint: { 'line-color': '#0b5fff', 'line-width': 4 } });
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

let clickToken = 0;
map.on('click', (e) => {
  clickToken++;
  if (points.length >= 2) {
    points = [];
    markers.splice(0).forEach((m) => m.remove());
    straightKm = roadKm = null;
    if (map.getSource(lineId)) setLine([]);
    renderMapOut();
    return;
  }
  const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
  points.push(p);
  markers.push(new maplibregl.Marker({ color: points.length === 1 ? '#16a34a' : '#dc2626' }).setLngLat(p).addTo(map));
  if (points.length === 2) {
    straightKm = haversineKm(points[0], points[1]);
    roadKm = null;
    setLine(points);
    renderMapOut();
    void fetchRoad(points[0], points[1], clickToken);
  }
});

renderStatic();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}
