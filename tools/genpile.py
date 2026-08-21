#!/usr/bin/env python3
"""
Generates the leaf-pile SVG for featured.html.

The pile is built OUT OF leaves rather than being a smooth silhouette with
leaves stuck on top -- that was what made the first attempt read as clip art.
A dark under-mass fills the body and ~150 individually placed, rotated, scaled
and coloured leaves form the entire visible surface, including a ragged crest.

Two details do most of the work:
  * every leaf carries a dark translucent outline, which is what separates
    one overlapping leaf from the next instead of letting them merge into a blob
  * every leaf carries veins, which is what makes a shape read as "leaf"
    rather than "pebble"

Depth runs dark/small at the back to light/large at the front.
Deterministic: fixed seed, so the pile is identical on every page load.
"""
import math
import random

SEED = 20260813
# W is deliberately much wider than any viewport. It lets the CSS size the
# pile by HEIGHT and crop horizontally, instead of scaling up to cover the
# width and slicing the crest off the top. See css/seasonal.css.
W, H = 2160, 230

OUTLINE = 'stroke="rgba(28,14,4,.55)" stroke-width="2.2" stroke-linejoin="round"'
VEIN = 'fill="none" stroke="rgba(28,14,4,.30)" stroke-width="2" stroke-linecap="round"'

# --------------------------------------------------------------- leaf shapes
# Each drawn in a 100x100 box: tip at top, stem at bottom (50,99).
# Lobe notches are deliberately shallow -- cutting them deep turns a maple
# into a spiky starburst, which was the other half of the clip-art problem.
SHAPES = {
    "maple": {
        "d": "M50 6 L55 25 L69 16 L66 36 L84 32 L73 50 L90 58 L71 64 L77 80 "
             "L59 75 L55 87 L52 79 L52 99 L48 99 L48 79 L45 87 L41 75 L23 80 "
             "L29 64 L10 58 L27 50 L16 32 L34 36 L31 16 L45 25 Z",
        "v": "M50 96 L50 30 M50 44 L31 34 M50 44 L69 34 M50 58 L28 52 "
             "M50 58 L72 52 M50 72 L40 68 M50 72 L60 68",
    },
    "oak": {
        "d": "M50 5 C56 11 59 17 58 24 C65 20 73 22 75 30 C77 38 71 43 63 43 "
             "C71 47 77 53 75 61 C73 69 65 71 58 67 C59 74 55 82 52 90 L52 99 "
             "L48 99 L48 90 C45 82 41 74 42 67 C35 71 27 69 25 61 C23 53 29 47 "
             "37 43 C29 43 23 38 25 30 C27 22 35 20 42 24 C41 17 44 11 50 5 Z",
        "v": "M50 96 L50 14 M50 32 L34 26 M50 32 L66 26 M50 52 L32 46 "
             "M50 52 L68 46 M50 70 L38 65 M50 70 L62 65",
    },
    "ovate": {
        "d": "M50 3 C73 27 85 53 51 90 L51 99 L49 99 L49 90 C15 53 27 27 50 3 Z",
        "v": "M50 97 L50 8 M50 26 L36 19 M50 26 L64 19 M50 44 L33 36 "
             "M50 44 L67 36 M50 62 L37 55 M50 62 L63 55 M50 78 L42 73 M50 78 L58 73",
    },
    # aspen: rounded body but a clear point and a long stem, so it never
    # flattens into a circle the way a pure ellipse does
    "aspen": {
        "d": "M50 5 C68 12 84 27 84 46 C84 65 69 82 52 89 L52 99 L48 99 L48 89 "
             "C31 82 16 65 16 46 C16 27 32 12 50 5 Z",
        "v": "M50 96 L50 12 M50 30 L34 23 M50 30 L66 23 M50 50 L30 43 "
             "M50 50 L70 43 M50 68 L37 62 M50 68 L63 62",
    },
    "birch": {
        "d": "M50 4 C62 19 72 37 70 55 C68 71 60 84 51 91 L51 99 L49 99 L49 91 "
             "C40 84 32 71 30 55 C28 37 38 19 50 4 Z",
        "v": "M50 97 L50 10 M50 28 L37 21 M50 28 L63 21 M50 46 L34 39 "
             "M50 46 L66 39 M50 64 L39 58 M50 64 L61 58",
    },
    "willow": {
        "d": "M50 3 C60 26 66 54 52 89 L52 99 L48 99 L48 89 C34 54 40 26 50 3 Z",
        "v": "M50 97 L50 8 M50 30 L41 24 M50 30 L59 24 M50 50 L40 44 "
             "M50 50 L60 44 M50 70 L43 65 M50 70 L57 65",
    },
}

