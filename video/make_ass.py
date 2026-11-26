import re, sys
src, out = sys.argv[1], sys.argv[2]
blocks = open(src, encoding='utf-8').read().strip().split('\n\n')
def conv(ts):
    h, m, rest = ts.split(':'); s, ms = rest.split(',')
    return f"{int(h)}:{m}:{s}.{int(ms)//10:02d}"
hdr = """[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Inter SemiBold,36,&H00FFFFFF,&H00FFFFFF,&H90000000,&H64000000,0,0,0,0,100,100,0,0,1,1.2,2.2,2,50,50,285,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
lines = []
for b in blocks:
    p = b.split('\n'); a, e = p[1].split(' --> ')
    txt = ' '.join(p[2:]).replace('"', '“', 1)
    txt = re.sub(r'“([^"]*)"', r'“\1”', txt)
    lines.append(f"Dialogue: 0,{conv(a)},{conv(e)},Sub,,0,0,0,,{{\\fad(60,60)}}{txt}")
open(out, 'w', encoding='utf-8').write(hdr + '\n'.join(lines) + '\n')
print(len(lines), 'events')
