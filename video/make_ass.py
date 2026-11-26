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
Style: Sub,Inter,44,&H00FFFFFF,&H00FFFFFF,&HB4000000,&H00000000,1,0,0,0,100,100,0,0,1,3,0,2,44,44,300,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
YEL='&H4DD3FF&'; RED='&H4E3BFF&'
KEY=[(r'füze',RED),(r'KIYIYA GİTMEYİN',YEL),(r'vuruldu',RED),(r'kırk dakika',YEL),(r'bayıldı',RED),(r'simülatörde',YEL),(r'Kokpite git',RED),(r'Koltuğunda kal',YEL),(r'senin elinde',YEL),(r'savaş uçağı',YEL),(r'Ölecek miyiz\?',RED)]
lines = []
for b in blocks:
    p = b.split('\n'); a, e = p[1].split(' --> ')
    txt = ' '.join(p[2:]).replace('"', '“', 1)
    txt = re.sub(r'“([^"]*)"', r'“\1”', txt)
    for kw, col in KEY:
        txt = re.sub(kw, lambda m: '{\\c' + col + '}' + m.group(0) + '{\\c&HFFFFFF&}', txt, flags=re.I)
    lines.append(f"Dialogue: 0,{conv(a)},{conv(e)},Sub,,0,0,0,,{{\\fad(40,40)\\blur1.5}}{txt}")
open(out, 'w', encoding='utf-8').write(hdr + '\n'.join(lines) + '\n')
print(len(lines), 'events')
