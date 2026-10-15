"""build/stems.pkl -> build/waters.json: one centreline slice per regulated stretch + boundary markers.

Route measures (metres from the mouth along the FWA blue line) come from `geo.py --boundaries`; approximate ones were
placed from the DFO prose. Usage: python3 scripts/waters.py
"""
import json
import os
import pickle
import sys

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(R, 'scripts'))
from geomlib import at_measure, slice_stem  # noqa: E402

ms = pickle.load(open(f'{R}/build/stems.pkl', 'rb'))['mainstem']
sl = lambda name, m0=None, m1=None, tol=0.00006: slice_stem(ms[name], m0, m1, tol)
END = lambda n: ms[n]['m'][-1]

G = {}
G['alouette-upper'] = [sl('Alouette River', 9038, 18600)]
G['alouette-lower'] = [sl('Alouette River', 0, 9038)]
G['north-alouette'] = [sl('North Alouette River')]
G['ashlu'] = [sl('Ashlu Creek')]
G['capilano'] = [sl('Capilano River', 0, 6078)]
G['chapman'] = [sl('Chapman Creek', 178, 2700)]
G['cheakamus'] = [sl('Cheakamus River', 0, 26187)]
G['chehalis'] = [sl('Chehalis River', 0, 18577)]
G['chilliwack'] = [sl('Chilliwack River', 0, 23326), sl('Vedder River'), sl('Sumas River', 0, 5900)]
G['coquitlam'] = [sl('Coquitlam River', 0, 18347)]
G['deboville'] = [sl('De Boville Slough')]
G['fraser-upper'] = [sl('Fraser River', 76505, None, 0.0002)]
G['fraser-tidal'] = [sl('Fraser River', 0, 76505, 0.0002)]
G['harrison-upper'] = [sl('Harrison River', 6062, None)]
G['harrison-lower'] = [sl('Harrison River', 0, 6062)]
G['kanaka'] = [sl('Kanaka Creek', 0, 7198)]
G['lcr'] = [sl('Little Campbell River', 773, 7475)]
G['lcr-mouth'] = [sl('Little Campbell River', 0, 773)]
G['mamquam'] = [sl('Mamquam River')]
G['nicomekl'] = [sl('Nicomekl River', 0, 24232)]
G['nicomen'] = [sl('Nicomen Slough')]
G['norrish'] = [sl('Norrish Creek', 0, 12000)]
G['serpentine'] = [sl('Serpentine River', 0, 17100)]
G['squamish'] = [sl('Squamish River')]
G['stave'] = [sl('Stave River', 386, 3491)]
# unlisted context rivers (thin grey)
for key, name, m0, m1 in [('u-pitt', 'Pitt River', 0, None), ('u-lillooet', 'Lillooet River', 0, None), ('u-seymour', 'Seymour River', 0, None), ('u-indian', 'Indian River', 0, None), ('u-lynn', 'Lynn Creek', 0, None), ('u-coquihalla', 'Coquihalla River', 0, None), ('u-silverhope', 'Silverhope Creek', 0, None), ('u-salmon', 'Salmon River', 0, None), ('u-brunette', 'Brunette River', 0, None), ('u-lois', 'Lois River', 0, None), ('u-powell', 'Powell River', 0, None), ('u-elaho', 'Elaho River', 0, None), ('u-alouette-above', 'Alouette River', 18600, 24964), ('u-chilliwack-above', 'Chilliwack River', 23326, None), ('u-chehalis-above', 'Chehalis River', 18577, 20977), ('u-cheakamus-above', 'Cheakamus River', 26187, None), ('u-kanaka-above', 'Kanaka Creek', 7198, None), ('u-nicomekl-above', 'Nicomekl River', 24232, None), ('u-serpentine-above', 'Serpentine River', 17100, None), ('u-lcr-above', 'Little Campbell River', 7475, None), ('u-sumas-above', 'Sumas River', 5900, None), ('u-norrish-above', 'Norrish Creek', 12000, None), ('u-stave-above', 'Stave River', 3491, None), ('u-slesse', 'Slesse Creek', 0, None)]:
    G[key] = [sl(name, m0, m1, 0.0001)]

M = []
def mk(label, name, m, kind='b', approx=False):
    p = at_measure(ms[name], m); M.append({'l': label, 'c': [round(p[0], 5), round(p[1], 5)], 'k': kind, 'a': approx})
mk('216 St bridge', 'Alouette River', 9038)
mk('Allco Park boundary signs', 'Alouette River', 18600, approx=True)
mk('Hwy 7 bridge (Harrison Mills)', 'Harrison River', 6062)
mk('Harrison Lake outlet', 'Harrison River', END('Harrison River'))
mk('CPR bridge, Mission', 'Fraser River', 76505)
mk('112 Ave bridge', 'Kanaka Creek', 7198)
mk('208 St', 'Nicomekl River', 24232)
mk('168 St (Bothwell Park)', 'Serpentine River', 17100)
mk('12 Ave', 'Little Campbell River', 7475)
mk('Stayte Rd footbridge', 'Little Campbell River', 773)
mk('Hwy 101 bridge (tidal boundary signs)', 'Chapman Creek', 178)
mk('100 m below the falls', 'Chapman Creek', 2700, approx=True)
mk('Logging bridge, 2.4 km below Chehalis Lake', 'Chehalis River', 18577, approx=True)
mk('100 m below Slesse Creek', 'Chilliwack River', 23326)
mk('Barrowtown Pump Station', 'Sumas River', 5900, approx=True)
mk('Ruskin Dam', 'Stave River', 3491)
mk('CPR bridge', 'Stave River', 386)
mk('Cleveland Dam', 'Capilano River', 6078, 'i')
mk('Coquitlam Dam', 'Coquitlam River', 18347, 'i')
mk('Cedar Creek / Hyde Creek confluence', 'De Boville Slough', END('De Boville Slough'), approx=True)
mk('Siddle (Bell’s) Creek confluence', 'Nicomen Slough', END('Nicomen Slough'), approx=True)
mk('Daisy Lake dam', 'Cheakamus River', 26187, 'i')
json.dump({'geo': G, 'marks': M}, open(f'{R}/build/waters.json', 'w'), separators=(',', ':'))
print('waters.json', os.path.getsize(f'{R}/build/waters.json'), 'bytes;', len(G), 'waters,', len(M), 'marks')