# --------------------------------------------------------------- leaf palette
# Real leaf litter is earthy and mostly desaturated. Bright rust is used
# sparingly as an accent so it reads as a highlight, not as cartoon orange.
BACK = ["#4E3218", "#5C3B1C", "#6A4522", "#573517", "#63431F", "#4A2E14", "#70502A",
        "#5F3A1E", "#6B4A26"]
MID = ["#8A5A2A", "#96682F", "#7E5326", "#A2703A", "#8B5F35", "#9C6B33", "#7A4E22",
       "#A87B41", "#8F6236", "#87552C"]
FRONT = ["#B98C4C", "#C49A5A", "#AD8044", "#C9A468", "#B58748", "#A67A3E", "#C09252",
         "#BF9757", "#B0843F", "#CBA96E"]
# Rust and gold used as accents. Sprinkled through every band rather than
# clustered, so the pile has autumn colour without turning cartoon-orange.
ACCENT = ["#A8442A", "#B85630", "#9C3D22", "#C06A34", "#8E3A20", "#B24A26",
          "#C68A32", "#D19A44", "#B87E2C", "#A85A24"]

# ---------------------------------------------------------------- pumpkins
# Built from five overlapping lobe ellipses, matching the .nav-pumpkin badge in
# featured.html and reusing its palette so the two read as the same object.
# Outer lobes darkest, centre brightest; the overlaps give the bumpy silhouette
# and the rib shading at once.
#
# The first version here was a single flat ellipse with rib lines drawn on top.
# It read as a striped ball, not a pumpkin - the lobed OUTLINE is what sells it,
# not the ribs.
PUMPKIN_VARIANTS = {
    # "edge" is the outline stroke. Per-variant rather than one flat dark:
    # a near-black outline on the cream heirloom reads harsh, a warm brown
    # does not.
    "orange": {"edge": "#8C3A12", "outer": "#C4571F", "mid": "#E06A1E", "core": "#F5811F"},
    "russet": {"edge": "#73290C", "outer": "#A8451A", "mid": "#C05A1B", "core": "#D46B20"},
    "pale":   {"edge": "#9C8763", "outer": "#C9B896", "mid": "#DCCBA8", "core": "#EBDCBC"},
}

# (cx, rx, ry, tone) about a centre line at PUMPKIN_CY. Squat on purpose:
# roughly 1.45 wide to tall, the same ratio as the navbar badge.
PUMPKIN_CY = 62.0
PUMPKIN_LOBES = (
    (23.2, 18.4, 27.0, "outer"),
    (76.8, 18.4, 27.0, "outer"),
    (35.0, 20.1, 29.5, "mid"),
    (65.0, 20.1, 29.5, "mid"),
    (50.0, 22.3, 30.8, "core"),
)
# Every lobe is stroked, which does two jobs at once: the outer lobes' strokes
# form the silhouette outline, and where lobes overlap the strokes show as the
# curved grooves between ribs.
#
# Do NOT go back to a single enclosing backing ellipse. One ellipse big enough
# to sit behind all five lobes is also bigger than all five, so it swallows the
# bumpy outline and the pumpkin reads as a smooth striped ball - the lobed
# SILHOUETTE is what makes it a pumpkin.
PUMPKIN_EDGE_WIDTH = 2.6
# Body reaches this far below the box centre - used to sit the base in the pile.
PUMPKIN_BASE_DROP = 43.5

