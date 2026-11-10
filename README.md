# Pamasahe

"Magkano ang pamasahe?" A free **fare calculator for Philippine commuters and students**: enter a distance (km) or pick two points on a map, and see the regular and 20% discounted fare for traditional jeepney (PUJ), modern jeepney (MPUJ), city bus (ordinary, aircon) and UV Express. English/Tagalog toggle, mobile-first, works offline after first load.

Live: https://pamasahe.vercel.app

## ⚠️ Fare data status (read this first)

**v1 ships with every mode marked `unverified` and no fare numbers.** The build environment that produced v1 could not reach ltfrb.gov.ph (HTTP 403), pia.gov.ph (403) or any search engine, so no current LTFRB matrix could be verified from a source. Per the project rule "never guess a number", nothing was entered. The calculator, tests, map and UI are complete; the page shows an "unverified" notice per mode until `src/data/fares.json` is filled in with cited data (below).

## Fare sources and how to update the matrix

`src/data/fares.json` is the single source of truth. To make a mode live, replace its entry with:

```json
{
  "id": "puj",
  "name": { "en": "Traditional jeepney (PUJ)", "tl": "Tradisyonal na dyip (PUJ)" },
  "status": "verified",
  "baseFare": 0,
  "baseKm": 0,
  "perKm": 0,
  "rounding": "nearest-0.25",
  "source": { "memo": "<memorandum circular / board resolution no.>", "effectiveDate": "YYYY-MM-DD", "url": "https://..." }
}
```

`rounding` is one of `none`, `nearest-0.25`, `nearest-0.5`, `nearest-1`, `ceil-1`; copy it from the issuance. Use only official sources (LTFRB issuances, ltfrb.gov.ph, official LTFRB/DOTr pages, or PNA/PIA reports quoting them). Then update `lastChecked`, run `bash scripts/make-og.sh` to re-render the preview video if desired, and `npm run lint && npm run build && npm run smoke`. Smoke fails if a verified mode lacks a memo number, effective date or https source URL, or if an unverified mode carries fare numbers. When LTFRB changes or rolls back a fare, edit the entry and `effectiveDate`/`memo`; old values live in git history.

**Discount:** 20% for students (RA 11314), senior citizens (RA 9994) and PWDs (RA 10754), applied to the computed fare and rounded with the mode's rule. The rate comes from the statutes (links in `fares.json`); the rounding of discounted fares has not been checked against an LTFRB issuance.

Formula: `fare = baseFare` for the first `baseKm`, plus `(km − baseKm) × perKm` after that (fractions pro-rated), then rounded. Unit tests (`src/lib/fare.test.ts`) use a clearly-labelled **synthetic fixture**, not real LTFRB values; add real-matrix cases beside the citation once data is in.

## Map and distance

- Map: [MapLibre GL](https://maplibre.org) with [OpenFreeMap](https://openfreemap.org) vector tiles (free, no key; data © OpenStreetMap contributors, attribution shown in the footer and map).
- Straight-line distance uses the haversine formula.
- Road distance uses the public OSRM demo server (`router.project-osrm.org`): best effort, no SLA, fair-use rate limits, 6 s timeout. If it fails, the app falls back to straight-line × 1.3, labelled as an estimate.
- No API keys, no paid services, no analytics.

## Limitations

- Fares follow Metro Manila/LTFRB matrices; provincial and LGU rates differ.
- Straight-line and estimated road distances differ from the distance a driver or the LTFRB counts; actual fare may differ.
- Fares can be rolled back or temporarily changed by LTFRB; check "Fares last checked" on the page.
- Drivers may only charge the posted matrix. This is an unofficial guide.

## Development

```
npm install
npm run dev      # local dev server
npm run lint     # eslint + tsc + unit tests
npm run build    # outputs dist/
npm run smoke    # checks citations, OG/Twitter tags, preview MP4 (<5 MB, H.264)
scripts/check-live.sh https://pamasahe.vercel.app   # verify deployed tags + MP4
```

The link-preview video (`public/og/preview.mp4`, 1200×630) is rendered by `scripts/make-og.sh` with ffmpeg.

## Support
Donate: https://github.com/sponsors/0xjitsu <!-- TODO: placeholder until Berna picks a donation account; set DONATE_URL = '' in src/main.ts to hide -->

## License
MIT
