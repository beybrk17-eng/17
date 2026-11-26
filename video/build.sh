#!/usr/bin/env bash
# Assemble final video: frames + voiceover + procedural SFX + burned subtitles -> 1080x1920
set -euo pipefail
cd "$(dirname "$0")"
VO="${1:-../bolum1/seslendirme.mp3}"
OUTF="${2:-../bolum1/BOLUM1_UCAK.mp4}"
python3 -I sfx.py out/sfx.wav 93
python3 -I music.py out/music.wav 93
python3 -I make_ass.py ../bolum1/bolum1.srt out/subs.ass
ffmpeg -v error -y -framerate 30 -i out/frames/f%05d.jpg -i "$VO" -i out/sfx.wav -i out/music.wav \
  -filter_complex "\
[0:v]subtitles=out/subs.ass:fontsdir=fonts,scale=1080:1920:flags=lanczos,format=yuv420p[v];\
[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=1.9,apad=whole_dur=93[vo];\
[2:a]volume=0.55[fx];\
[3:a]volume=0.1[mu];\
[vo]asplit=3[vo1][vo2][vo3];\
[fx][vo2]sidechaincompress=threshold=0.04:ratio=5:attack=20:release=350[fxd];\
[mu][vo3]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=600[mud];\
[vo1][fxd][mud]amix=inputs=3:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 23 -profile:v high -r 30 -c:a aac -b:a 192k -movflags +faststart -t 93 "$OUTF"
echo "built $OUTF"
