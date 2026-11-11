# Pamasahe

"Magkano ang pamasahe?" A free **fare calculator for Philippine commuters and students**: enter a distance (km) or pick two points on a map, and see the regular and 20% discounted fare for traditional jeepney (PUJ), modern jeepney (MPUJ), city bus (ordinary, aircon) and UV Express. English/Tagalog toggle, mobile-first, works offline after first load.

Live: https://pamasahe.vercel.app

## Fare data status

Fares are those in force since **28 Sep 2026** (DOTr memo of 25 Sep 2026 lifting the suspension; LTFRB fare guides released 28 Sep 2026). Last checked **2026-11-11**; no rollback found.

**Verification level: `verified-news`.** The figures come from news reports of the LTFRB fare guide, not the official PDF matrix (ltfrb.gov.ph returned 403 to the build environment), so `officialMatrixVerified` is `false`. The UI badge says so ("based on news reports of the 28 Sep 2026 LTFRB fare guide").

| Mode | Regular | Student/Senior/PWD |
|---|---|---|
| PUJ traditional | P14.00 first 4 km, +P2.00/km | P11.25 first 4 km, +P1.60/km |
| MPUJ modern | P17.00 first 4 km, +P2.40/km | P13.50 first 4 km, +P1.92/km |
| City bus ordinary | P15.00 first 5 km, +P2.49/km | P12.00 first 5 km, +P1.99/km |
| City bus aircon | P18.00 first 5 km, +P2.98/km | P14.50 first 5 km, +P2.38/km |
| UV Express traditional | P2.60/km | 20% discount (RA 9994/10754/11314) |
| UV Express modern | P3.00/km | 20% discount |

Sources:
- PTV News, [LTFRB releases new matrices for PUV fare hikes effective Sept. 28](https://ptvnews.ph/ltfrb-releases-new-matrices-for-puv-fare-hikes-effective-sept-28/) (28 Sep 2026): all rows
- GMA News, [DOTr approves LTFRB fare hike recommendation for PUVs](https://www.gmanetwork.com/news/money/economy/1003715/dotr-approves-ltfrb-fare-hike-recommendation-for-puvs/story/): jeepney rows
- Philstar, [DOTr lifts suspension of PUV fare hike](https://www.philstar.com/headlines/2026/09/26/2558947/dotr-lifts-suspension-puv-fare-hike) (26 Sep 2026): bus rows

**Rounding is unverified.** The app shows the raw computed fare (to the centavo) and the line "Your ride's posted LTFRB fare matrix governs; actual fares are rounded per the matrix." No rounding rule is applied.

## Updating the fare data

`src/data/fares.json` is the single source of truth. Each mode has `status` (`verified-news` or `unverified`), `effective`, `sourceType`, `officialMatrixVerified`, `sources[]` (name + https url), `baseKm`, `regular {base, perKm}` and, where published, `discounted {base, perKm}`. Where no discounted figure is published (UV Express) the 20% statutory discount is applied to the regular fare. Update `lastChecked`, then run `npm run lint && npm run build && npm run smoke`; smoke fails if a mode lacks effective date, source type or https sources, or if an `unverified` mode carries fare numbers. When the official LTFRB matrix is checked, set `officialMatrixVerified` to `true` and cite the memo. Old values live in git history.

**Discount:** 20% for students (RA 11314), senior citizens (RA 9994) and PWDs (RA 10754). Published discounted figures are used as-is for PUJ, MPUJ and city bus; the 20% is computed only for UV Express (law links in `fares.json`, not fetched in the build environment).

Formula: `fare = base` for the first `baseKm`, plus `(km − baseKm) × perKm` after that (fractions pro-rated), no rounding rule applied. Unit tests (`src/lib/fare.test.ts`) are built from the table above.

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
