"""Tapcue brand mark: the amber cue light in a dark console housing.
Writes SVG sources to out/. Wordmark text is converted to outlines (Inter Display SemiBold)."""
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

FONT = '/usr/share/fonts/opentype/inter/InterDisplay-SemiBold.otf'
C = dict(tile_hi='#3d3632', tile_lo='#171412', housing='#0c0a09', bezel_hi='#6b635d', bezel_lo='#1c1917',
         a50='#fffbeb', a100='#fef3c7', a300='#fcd34d', a400='#fbbf24', a500='#f59e0b', a600='#d97706',
         ink='#1c1917', paper='#fafaf9', edge='#44403c')

def defs(p):
    return f'''<defs>
  <radialGradient id="{p}tile" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="{C['tile_hi']}"/><stop offset="1" stop-color="{C['tile_lo']}"/></radialGradient>
  <radialGradient id="{p}glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{C['a400']}" stop-opacity=".6"/><stop offset=".5" stop-color="{C['a500']}" stop-opacity=".2"/><stop offset="1" stop-color="{C['a500']}" stop-opacity="0"/></radialGradient>
  <radialGradient id="{p}lamp" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="{C['a100']}"/><stop offset=".3" stop-color="{C['a300']}"/><stop offset=".72" stop-color="{C['a400']}"/><stop offset="1" stop-color="{C['a600']}"/></radialGradient>
  <linearGradient id="{p}bezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{C['bezel_hi']}"/><stop offset="1" stop-color="{C['bezel_lo']}"/></linearGradient>
</defs>'''

def lamp(p, cx, cy, k=1.0, glow=True):
    """Cue light centred at cx, cy; k=1 is sized for a 512 tile."""
    s = lambda v: round(v * k, 2)
    g = f'<circle cx="{cx}" cy="{cy}" r="{s(236)}" fill="url(#{p}glow)"/>' if glow else ''
    return f'''{g}
  <circle cx="{cx}" cy="{cy}" r="{s(160)}" fill="{C['housing']}"/>
  <circle cx="{cx}" cy="{cy}" r="{s(155)}" fill="none" stroke="url(#{p}bezel)" stroke-width="{s(10)}"/>
  <circle cx="{cx}" cy="{cy}" r="{s(116)}" fill="url(#{p}lamp)"/>
  <ellipse cx="{round(cx - s(40), 2)}" cy="{round(cy - s(46), 2)}" rx="{s(38)}" ry="{s(22)}" fill="#ffffff" fill-opacity=".55" transform="rotate(-35 {round(cx - s(40), 2)} {round(cy - s(46), 2)})"/>'''

def icon_svg(size=512, rounded=False, k=1.0, title='Tapcue'):
    r = f' rx="{round(size * 0.2237)}"' if rounded else ''
    f = size / 512
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="{size}" height="{size}" role="img" aria-label="{title}">
{defs('t-')}
  <rect width="512" height="512"{(' rx="%d"' % round(512 * 0.2237)) if rounded else ''} fill="url(#t-tile)"/>
  {lamp('t-', 256, 256, k)}
</svg>'''

def favicon_svg():
    # Drawn on a 32 grid: dark tile keeps it visible on light and dark tab bars.
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
<defs><radialGradient id="f-lamp" cx="40%" cy="34%" r="72%"><stop offset="0" stop-color="{C['a100']}"/><stop offset=".35" stop-color="{C['a300']}"/><stop offset="1" stop-color="{C['a500']}"/></radialGradient></defs>
  <rect width="32" height="32" rx="7" fill="{C['ink']}"/>
  <circle cx="16" cy="16" r="11" fill="{C['housing']}" stroke="#57534e" stroke-width="1.25"/>
  <circle cx="16" cy="16" r="8" fill="url(#f-lamp)"/>
  <ellipse cx="13.2" cy="12.9" rx="2.6" ry="1.5" fill="#ffffff" fill-opacity=".6" transform="rotate(-35 13.2 12.9)"/>
</svg>'''

def text_path(text, size, x, baseline):
    blob = hb.Blob.from_file_path(FONT); face = hb.Face(blob); font = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {'kern': True, 'liga': True})
    tt = TTFont(FONT); gs = tt.getGlyphSet(); upem = tt['head'].unitsPerEm; order = tt.getGlyphOrder()
    sc = size / upem; pen = SVGPathPen(gs); cur = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        tp = TransformPen(pen, (sc, 0, 0, -sc, x + (cur + pos.x_offset) * sc, baseline - pos.y_offset * sc))
        gs[name].draw(tp); cur += pos.x_advance
    cap = tt['OS/2'].sCapHeight * sc
    return pen.getCommands(), cur * sc, cap

def logo_svg(theme):
    H, tile, pad, gap, fs = 128, 96, 16, 24, 76
    ink = C['ink'] if theme == 'light' else C['paper']
    tx = pad + tile + gap
    d, w, cap = text_path('Tapcue', fs, tx, 0)
    baseline = round(H / 2 + cap / 2, 2)
    d, w, cap = text_path('Tapcue', fs, tx, baseline)
    W = round(tx + w + pad)
    k = tile / 512
    stroke = f'<rect x="{pad + .75}" y="{(H - tile) / 2 + .75}" width="{tile - 1.5}" height="{tile - 1.5}" rx="{round(tile * .2237)}" fill="none" stroke="{C["edge"]}" stroke-width="1.5"/>' if theme == 'dark' else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="Tapcue">
{defs('l-')}
  <g transform="translate({pad} {(H - tile) / 2}) scale({k})">
    <rect width="512" height="512" rx="{round(512 * .2237)}" fill="url(#l-tile)"/>
    {lamp('l-', 256, 256, 1.0)}
  </g>{stroke}
  <path fill="{ink}" d="{d}"/>
</svg>'''

files = {
  'tapcue-icon.svg': icon_svg(512, rounded=False),            # master, full bleed (iOS masks it)
  'tapcue-icon-rounded.svg': icon_svg(512, rounded=True),     # PWA "any"
  'tapcue-icon-maskable.svg': icon_svg(512, rounded=False, k=0.84),  # content inside the 80% safe zone
  'favicon.svg': favicon_svg(),
  'tapcue-logo-light.svg': logo_svg('light'),
  'tapcue-logo-dark.svg': logo_svg('dark'),
}
for n, s in files.items():
    open(f'out/{n}', 'w').write(s)
print('\n'.join(files))
