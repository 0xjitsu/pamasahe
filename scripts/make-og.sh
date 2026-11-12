#!/usr/bin/env bash
# Renders public/og/preview.png and preview.mp4 (1200x630, H.264, ~7s) with ffmpeg drawtext.
# Values are fares.json results for a 6 km ride (cross-checked in src/lib/fare.test.ts, "OG preview"):
#   PUJ 18.00 / 14.45, MPUJ 21.80 / 17.34, City bus (ordinary) 17.49 / 13.99.
# Re-run this script and re-check those test values whenever fares.json changes.
set -euo pipefail
cd "$(dirname "$0")/.."
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"
dt() { echo "drawtext=fontfile=$FONT:$1"; }

# card x title regular discounted
card() {
  echo "drawbox=x=$1:y=240:w=340:h=270:color=white:t=fill,\
$(dt "text='$2':x=$(( $1 + 20 )):y=260:fontsize=28:fontcolor=#111827"),\
$(dt "text='Regular':x=$(( $1 + 20 )):y=320:fontsize=24:fontcolor=#4b5563:enable='gte(t,3)'"),\
$(dt "text='≈ ₱$3':x=$(( $1 + 20 )):y=352:fontsize=44:fontcolor=#111827:enable='gte(t,3)'"),\
$(dt "text='Student / Senior / PWD':x=$(( $1 + 20 )):y=420:fontsize=22:fontcolor=#4b5563:enable='gte(t,4.5)'"),\
$(dt "text='≈ ₱$4':x=$(( $1 + 20 )):y=450:fontsize=44:fontcolor=#0a4fd6:enable='gte(t,4.5)'")"
}
FILTER="drawbox=x=0:y=0:w=1200:h=630:color=#0a4fd6:t=fill,\
$(dt "text='Pamasahe - magkano ang pamasahe?':x=60:y=40:fontsize=48:fontcolor=white"),\
drawbox=x=60:y=120:w=420:h=80:color=white:t=fill,\
$(dt "text='Distance':x=80:y=145:fontsize=26:fontcolor=#4b5563"),\
$(dt "text='6 km':x=300:y=138:fontsize=44:fontcolor=#111827:enable='gte(t,1)'"),\
$(card 60 'Jeepney (PUJ)' 18.00 14.45),$(card 430 'Modern jeepney' 21.80 17.34),$(card 800 'City bus' 17.49 13.99),\
$(dt "text='Estimates. Based on news reports of the 28 Sep 2026 LTFRB fare guide.':x=60:y=545:fontsize=24:fontcolor=white"),\
$(dt "text='Pay what the posted fare matrix says  |  pamasahe.vercel.app':x=60:y=580:fontsize=24:fontcolor=white")"

ffmpeg -y -loglevel error -f lavfi -i color=c=0a4fd6:s=1200x630:d=7:r=30 -vf "$FILTER" \
  -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 28 -movflags +faststart -an public/og/preview.mp4
ffmpeg -y -loglevel error -ss 6.5 -i public/og/preview.mp4 -frames:v 1 public/og/preview.png
ls -l public/og
