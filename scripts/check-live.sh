#!/usr/bin/env bash
# Usage: scripts/check-live.sh https://pamasahe.vercel.app
# Verifies link-preview tags and /og/preview.mp4 on a deployed URL.
set -u
BASE="${1:?usage: check-live.sh <url>}"
BASE="${BASE%/}"
fail=0
bad() { echo "FAIL: $1"; fail=1; }

# Flatten whitespace so tags spanning several lines still match.
html="$(curl -fsSL "$BASE/" | tr '\n\r\t' '   ' | sed 's/  */ /g')" || { echo "FAIL: cannot fetch $BASE/"; exit 1; }

for key in og:video og:video:secure_url og:video:type og:video:width og:video:height \
           twitter:card twitter:player twitter:player:width twitter:player:height \
           og:image og:title og:description; do
  if ! printf '%s' "$html" | grep -Eq "<meta[^>]*(property|name)=\"$key\"[^>]*>"; then bad "missing meta $key"; fi
done
printf '%s' "$html" | grep -Eq 'twitter:card"[^>]*content="player"' || bad "twitter:card is not player"
printf '%s' "$html" | grep -Eq 'og:video"[^>]*content="https://' || bad "og:video not absolute https"

mp4="$BASE/og/preview.mp4"
hdr="$(curl -sIL "$mp4")"
code="$(printf '%s' "$hdr" | grep -E '^HTTP' | tail -1 | awk '{print $2}')"
[ "$code" = "200" ] || bad "preview.mp4 status $code"
printf '%s' "$hdr" | tr -d '\r' | grep -iq '^content-type: video/mp4' || bad "preview.mp4 content-type is not video/mp4"
size="$(curl -sL -o /dev/null -w '%{size_download}' "$mp4")"
[ "${size:-0}" -gt 0 ] && [ "$size" -lt 5242880 ] || bad "preview.mp4 size $size not in (0, 5 MB)"

pc="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/og/player.html")"
[ "$pc" = "200" ] || bad "player.html status $pc"

[ $fail -eq 0 ] && echo "live check ok: $BASE"
exit $fail