# Stem, highlight and green tendril, scaled up from the navbar badge.
PUMPKIN_STEM = (
    ("M50 36.3 C47.9 24.1 51.3 15.1 59.8 12.6", "#6B4A28", 9.0),
    ("M50.9 33.5 C49.4 25 51.9 18.6 57.7 15.8", "#8A6236", 3.2),
    ("M54.3 22 c7.3-2.6 12.8 1.3 11.6 6.2 -1.1 4.1 -6.4 4.1 -7.3 .4", "#7A9B4F", 2.8),
)

PUMPKIN_PLACEMENTS = (
    ( 250, 1.15,  -5, "orange"),
    ( 880, 1.45,   3, "russet"),   # the big one
    (1152, 0.92,  -9, "pale"),     # small pale heirloom tucked beside it
    (1742, 1.22,   5, "orange"),
)


def pumpkin_cy(px, pscale):
    """
    Centre height for a pumpkin at px.

    Derived from where the BASE should land rather than from the crest, so
    every pumpkin buries the same amount no matter how big it is. The body
    spans -21..+47 about its centre, so a base at profile+85 puts the bottom
    down inside the pile face while the body and stem clear the crest.
    """
    return profile(px) + 85 - PUMPKIN_BASE_DROP * pscale



def profile(x):
    """Top edge of the pile: a few uneven humps plus ripple, never symmetric."""
    t = x / W
    y = 158.0
    y -= 44 * math.exp(-(((t - 0.28) / 0.19) ** 2))
    y -= 60 * math.exp(-(((t - 0.61) / 0.17) ** 2))
    y -= 32 * math.exp(-(((t - 0.87) / 0.14) ** 2))
    y -= 22 * math.exp(-(((t - 0.05) / 0.10) ** 2))
    y -= 9 * math.sin(t * 13.7 + 0.4)
    y -= 5 * math.sin(t * 29.0 + 1.9)
    return y


def use(shape, cx, cy, rot, scale, fill, opacity=None):
    """A <use> whose transform rotates/scales about the leaf's own centre."""
    op = ' opacity="%.2f"' % opacity if opacity is not None else ""
    return (
        '\t\t\t\t\t<use href="#slLeaf-%s" transform="translate(%.1f %.1f) '
        'rotate(%.1f) scale(%.3f) translate(-50 -50)" fill="%s"%s/>'
        % (shape, cx, cy, rot, scale, fill, op)
    )


def pumpkin(cx, cy, rot, scale, variant):
    """A <use> of a pumpkin variant, rotated/scaled about its own centre."""
    return (
        '\t\t\t\t\t<use href="#slPumpkin-%s" transform="translate(%.1f %.1f) '
        'rotate(%.1f) scale(%.3f) translate(-50 -50)"/>'
        % (variant, cx, cy, rot, scale)
    )


def band(rng, n, y_lo, y_hi, s_lo, s_hi, palette, accent_rate=0.0, op=None):
    """
    Scatter n leaves across the width. x is jittered off an even stride so the
    spacing is irregular without leaving bald patches -- pure uniform random
    clumps too hard and reads as noise.
    """
    out = []
    names = list(SHAPES.keys())
    stride = (W + 260) / n
    for i in range(n):
        x = -130 + stride * (i + rng.uniform(-0.58, 0.58))
        cy = profile(x) + rng.uniform(y_lo, y_hi)
        pal = ACCENT if rng.random() < accent_rate else palette
        out.append(use(
            rng.choice(names),
            x, cy,
            rng.uniform(0, 360),
            rng.uniform(s_lo, s_hi),
            rng.choice(pal),
            None if op is None else rng.uniform(*op),
        ))
    return out


