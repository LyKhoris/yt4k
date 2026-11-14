#!/usr/bin/env bash
set -euo pipefail

# No dependency installation. Requires existing curl, sha256sum and ffmpeg.
assets=/tmp/opencode/yt4k-ph-harness
wrapper=/tmp/opencode/yt4k-ph-desktop-player-9.2.7.js
mkdir -p "$assets/media" "$assets/external-libraries"
if [[ ! -f "$wrapper" ]]; then
  curl --fail --silent --show-error https://ep.phncdn.com/prod/9.2.7/desktop-player.min.js -o "$wrapper"
fi
if [[ ! -f "$assets/desktop-player.min.css" ]]; then
  curl --fail --silent --show-error https://ep.phncdn.com/prod/9.2.7/desktop-player.min.css -o "$assets/desktop-player.min.css"
fi
if [[ ! -f "$assets/external-libraries/hls.light.min.js" ]]; then
  curl --fail --silent --show-error https://ep.phncdn.com/prod/9.2.7/external-libraries/hls.light.min.js -o "$assets/external-libraries/hls.light.min.js"
fi
sha256sum --check <<EOF
40340f0ce9623729dab1b08d48a97611190a5d943a4bd7922bca03a2d2692cd9  $wrapper
659c4c88554357d4464ab7d0c8cde19747cd9031caedb02694ec2dc2c155a3f2  $assets/desktop-player.min.css
1fba6f24e9a8d916465219dcf25348940815529cc8b2b25ed75db3caebdf0b64  $assets/external-libraries/hls.light.min.js
EOF
for rendition in 426x240 1280x720 3840x2160; do
  height=${rendition#*x}
  if [[ ! -f "$assets/media/$height.mp4" ]]; then
    ffmpeg -v error -n -f lavfi -i "color=c=0x386a91:s=$rendition:r=2:d=8" \
      -c:v libx264 -preset ultrafast -crf 35 -pix_fmt yuv420p -g 2 -an "$assets/media/$height.mp4"
  fi
  if [[ ! -f "$assets/media/$height.m3u8" ]]; then
    ffmpeg -v error -n -i "$assets/media/$height.mp4" -c copy \
      -hls_time 1 -hls_list_size 0 "$assets/media/$height.m3u8"
  fi
done
