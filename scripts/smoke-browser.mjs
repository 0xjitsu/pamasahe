/* global document, Image, URL */
// Browser smoke test: serves dist/, opens it at 390x844, opens "Pick on map" and fails on
// any same-origin 404 / failed asset, a "Worker failed to load" error, or a blank map canvas.
// The map style is stubbed with an inline GeoJSON style so the check needs no network, but it
// still exercises the real maplibre worker (GeoJSON is parsed and tiled inside the worker).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';

const DIST = 'dist';
if (!existsSync(join(DIST, 'index.html'))) { console.error('smoke-browser: run npm run build first'); process.exit(1); }

const { chromium } = await import('playwright');
let browser;
try { browser = await chromium.launch(); } catch {
  try {
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    browser = await chromium.launch();
  } catch (e) {
    console.warn(`smoke-browser SKIPPED: no browser available (${String(e).split('\n')[0]})`);
    process.exit(0);
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join(DIST, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const STYLE = {
  version: 8,
  sources: { demo: { type: 'geojson', data: { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[120.9, 14.5], [121.1, 14.5], [121.1, 14.7], [120.9, 14.7], [120.9, 14.5]]] } },
  ] } } },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#f2efe9' } },
    { id: 'fill', type: 'fill', source: 'demo', paint: { 'fill-color': '#2563eb' } },
  ],
};

const errors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on('console', (m) => { if (m.type() === 'error' || /Worker failed/i.test(m.text())) errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => { if (r.url().startsWith(origin) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', (r) => { if (r.url().startsWith(origin)) errors.push(`failed ${r.url()}`); });
await page.route('https://tiles.openfreemap.org/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(STYLE) }));
await page.route('https://router.project-osrm.org/**', (r) => r.abort());

try {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.fill('#km', '6');
  if (!(await page.textContent('#results')).includes('₱18.00')) errors.push('results: PUJ 6 km should show ₱18.00');
  await page.click('#mapTitle');
  await page.waitForSelector('#map canvas');
  await page.waitForFunction(() => document.querySelector('#map canvas')?.width > 0);
  await page.waitForTimeout(2500); // let the worker tile the GeoJSON and the map render
  const shot = (await page.locator('#map canvas').screenshot()).toString('base64');
  const colors = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 17) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  }, shot);
  if (colors < 2) errors.push(`map canvas is blank (${colors} distinct color)`);
  if (await page.locator('#mapMsg').textContent()) errors.push('map reported unavailable');
} catch (e) {
  errors.push(`browser test threw: ${e.message}`);
}

await browser.close();
server.close();
if (errors.length) {
  console.error('SMOKE (browser) FAILED:\n - ' + [...new Set(errors)].join('\n - '));
  process.exit(1);
}
console.log('smoke-browser ok');