def fill_region(rng, cols, rows, off_lo, off_hi, s_lo, s_hi, palette, accent_rate=0.0):
    """
    Jittered grid covering the body of the pile from just under the crest down
    past the bottom edge. A grid (rather than uniform random) is what guarantees
    no bald patch opens up and exposes the under-mass as bare ground.
    """
    out = []
    names = list(SHAPES.keys())
    stride_x = (W + 260) / cols
    for r in range(rows):
        # every other row offset by half a stride so the grid never lines up
        row_shift = (stride_x * 0.5) if r % 2 else 0.0
        frac_lo = r / rows
        frac_hi = (r + 1) / rows
        for c in range(cols):
            x = -130 + row_shift + stride_x * (c + rng.uniform(-0.42, 0.42))
            top = profile(x)
            lo = off_lo + (off_hi - off_lo) * frac_lo
            hi = off_lo + (off_hi - off_lo) * frac_hi
            cy = top + rng.uniform(lo, hi)
            pal = ACCENT if rng.random() < accent_rate else palette
            out.append(use(
                rng.choice(names), x, cy,
                rng.uniform(0, 360), rng.uniform(s_lo, s_hi),
                rng.choice(pal),
            ))
    return out


def base_path():
    """Under-mass filling the body of the pile, sitting below the leaf crest."""
    step = 20
    pts = [(x, profile(x) + 44) for x in range(0, W + step, step)]
    d = "M0,%d L0,%.1f" % (H, pts[0][1])
    for x, y in pts[1:]:
        d += " L%.1f,%.1f" % (x, y)
    d += " L%d,%d Z" % (W, H)
    return d


