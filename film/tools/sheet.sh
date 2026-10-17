#!/bin/sh
# usage: tools/sheet.sh FROM TO FPS SAMPLES OUTNAME [COLS]
FROM=$1; TO=$2; FPS=$3; SAMPLES=$4; NAME=$5; COLS=${6:-6}
OUT=../out/sheets; mkdir -p $OUT
node tools/render.mjs --from $FROM --to $TO --fps $FPS --samples $SAMPLES --out $OUT/$NAME.mp4 --crf 12 > $OUT/$NAME.log 2>&1 || { cat $OUT/$NAME.log; exit 1; }
grep -i "error\|warn" $OUT/$NAME.log | head -5
N=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 $OUT/$NAME.mp4)
ROWS=$(( (N + COLS - 1) / COLS ))
ffmpeg -v error -y -i $OUT/$NAME.mp4 -vf "scale=480:-1,drawtext=fontfile=$(dirname "$0")/../public/fonts/JetBrainsMono-Bold.ttf:text='%{eif\:$FROM+n/$FPS*1000\:d}ms':x=4:y=4:fontsize=13:fontcolor=red:box=1:boxcolor=white@0.6,tile=${COLS}x${ROWS}" -frames:v 1 $OUT/$NAME.jpg
echo $OUT/$NAME.jpg
