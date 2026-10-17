#!/bin/sh
# usage: tools/tune.sh '{"name":{patch},...}' out.png
node tools/lookdev.mjs "$1" > /dev/null 2>&1
python3 - "$1" "$2" <<'PY'
import json,sys
from PIL import Image, ImageDraw
names=list(json.loads(sys.argv[1]).keys())
ims=[Image.open(f'../out/test/dbg_{n}.png').crop((200,120,780,430)) for n in names]
W,H=ims[0].size; cols=min(4,len(ims)); rows=(len(ims)+cols-1)//cols
sh=Image.new('RGB',(W*cols,H*rows),'white')
for i,(n,im) in enumerate(zip(names,ims)):
    d=ImageDraw.Draw(im); d.text((6,6),n,fill=(255,0,0)); sh.paste(im,((i%cols)*W,(i//cols)*H))
sh.save(sys.argv[2])
PY
