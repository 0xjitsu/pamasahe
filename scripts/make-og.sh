#!/usr/bin/env bash
# Renders public/og/preview.png and preview.mp4 (1200x630, H.264, ~7s) with ffmpeg drawtext.
# The cards show "unverified" until real fares are in src/data/fares.json; re-render then.
set -euo pipefail
cd "$(dirname "$0")/.."
FONT="${FONT:-/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf}"
dt() { echo "drawtext=fontfile=$FONT:$1"; }

card() { # x label
  echo "drawbox=x=$1:y=250:w=340:h=260:color=white:t=fill,$(dt "text='$2':x=$(( $1 + 20 )):y=270:fontsize=30:fontcolor=#111827")"
}
FILTER="drawbox=x=0:y=0:w=1200:h=630:color=#0b5fff:t=fill,\
$(dt "text='Pamasahe - magkano ang pamasahe?':x=60:y=40:fontsize=48:fontcolor=white"),\
drawbox=x=60:y=130:w=420:h=80:color=white:t=fill,\
$(dt "text='Distance':x=80:y=150:fontsize=26:fontcolor=#4b5563"),\
$(dt "text='12.5 km':x=270:y=145:fontsize=44:fontcolor=#111827:enable='gte(t,1)'"),\
$(card 60 'PUJ / MPUJ'),$(card 430 'City bus'),$(card 800 'UV Express'),\
$(dt "text='Regular':x=80:y=330:fontsize=26:fontcolor=#4b5563:enable='gte(t,3)'"),\
$(dt "text='Regular':x=450:y=330:fontsize=26:fontcolor=#4b5563:enable='gte(t,3)'"),\
$(dt "text='Regular':x=820:y=330:fontsize=26:fontcolor=#4b5563:enable='gte(t,3)'"),\
$(dt "text='Discount 20 percent':x=80:y=420:fontsize=26:fontcolor=#16a34a:enable='gte(t,5)'"),\
$(dt "text='Discount 20 percent':x=450:y=420:fontsize=26:fontcolor=#16a34a:enable='gte(t,5)'"),\
$(dt "text='Discount 20 percent':x=820:y=420:fontsize=26:fontcolor=#16a34a:enable='gte(t,5)'"),\
$(dt "text='Students, seniors, PWD  |  pamasahe.vercel.app':x=60:y=560:fontsize=28:fontcolor=white")"

ffmpeg -y -loglevel error -f lavfi -i color=c=0b5fff:s=1200x630:d=7:r=30 -vf "$FILTER" \
  -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 28 -movflags +faststart -an public/og/preview.mp4
ffmpeg -y -loglevel error -ss 6.5 -i public/og/preview.mp4 -frames:v 1 public/og/preview.png
ls -l public/og
