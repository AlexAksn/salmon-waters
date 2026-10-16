"""Region 1: build/r1/stems.pkl -> build/r1/waters.json, one centreline slice per regulated stretch + boundary markers.

Route measures (metres from the mouth along the FWA blue line) come from `geo.py --boundaries` and the crossing scan;
ones marked approx were placed from the DFO prose. Usage: python3 src/regions/r1/waters.py <build_dir>   (scripts/build-geo.sh runs it)
"""
import json
import os
import pickle
import sys

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, os.path.join(R, 'scripts'))
from geomlib import at_measure, slice_stem  # noqa: E402
BUILD = sys.argv[1] if len(sys.argv) > 1 else os.path.join(R, 'build', 'r1')

ms = pickle.load(open(f'{BUILD}/stems.pkl', 'rb'))['mainstem']
sl = lambda name, m0=None, m1=None, tol=0.00006: slice_stem(ms[name], m0, m1, tol)

# Measures (m from the mouth). Exact ones come from crossings/confluences in the atlas; APPROX ones from DFO's prose.
CAMPBELL_QUINSAM, CAMPBELL_MAPLE, CAMPBELL_JOHNHART = 4199, 1500, 8504           # Maple St approx; John Hart Lake entry
COWICHAN_TIDAL, COWICHAN_SANDY, COWICHAN_TRESTLE = 1500, 9500, 34000              # all approx
NANAIMO_CEDAR, NANAIMO_HWY19, NANAIMO_HWY1, NANAIMO_BOREHOLE, NANAIMO_BOULDER = 2979, 3240, 10451, 19500, 22348  # Bore Hole approx
LQ_FENCE, LQ_FALLS = 3000, 15500                                                  # approx
BQ_19A, BQ_QFN, BQ_WEIR, BQ_HORNE = 400, 1000, 1372, 12450                        # 19A + QFN approx; weir = E&N bridge (1497) - 125 m
PUNT_STOTAN, PUNT_MORRISON, PUNT_COMOX = 10000, 2313, 14788                       # Stotan approx
SOMASS_PM0, SOMASS_PM1, SOMASS_PARK0, SOMASS_PARK1, SOMASS_TOP = 3800, 4300, 5800, 6800, 9342  # reaches approx
SPROAT_POOL, SPROAT_LAKE = 1444, 2744                                             # pool approx
STAMP_GGF, STAMP_FISHWAY, STAMP_ASH, STAMP_GCL = 4012, 6428, 14509, 20232         # GGF = Beaver Creek (3737) + 275 m
NITINAT_LAKE, NITINAT_LITTLE, NITINAT_PARKER = 23307, 29704, 40925
SANJUAN_FLEET = 30015

