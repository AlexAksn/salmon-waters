"""raw/<region>/ (BC WFS downloads, see fetch_raw.sh) -> build/<region>/base.json (vector basemap) + stems.pkl (river
mainstems). Region-specific inputs (bbox, which secondary roads to draw, boundary probes) come from
src/regions/<region>/geo.json.

Usage: python3 scripts/geo.py <region_dir> <raw_dir> <out_dir> [--boundaries]
--boundaries prints the route measures of bridge/rail/creek crossings used as regulation boundaries; the region's
waters.py records those numbers by hand (they only change if DFO moves a boundary or the base data is refreshed).
"""
import collections
import json
import math
import os
import pickle
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geomlib import clip_poly, dist_m, dp, lines_of, polys_of, project, ring_area, rnd  # noqa: E402

REGION, D, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
BOUNDARIES = '--boundaries' in sys.argv
CFG = json.load(open(f'{REGION}/geo.json'))
BB = tuple(CFG['bbox'])  # minx, miny, maxx, maxy: base-layer clip (fetch_raw.sh downloads the same extent); shipped as base.json bbox
os.makedirs(OUT, exist_ok=True)
log = lambda *a: print(*a, file=sys.stderr)
load = lambda n: json.load(open(f'{D}/{n}'))
in_bb = lambda p: BB[0] <= p[0] <= BB[2] and BB[1] <= p[1] <= BB[3]


def clip_line(pts):
    """Pieces of a line inside the bbox (points outside are dropped)."""
    pieces, cur = [], []
    for p in pts:
        if in_bb(p): cur.append(p)
        else:
            if len(cur) > 1: pieces.append(cur)
            cur = []
    if len(cur) > 1: pieces.append(cur)
    return pieces


def simp_polys(features, tol, nd, min_area_deg2=0):
    out = []
    for f in features:
        for poly in polys_of(f['geometry']):
            rings = []
            for ring in poly:
                r = clip_poly([tuple(c[:2]) for c in ring], BB)
                if len(r) < 4 or ring_area(r) < min_area_deg2: continue
                r = rnd(dp(r, tol), nd)
                if len(r) >= 4: rings.append(r)
            if rings and ring_area(rings[0]) >= min_area_deg2: out.append(rings)
    return out


def simp_lines(features, tol, nd, prop=None):
    out = []
    for f in features:
        for line in lines_of(f['geometry']):
            for piece in clip_line([tuple(c[:2]) for c in line]):
                r = rnd(dp(piece, tol), nd)
                if len(r) >= 2: out.append({'c': r, **({'p': prop(f)} if prop else {})})
    return out


# ---------- base layers ----------
coast = load('coast.json')
land = simp_polys([f for f in coast['features'] if f['properties']['QCST_TAG'] in ('MAINLAND', 'ISLAND', 'USA_MNLAND')], 0.0006, 4, min_area_deg2=2e-6)
log('land polys', len(land), sum(len(r) for p in land for r in p))

lake_polys = []
for f in load('lakes.json')['features']:
    for p in simp_polys([f], 0.0004, 4, min_area_deg2=1e-7): lake_polys.append({'r': p, 'n': f['properties']['GNIS_NAME_1']})
log('lakes', len(lake_polys))

river_polys = []
for f in load('rivers_poly.json')['features']:
    if (f['properties']['AREA_HA'] or 0) < 8: continue
    for p in simp_polys([f], 0.0003, 4, min_area_deg2=5e-8): river_polys.append({'r': p, 'n': f['properties']['GNIS_NAME_1']})
log('river polys', len(river_polys))

roads = load('roads.json')
hw = simp_lines(roads['features'], 0.0004, 4, prop=lambda f: (f['properties']['HIGHWAY_ROUTE_NUMBER'] or '', 'f' if f['properties']['ROAD_CLASS'] == 'freeway' else 'h'))
roads2, br = load('roads2.json'), load('bridges_roads.json')
SEC = set(CFG['secondaryRoads'])
seen = set(); sec_feats = []
for f in roads2['features'] + br['features']:
    if f['id'] in seen or f['properties']['ROAD_NAME_FULL'] not in SEC or f['properties']['ROAD_CLASS'] in ('freeway', 'highway'): continue
    seen.add(f['id']); sec_feats.append(f)