def main():
    rng = random.Random(SEED)
    L = []
    L.append('\t\t\t<svg class="sl-pile__svg" viewBox="0 0 %d %d" '
             'preserveAspectRatio="xMidYMax slice" role="presentation" focusable="false">' % (W, H))
    L.append('\t\t\t\t<defs>')
    L.append('\t\t\t\t\t<!-- Leaf artwork. Each is a filled body (coloured by the')
    L.append('\t\t\t\t\t     referencing <use>) plus a fixed dark outline and veins. -->')
    for name, s in SHAPES.items():
        L.append('\t\t\t\t\t<g id="slLeaf-%s">' % name)
        L.append('\t\t\t\t\t\t<path d="%s" %s/>' % (s["d"], OUTLINE))
        L.append('\t\t\t\t\t\t<path d="%s" %s/>' % (s["v"], VEIN))
        L.append('\t\t\t\t\t</g>')
    L.append('\t\t\t\t\t<!-- Pumpkins. Stem first so the body covers its base, then the')
    L.append('\t\t\t\t\t     lobes darkest-outward-in, each stroked so the silhouette and')
    L.append('\t\t\t\t\t     the rib grooves both get an outline. -->')
    for vname, c in PUMPKIN_VARIANTS.items():
        L.append('\t\t\t\t\t<g id="slPumpkin-%s">' % vname)
        for d, col, wdt in PUMPKIN_STEM:
            L.append('\t\t\t\t\t\t<path d="%s" fill="none" stroke="%s" '
                     'stroke-width="%.1f" stroke-linecap="round"/>' % (d, col, wdt))
        for lcx, lrx, lry, tone in PUMPKIN_LOBES:
            L.append('\t\t\t\t\t\t<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" '
                     'fill="%s" stroke="%s" stroke-width="%.1f"/>'
                     % (lcx, PUMPKIN_CY, lrx, lry, c[tone], c["edge"], PUMPKIN_EDGE_WIDTH))
        L.append('\t\t\t\t\t</g>')
    L.append('\t\t\t\t\t<linearGradient id="slPileMass" x1="0" y1="0" x2="0" y2="1">')
    L.append('\t\t\t\t\t\t<stop offset="0%" class="sl-stop sl-stop--mass-top"/>')
    L.append('\t\t\t\t\t\t<stop offset="100%" class="sl-stop sl-stop--mass-bottom"/>')
    L.append('\t\t\t\t\t</linearGradient>')
    L.append('\t\t\t\t</defs>')
    L.append('')
    L.append('\t\t\t\t<!-- Under-mass: the packed interior of the pile. Its edge is')
    L.append('\t\t\t\t     always covered by the back band, so it never reads as a line. -->')
    L.append('\t\t\t\t<path class="sl-pile__mass" fill="url(#slPileMass)" d="%s"/>' % base_path())
    L.append('')
    L.append('\t\t\t\t<!-- Back band: smaller, darker, dense. Forms the ragged crest. -->')
    L.append('\t\t\t\t<g class="sl-pile__band sl-pile__band--back">')
    L += band(rng, 117, -16, 46, 0.52, 0.78, BACK, 0.06)
    L.append('\t\t\t\t</g>')
    L.append('')
    L.append('\t\t\t\t<!-- Body: dense jittered grid, three rows deep. This is what')
    L.append('\t\t\t\t     keeps the under-mass from ever reading as bare ground. -->')
    L.append('\t\t\t\t<g class="sl-pile__band sl-pile__band--body">')
    L += fill_region(rng, 45, 4, 4, 104, 0.65, 1.01, MID, 0.14)
    L.append('\t\t\t\t</g>')
    L.append('')
    L.append('\t\t\t\t<!-- Front band: largest and lightest, catches the light -->')
    L.append('\t\t\t\t<g class="sl-pile__band sl-pile__band--front">')
    L += fill_region(rng, 33, 2, 52, 118, 0.83, 1.25, FRONT, 0.20)
    L.append('\t\t\t\t</g>')
    L.append('')
    L.append('\t\t\t\t<!-- Pumpkins, drawn AFTER the front band.')
    L.append('\t\t\t\t     They were originally behind it, which buried them almost')
    L.append('\t\t\t\t     entirely - the pale one rendered zero visible pixels. The')
    L.append('\t\t\t\t     nestled look now comes from the tuck band below instead of')
    L.append('\t\t\t\t     from stacking order. -->')
    L.append('\t\t\t\t<g class="sl-pile__band sl-pile__band--pumpkins">')
    for px, ps, pr, variant in PUMPKIN_PLACEMENTS:
        L.append(pumpkin(px, pumpkin_cy(px, ps), pr, ps, variant))
    L.append('\t\t\t\t</g>')
    L.append('')
    L.append('\t\t\t\t<!-- Leaves tucked over each pumpkin base, so they sit DOWN IN')
    L.append('\t\t\t\t     the pile rather than resting on top of it. Scaled with the')
    L.append('\t\t\t\t     pumpkin so a big one gets proportionally bigger leaves. -->')
    L.append('\t\t\t\t<g class="sl-pile__band sl-pile__band--tuck">')
    names = list(SHAPES.keys())
    for px, ps, pr, variant in PUMPKIN_PLACEMENTS:
        base = pumpkin_cy(px, ps) + PUMPKIN_BASE_DROP * ps
        # Few, small, and centred ON the base line rather than above it. An
        # earlier version used nine leaves at up to scale 1.02 sitting well
        # above the base, which covered the pumpkins almost entirely - the
        # pale one rendered zero visible pixels.
        for _ in range(5):
            L.append(use(
                rng.choice(names),
                px + rng.uniform(-52, 52) * ps,
                base + rng.uniform(-2, 12) * ps,
                rng.uniform(0, 360),
                rng.uniform(0.48, 0.72),
                rng.choice(FRONT + ACCENT),
            ))
    L.append('\t\t\t\t</g>')

    L.append('')
    L.append('\t\t\t\t<!-- A few just-landed leaves perched proud of the crest -->')
    L.append('\t\t\t\t<g class="sl-pile__band sl-pile__band--crest">')
    L += band(rng, 21, -30, -8, 0.57, 0.83, FRONT, 0.36, op=(0.9, 1.0))
    L.append('\t\t\t\t</g>')
    L.append('\t\t\t</svg>')
    return "\n".join(L)


if __name__ == "__main__":
    print(main())
