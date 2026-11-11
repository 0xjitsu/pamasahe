// Smoke test: run after `npm run build`. Checks fares.json citations, built HTML tags and the preview MP4.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';

const errors = [];
const fail = (m) => errors.push(m);

// 1. Every verified fare needs memo, effective date and source URL; unverified modes must have no numbers.
const fares = JSON.parse(readFileSync('src/data/fares.json', 'utf8'));
for (const m of fares.modes) {
  if (m.status === 'verified-news') {
    const tariffs = [m.regular, ...(m.discounted ? [m.discounted] : [])];
    if (m.baseKm === undefined) fail(`${m.id}: missing baseKm`);
    for (const t of tariffs) if (typeof t.base !== 'number' || typeof t.perKm !== 'number') fail(`${m.id}: bad tariff`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.effective ?? '')) fail(`${m.id}: missing/invalid effective`);
    if (!m.sourceType) fail(`${m.id}: missing sourceType`);
    if (typeof m.officialMatrixVerified !== 'boolean') fail(`${m.id}: missing officialMatrixVerified`);
    if (!m.sources?.length) fail(`${m.id}: no sources`);
    for (const s of m.sources ?? []) if (!/^https:\/\//.test(s.url ?? '')) fail(`${m.id}: invalid source url`);
  } else if (m.status !== 'unverified') fail(`${m.id}: status must be verified-news|unverified`);
  else if (m.regular !== undefined) fail(`${m.id}: unverified mode must not carry fare numbers`);
}
if (!fares.lastChecked) fail('fares.json: missing lastChecked');

// 2. Built index.html tags.
const BASE = 'https://pamasahe.vercel.app';
if (!existsSync('dist/index.html')) fail('dist/index.html missing (run npm run build first)');
else {
  const html = readFileSync('dist/index.html', 'utf8');
  const metas = [...html.matchAll(/<meta\b[^>]*>/gs)].map((m) => m[0].replace(/\s+/g, ' '));
  const has = (key, val, content) => metas.some((t) =>
    new RegExp(`(?:property|name)="${key}"`).test(t) && new RegExp(`content="${content ?? val}"`).test(t));
  const want = [
    ['og:video', `${BASE}/og/preview.mp4`], ['og:video:secure_url', `${BASE}/og/preview.mp4`],
    ['og:video:type', 'video/mp4'], ['og:video:width', '1200'], ['og:video:height', '630'],
    ['twitter:card', 'player'], ['twitter:player', `${BASE}/og/player.html`],
    ['twitter:player:width', '1200'], ['twitter:player:height', '630'],
    ['og:image', `${BASE}/og/preview.png`], ['og:title', '.+'], ['og:description', '.+'],
  ];
  for (const [k, v] of want) if (!has(k, v)) fail(`index.html: missing <meta ${k}> = ${v}`);
}

// 2b. The built JS must reference a maplibre worker asset that actually exists in dist/assets (regression: 404 worker, blank map).
if (existsSync('dist/assets')) {
  const assets = readdirSync('dist/assets');
  const js = assets.filter((f) => /^index-.*\.js$/.test(f)).map((f) => readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
  const refs = [...js.matchAll(/maplibre-gl-worker-([\w-]+)\.mjs/g)].map((m) => m[0]).filter((n) => n !== 'maplibre-gl-worker-dev.mjs');
  if (!refs.length) fail('built JS does not reference a hashed maplibre worker asset (setWorkerUrl missing?)');
  else if (!refs.some((r) => assets.includes(r))) fail(`worker asset ${refs[0]} is referenced but missing from dist/assets`);
}

// 3. Assets.
for (const f of ['dist/og/preview.mp4', 'dist/og/player.html', 'dist/og/preview.png']) if (!existsSync(f)) fail(`${f} missing`);
if (existsSync('dist/og/preview.mp4')) {
  const size = statSync('dist/og/preview.mp4').size;
  if (size >= 5 * 1024 * 1024) fail(`preview.mp4 is ${size} bytes (>= 5 MB)`);
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name:format=format_name', '-of', 'default=nw=1', 'dist/og/preview.mp4'], { encoding: 'utf8' });
    if (!/codec_name=h264/.test(out)) fail('preview.mp4 is not H.264');
    if (!/format_name=.*mp4/.test(out)) fail('preview.mp4 is not MP4');
  } catch {
    // ffprobe unavailable: fall back to checking the MP4 ftyp box and an avc1 sample entry.
    const buf = readFileSync('dist/og/preview.mp4');
    if (buf.subarray(4, 8).toString('latin1') !== 'ftyp') fail('preview.mp4 has no ftyp box (not MP4)');
    if (!buf.includes('avc1')) fail('preview.mp4 has no avc1 (H.264) track');
  }
}

if (errors.length) {
  console.error('SMOKE FAILED:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log('smoke ok');