sec = simp_lines(sec_feats, 0.0003, 4, prop=lambda f: f['properties']['ROAD_NAME_FULL'])
log('highways', len(hw), 'secondary', len(sec))

rail_feats = load('rail.json')['features']
rail = simp_lines(rail_feats, 0.0004, 4)

# ---------- river mainstems: one blue line per GNIS name, vertices carry route measures ----------
by = collections.defaultdict(list)
for f in load('streams.json')['features']:
    p = f['properties']
    for line in lines_of(f['geometry']):
        by[p['GNIS_NAME']].append((p['DOWNSTREAM_ROUTE_MEASURE'], p['LENGTH_METRE'], [tuple(c[:2]) for c in line]))
mainstem = {}
for name, segs in by.items():
    segs.sort(key=lambda s: s[0])
    pts, meas = [], []
    for m0, L, line in segs:
        tot = sum(dist_m(line[i], line[i + 1]) for i in range(len(line) - 1)) or 1
        acc = 0
        for i, p in enumerate(line):
            if i > 0: acc += dist_m(line[i - 1], p)
            if pts and pts[-1] == p: continue
            pts.append(p); meas.append(m0 + L * acc / tot)
    mainstem[name] = {'pts': pts, 'm': meas}
log('stems', len(mainstem))

json.dump({'bbox': list(BB), 'land': land, 'lakes': lake_polys, 'rivers': river_polys, 'hw': hw, 'sec': sec, 'rail': rail}, open(f'{OUT}/base.json', 'w'), separators=(',', ':'))
pickle.dump({'mainstem': mainstem}, open(f'{OUT}/stems.pkl', 'wb'))
log('base.json bytes', os.path.getsize(f'{OUT}/base.json'))

# ---------- optional: where do roads / rail / creeks cross each stem? (feeds the measures in waters.py) ----------
if BOUNDARIES:
    def crossings(stem_name, feats):
        """Route measures where any feature's line crosses the stem (bbox-prefiltered, exact segment intersection)."""
        s = mainstem[stem_name]; pts, ms = s['pts'], s['m']
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        sb = (min(xs), min(ys), max(xs), max(ys))
        res = []
        for f in feats:
            for line in lines_of(f['geometry']):
                L = [tuple(c[:2]) for c in line]
                if not any(sb[0] <= p[0] <= sb[2] and sb[1] <= p[1] <= sb[3] for p in L): continue
                for i in range(len(L) - 1):
                    a, b = L[i], L[i + 1]
                    for j in range(len(pts) - 1):
                        c, d = pts[j], pts[j + 1]
                        r = (b[0] - a[0], b[1] - a[1]); q = (d[0] - c[0], d[1] - c[1])
                        den = r[0] * q[1] - r[1] * q[0]
                        if den == 0: continue
                        w = (c[0] - a[0], c[1] - a[1])
                        t = (w[0] * q[1] - w[1] * q[0]) / den; u = (w[0] * r[1] - w[1] * r[0]) / den
                        if 0 <= t <= 1 and 0 <= u <= 1: res.append((round(ms[j] + u * (ms[j + 1] - ms[j])), (round(a[0] + t * r[0], 4), round(a[1] + t * r[1], 4))))
        return sorted(res)

    allroads = {f['id']: f for f in br['features'] + roads2['features'] + roads['features']}.values()
    byname = collections.defaultdict(list)
    for f in allroads: byname[f['properties']['ROAD_NAME_FULL']].append(f)
    for stem, road in CFG['probes']['crossings']:
        print('X', stem, 'x', road, crossings(stem, byname.get(road, [])))
    for stem in CFG['probes']['rail']: print('X', stem, 'x rail', crossings(stem, rail_feats))
    for stem, trib in CFG['probes']['confluences']:
        m, _, d = project(mainstem[stem], mainstem[trib]['pts'][0]); print('CONFLUENCE', trib, 'on', stem, 'm', round(m), 'd', round(d))
    for name, lon, lat in CFG['probes']['points']:
        p = (lon, lat)
        m, q, d = project(mainstem[name], p); print('PT', name, 'm', round(m), 'd', round(d), 'ends', round(mainstem[name]['m'][0]), round(mainstem[name]['m'][-1]))
