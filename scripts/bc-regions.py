"""BC wildlife management units (WFS GeoJSON) -> public/data/bc-regions.json: one simplified outline per freshwater
fishing region (1-8), dissolved topologically so neighbours share identical borders (no slivers after simplification).

Usage: python3 scripts/bc-regions.py <mu.json> <out.json> [tolerance_deg=0.02]
Dissolve: every ring edge is keyed by its rounded endpoints; an edge used by two units of the same region is interior
and dropped; what remains is grouped by the set of regions touching it, chained into polylines, simplified once, and
re-assembled into rings per region.
"""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geomlib import dp, polys_of, rnd  # noqa: E402

SRC, OUT = sys.argv[1], sys.argv[2]
TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.02
REGIONS = range(1, 9)
R = lambda c: (round(c[0], 5), round(c[1], 5))
E = lambda a, b: (a, b) if a < b else (b, a)  # edge key: endpoints in a fixed order

# 1. edges -> regions using them (a region can use an edge twice: two of its units share it)
uses = collections.defaultdict(list)
for f in json.load(open(SRC))['features']:
    reg = int(str(f['properties']['WILDLIFE_MGMT_UNIT_ID']).split('-')[0])
    for poly in polys_of(f['geometry']):
        for ring in poly:
            pts = [R(c) for c in ring]
            for a, b in zip(pts, pts[1:]):
                if a != b: uses[E(a, b)].append(reg)
print('edges', len(uses), file=sys.stderr)

# 2. boundary edges, grouped by the set of regions on either side
groups = collections.defaultdict(list)
for (a, b), regs in uses.items():
    key = tuple(sorted(set(regs)))
    if len(regs) == 2 and len(key) == 1: continue  # interior to one region
    groups[key].append((a, b))
print('boundary groups', {k: len(v) for k, v in groups.items()}, file=sys.stderr)

# 3. chain each group's edges into polylines, simplify each chain once
def chains(edges):
    adj = collections.defaultdict(list)
    for a, b in edges: adj[a].append(b); adj[b].append(a)
    left = set(edges); out = []
    def take(a, b):
        e = E(a, b)
        if e in left: left.remove(e); return True
        return False
    starts = sorted(adj, key=lambda p: len(adj[p]) == 2)  # junctions (degree != 2) first so chains end at junctions; loops last
    for s in starts:
        for nb in list(adj[s]):
            if not take(s, nb): continue
            line = [s, nb]; cur, prev = nb, s
            while len(adj[cur]) == 2 and cur != s:
                nxt = adj[cur][0] if adj[cur][0] != prev else adj[cur][1]
                if not take(cur, nxt): break
                line.append(nxt); prev, cur = cur, nxt
            out.append(line)
    assert not left, f'{len(left)} edges unchained'
    return out
simplified = {}  # key -> list of simplified chains
for key, edges in groups.items():
    simplified[key] = [dp(c, TOL) if len(c) > 2 else c for c in chains(edges)]

# 4. per region, assemble its chains into rings
regions = {}
for reg in REGIONS:
    segs = [c for key, cs in simplified.items() if reg in key for c in cs]
    adj = collections.defaultdict(list)
    for i, c in enumerate(segs): adj[c[0]].append(i); adj[c[-1]].append(i)
    used = [False] * len(segs); rings = []
    for i in range(len(segs)):
        if used[i]: continue
        used[i] = True; ring = list(segs[i])
        while ring[0] != ring[-1]:
            end = ring[-1]; nxt = [j for j in adj[end] if not used[j]]
            if not nxt: break  # a dangling spur (two vertices a rounding step apart on a self-touching unit); dropped below
            j = nxt[0]; used[j] = True; c = segs[j]
            ring += (c[1:] if c[0] == end else c[-2::-1])
        rings.append(ring)
    rings.sort(key=lambda r: -len(r))
    regions[reg] = [rnd(r, 4) for r in rings if len(r) >= 4 and r[0] == r[-1]]
    print(f'region {reg}: {len(regions[reg])} rings, {sum(len(r) for r in regions[reg])} pts', file=sys.stderr)
json.dump({'regions': [{'num': n, 'rings': regions[n]} for n in REGIONS]}, open(OUT, 'w'), separators=(',', ':'))
print('wrote', OUT, os.path.getsize(OUT), 'bytes', file=sys.stderr)