G = {}
G['adam-eve'] = [sl('Adam River'), sl('Eve River')]
G['campbell'] = [sl('Campbell River', CAMPBELL_MAPLE, CAMPBELL_QUINSAM)]
G['campbell-mouth'] = [sl('Campbell River', 0, CAMPBELL_MAPLE)]
G['cayeghle'] = [sl('Cayeghle Creek'), sl('Colonial Creek')]
G['chemainus'] = [sl('Chemainus River')]
G['cluxewe'] = [sl('Cluxewe River')]
G['conuma'] = [sl('Conuma River')]
G['courtenay'] = [sl('Courtenay River')]
G['cowichan-upper'] = [sl('Cowichan River', COWICHAN_SANDY, COWICHAN_TRESTLE)]
G['cowichan-lower'] = [sl('Cowichan River', COWICHAN_TIDAL, COWICHAN_SANDY)]
G['goldstream'] = [sl('Goldstream River')]
G['koksilah'] = [sl('Koksilah River')]
G['little-qualicum'] = [sl('Little Qualicum River', 0, LQ_FENCE)]
G['little-qualicum-upper'] = [sl('Little Qualicum River', LQ_FENCE, LQ_FALLS)]
G['nahwitti'] = [sl('Nahwitti River')]
G['nanaimo-tidal'] = [sl('Nanaimo River', 0, NANAIMO_CEDAR)]
G['nanaimo-lower'] = [sl('Nanaimo River', NANAIMO_CEDAR, NANAIMO_HWY1)]
G['nanaimo-upper'] = [sl('Nanaimo River', NANAIMO_HWY1, NANAIMO_BOREHOLE)]
G['nanaimo-canyon'] = [sl('Nanaimo River', NANAIMO_BOREHOLE, NANAIMO_BOULDER)]
G['nanaimo-above'] = [sl('Nanaimo River', NANAIMO_BOULDER, None)]
G['nitinat'] = [sl('Nitinat River', NITINAT_LAKE, NITINAT_PARKER)]
G['nitinat-upper'] = [sl('Nitinat River', NITINAT_PARKER, None)]
G['puntledge'] = [sl('Puntledge River', 0, PUNT_STOTAN)]
G['qualicum-upper'] = [sl('Qualicum River', BQ_WEIR, BQ_HORNE)]
G['qualicum-hatchery'] = [sl('Qualicum River', BQ_QFN, BQ_WEIR)]
G['qualicum-lower'] = [sl('Qualicum River', BQ_19A, BQ_QFN)]
G['quatse'] = [sl('Quatse River')]
G['quinsam'] = [sl('Quinsam River', 0, 27440)]  # to Quinsam Lake
G['reay'] = [sl('Reay Creek')]
G['san-juan'] = [sl('San Juan River', 0, SANJUAN_FLEET)]
G['seymour-inlet'] = [sl('Seymour River')]
G['shawnigan'] = [sl('Shawnigan Creek')]
G['somass'] = [sl('Somass River', 0, SOMASS_PM0), sl('Somass River', SOMASS_PM1, SOMASS_PARK0), sl('Somass River', SOMASS_PARK1, SOMASS_TOP)]
G['somass-park'] = [sl('Somass River', SOMASS_PARK0, SOMASS_PARK1)]
G['somass-papermill'] = [sl('Somass River', SOMASS_PM0, SOMASS_PM1)]
G['sproat'] = [sl('Sproat River', 0, SPROAT_POOL)]
G['sproat-upper'] = [sl('Sproat River', SPROAT_POOL, SPROAT_LAKE)]
G['stamp-upper'] = [sl('Stamp River', STAMP_ASH, STAMP_GCL)]
G['stamp'] = [sl('Stamp River', STAMP_GGF, STAMP_ASH)]
G['stamp-lower'] = [sl('Stamp River', 0, STAMP_GGF)]
G['washlawlis'] = [sl('Washlawlis Creek')]
G['waukwaas'] = [sl('Waukwaas Creek')]
# unlisted context rivers (thin grey)
for key, name, m0, m1 in [('u-englishman', 'Englishman River', 0, None), ('u-oyster', 'Oyster River', 0, None), ('u-salmon-sayward', 'Salmon River', 0, None), ('u-nimpkish', 'Nimpkish River', 0, None),
                          ('u-gold', 'Gold River', 0, None), ('u-sooke', 'Sooke River', 0, None), ('u-sarita', 'Sarita River', 0, None), ('u-tsolum', 'Tsolum River', 0, None), ('u-marble', 'Marble River', 0, None),
                          ('u-keogh', 'Keogh River', 0, None), ('u-zeballos', 'Zeballos River', 0, None), ('u-tsitika', 'Tsitika River', 0, None), ('u-kokish', 'Kokish River', 0, None), ('u-browns', 'Browns River', 0, None),
                          ('u-cowichan-above', 'Cowichan River', COWICHAN_TRESTLE, None), ('u-campbell-above', 'Campbell River', CAMPBELL_QUINSAM, CAMPBELL_JOHNHART), ('u-puntledge-above', 'Puntledge River', PUNT_STOTAN, PUNT_COMOX),
                          ('u-little-qualicum-above', 'Little Qualicum River', LQ_FALLS, None), ('u-san-juan-above', 'San Juan River', SANJUAN_FLEET, None)]:
    G[key] = [sl(name, m0, m1, 0.0001)]

