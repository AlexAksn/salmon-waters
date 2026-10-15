"""Shared geometry helpers for geo.py and waters.py (lon/lat tuples, metres via local scale)."""
import math


def dist_m(a, b):
    kx = 111320 * math.cos(math.radians((a[1] + b[1]) / 2)); ky = 110540
    return math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * ky)


def closest_on_seg(p, a, b):
    """Clamped projection of p onto segment ab -> (t in [0,1], point)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    if dx == 0 and dy == 0: return 0.0, a
    t = max(0.0, min(1.0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return t, (a[0] + t * dx, a[1] + t * dy)


def dp(pts, tol):
    """Douglas-Peucker simplification (iterative)."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]; t2 = tol * tol
    while stack:
        i, j = stack.pop()
        if j <= i + 1: continue
        md = -1; mi = -1
        for k in range(i + 1, j):
            _, q = closest_on_seg(pts[k], pts[i], pts[j])
            dd = (pts[k][0] - q[0]) ** 2 + (pts[k][1] - q[1]) ** 2
            if dd > md: md = dd; mi = k
        if md > t2: keep[mi] = True; stack += [(i, mi), (mi, j)]
    return [p for p, k in zip(pts, keep) if k]


def rnd(pts, nd):
    """Round coordinates and drop consecutive duplicates; returns [lon, lat] lists (JSON-ready)."""
    out = []; last = None
    for p in pts:
        q = [round(p[0], nd), round(p[1], nd)]
        if q != last: out.append(q)
        last = q
    return out


def clip_poly(ring, bb):
    """Sutherland-Hodgman clip of a ring against bbox (minx, miny, maxx, maxy)."""
    minx, miny, maxx, maxy = bb

    def clip_edge(poly, inside, inter):
        out = []
        if not poly: return out
        prev = poly[-1]
        for cur in poly:
            if inside(cur):
                if not inside(prev): out.append(inter(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev, cur))
            prev = cur
        return out

    def ix(p, q, x): t = (x - p[0]) / (q[0] - p[0]); return (x, p[1] + t * (q[1] - p[1]))
    def iy(p, q, y): t = (y - p[1]) / (q[1] - p[1]); return (p[0] + t * (q[0] - p[0]), y)
    r = clip_edge(ring, lambda p: p[0] >= minx, lambda p, q: ix(p, q, minx))
    r = clip_edge(r, lambda p: p[0] <= maxx, lambda p, q: ix(p, q, maxx))
    r = clip_edge(r, lambda p: p[1] >= miny, lambda p, q: iy(p, q, miny))
    return clip_edge(r, lambda p: p[1] <= maxy, lambda p, q: iy(p, q, maxy))


def ring_area(r):
    a = 0
    for i in range(len(r)):
        x1, y1 = r[i]; x2, y2 = r[(i + 1) % len(r)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def polys_of(geom):
    if geom is None: return []
    if geom['type'] == 'Polygon': return [geom['coordinates']]
    if geom['type'] == 'MultiPolygon': return geom['coordinates']
    return []


def lines_of(geom):
    if geom is None: return []
    if geom['type'] == 'LineString': return [geom['coordinates']]
    if geom['type'] == 'MultiLineString': return geom['coordinates']
    return []


# ---- stems: a mainstem is {'pts': [(lon,lat)...], 'm': [route measure in m per vertex]} ----
def at_measure(stem, m):
    pts, ms = stem['pts'], stem['m']
    if m <= ms[0]: return pts[0]
    for i in range(len(pts) - 1):
        if ms[i] <= m <= ms[i + 1]:
            t = (m - ms[i]) / ((ms[i + 1] - ms[i]) or 1); a, b = pts[i], pts[i + 1]
            return (a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))
    return pts[-1]


def slice_stem(stem, m0=None, m1=None, tol=0.00006, nd=5):
    """Vertices between measures m0..m1 (defaults: whole stem), simplified and rounded."""
    pts, ms = stem['pts'], stem['m']
    lo = ms[0] if m0 is None else m0; hi = ms[-1] if m1 is None else m1
    out = [at_measure(stem, lo)] if lo > ms[0] else []
    out += [p for p, m in zip(pts, ms) if lo <= m <= hi]
    if hi < ms[-1]: out.append(at_measure(stem, hi))
    return rnd(dp(out, tol), nd)


def project(stem, p):
    """Nearest point on the stem to p -> (measure, snapped point, distance in m)."""
    pts, ms = stem['pts'], stem['m']; best = (1e18, None, None)
    for i in range(len(pts) - 1):
        t, q = closest_on_seg(p, pts[i], pts[i + 1])
        d = dist_m(p, q)
        if d < best[0]: best = (d, ms[i] + t * (ms[i + 1] - ms[i]), q)
    return best[1], best[2], best[0]