M = []
def mk(label, name, m, kind='b', approx=False):
    p = at_measure(ms[name], m); M.append({'l': label, 'c': [round(p[0], 5), round(p[1], 5)], 'k': kind, 'a': approx})
mk('Quinsam River confluence', 'Campbell River', CAMPBELL_QUINSAM)
mk('Maple St boundary sign', 'Campbell River', CAMPBELL_MAPLE, approx=True)
mk('John Hart dam', 'Campbell River', CAMPBELL_JOHNHART, 'i', approx=True)
mk('Tidal boundary', 'Cowichan River', COWICHAN_TIDAL, approx=True)
mk('Sandy Pool Regional Park sign', 'Cowichan River', COWICHAN_SANDY, approx=True)
mk('66 Mile Trestle', 'Cowichan River', COWICHAN_TRESTLE, approx=True)
mk('Cedar Rd bridge', 'Nanaimo River', NANAIMO_CEDAR)
mk('Hwy 19 (Nanaimo Parkway) bridge', 'Nanaimo River', NANAIMO_HWY19, 'i')
mk('Hwy 1 overpass, Cassidy', 'Nanaimo River', NANAIMO_HWY1)
mk('Bore Hole (500 m below the lower power line)', 'Nanaimo River', NANAIMO_BOREHOLE, approx=True)
mk('Boulder Creek mouth', 'Nanaimo River', NANAIMO_BOULDER)
mk('Hatchery fence', 'Little Qualicum River', LQ_FENCE, approx=True)
mk('Little Qualicum Falls', 'Little Qualicum River', LQ_FALLS, approx=True)
mk('Hwy 19A bridge', 'Qualicum River', BQ_19A, approx=True)
mk('QFN boundary fence', 'Qualicum River', BQ_QFN, approx=True)
mk('Hatchery upper weir (125 m below the E&N bridge)', 'Qualicum River', BQ_WEIR)
mk('Stotan Falls', 'Puntledge River', PUNT_STOTAN, approx=True)
mk('Morrison Creek confluence (closed 100 m each way)', 'Puntledge River', PUNT_MORRISON, 'i')
mk('Puntledge / Tsolum confluence', 'Courtenay River', 2522, 'i')
mk('Paper Mill Dam tidal boundary signs', 'Somass River', SOMASS_PM0, approx=True)
mk('Collins Farm NE corner', 'Somass River', SOMASS_PM1, approx=True)
mk('Somass Park south boundary', 'Somass River', SOMASS_PARK0, approx=True)
mk('Somass Park north boundary', 'Somass River', SOMASS_PARK1, approx=True)
mk('Stamp / Sproat junction', 'Somass River', SOMASS_TOP, 'i')
mk('Pool 300 m below the Hwy 4 bridge', 'Sproat River', SPROAT_POOL, approx=True)
mk('Sproat Lake outlet', 'Sproat River', SPROAT_LAKE, 'i')
mk('Girl Guide Falls (275 m above Beaver Creek)', 'Stamp River', STAMP_GGF, approx=True)
mk('Stamp Falls fishway', 'Stamp River', STAMP_FISHWAY, 'i', approx=True)
mk('Ash River confluence', 'Stamp River', STAMP_ASH)
mk('Great Central Lake dam', 'Stamp River', STAMP_GCL, 'i')
mk('Nitinat Lake head', 'Nitinat River', NITINAT_LAKE, 'i')
mk('Little Nitinat River confluence (hatchery closure below the powerline)', 'Nitinat River', NITINAT_LITTLE, 'i')
mk('Parker Creek', 'Nitinat River', NITINAT_PARKER)
mk('Fleet River confluence', 'San Juan River', SANJUAN_FLEET)
json.dump({'geo': G, 'marks': M}, open(f'{BUILD}/waters.json', 'w'), separators=(',', ':'))
print('waters.json', os.path.getsize(f'{BUILD}/waters.json'), 'bytes;', len(G), 'waters,', len(M), 'marks')
