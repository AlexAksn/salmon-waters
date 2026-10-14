import json, math, sys, collections
D = sys.argv[1]  # data dir
OUT = sys.argv[2]
BB = (-125.6, 48.2, -120.6, 50.8)  # minx,miny,maxx,maxy (base layers clip; must match fetch_raw.sh)

def load(n):
    return json.load(open(f'{D}/{n}'))

# ---------- geometry helpers ----------
def dp(pts, tol):
    """Douglas-Peucker on list of (x,y)."""
    if len(pts) < 3: return pts
    def d2(p, a, b):
        ax, ay = a; bx, by = b; px, py = p
        dx, dy = bx-ax, by-ay
        if dx == 0 and dy == 0: return (px-ax)**2+(py-ay)**2
        t = max(0, min(1, ((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy)))
        qx, qy = ax+t*dx, ay+t*dy
        return (px-qx)**2+(py-qy)**2
    keep = [False]*len(pts); keep[0]=keep[-1]=True
    stack=[(0,len(pts)-1)]; t2=tol*tol
    while stack:
        i,j=stack.pop()
        if j<=i+1: continue
        md=-1; mi=-1
        a=pts[i]; b=pts[j]
        for k in range(i+1,j):
            dd=d2(pts[k],a,b)
            if dd>md: md=dd; mi=k
        if md>t2:
            keep[mi]=True; stack.append((i,mi)); stack.append((mi,j))
    return [p for p,k in zip(pts,keep) if k]

def clip_poly(ring, bb):
    """Sutherland-Hodgman clip ring against bbox."""
    minx,miny,maxx,maxy=bb
    def clip_edge(poly, inside, inter):
        out=[]
        if not poly: return out
        prev=poly[-1]
        for cur in poly:
            if inside(cur):
                if not inside(prev): out.append(inter(prev,cur))
                out.append(cur)
            elif inside(prev):
                out.append(inter(prev,cur))
            prev=cur
        return out
    def ix(p,q,x):
        t=(x-p[0])/(q[0]-p[0]); return (x, p[1]+t*(q[1]-p[1]))
    def iy(p,q,y):
        t=(y-p[1])/(q[1]-p[1]); return (p[0]+t*(q[0]-p[0]), y)
    r=ring
    r=clip_edge(r, lambda p:p[0]>=minx, lambda p,q:ix(p,q,minx))
    r=clip_edge(r, lambda p:p[0]<=maxx, lambda p,q:ix(p,q,maxx))
    r=clip_edge(r, lambda p:p[1]>=miny, lambda p,q:iy(p,q,miny))
    r=clip_edge(r, lambda p:p[1]<=maxy, lambda p,q:iy(p,q,maxy))
    return r

def ring_area(r):
    a=0
    for i in range(len(r)):
        x1,y1=r[i]; x2,y2=r[(i+1)%len(r)]
        a+=x1*y2-x2*y1
    return abs(a)/2

def polys_of(geom):
    if geom is None: return []
    if geom['type']=='Polygon': return [geom['coordinates']]
    if geom['type']=='MultiPolygon': return geom['coordinates']
    return []

def lines_of(geom):
    if geom is None: return []
    if geom['type']=='LineString': return [geom['coordinates']]
    if geom['type']=='MultiLineString': return geom['coordinates']
    return []

def rnd(pts, nd):
    out=[]; last=None
    for p in pts:
        q=(round(p[0],nd), round(p[1],nd))
        if q!=last: out.append(q)
        last=q
    return out

def in_bb(p, bb=BB):
    return bb[0]<=p[0]<=bb[2] and bb[1]<=p[1]<=bb[3]

def clip_line(pts, bb=BB):
    """split line into pieces inside bbox (simple: drop outside points)."""
    pieces=[]; cur=[]
    for p in pts:
        if in_bb(p): cur.append(p)
        else:
            if len(cur)>1: pieces.append(cur)
            cur=[]
    if len(cur)>1: pieces.append(cur)
    return pieces

def simp_polys(features, tol, nd, min_area_deg2=0, clip=True):
    out=[]
    for f in features:
        for poly in polys_of(f['geometry']):
            rings=[]
            for i,ring in enumerate(poly):
                r=[tuple(c[:2]) for c in ring]
                if clip: r=clip_poly(r, BB)
                if len(r)<4: continue
                if ring_area(r)<min_area_deg2: continue
                r=dp(r, tol); r=rnd(r, nd)
                if len(r)>=4: rings.append(r)
            if rings and ring_area(rings[0])>=min_area_deg2:
                out.append(rings)
    return out

def simp_lines(features, tol, nd, prop=None):
    out=[]
    for f in features:
        for line in lines_of(f['geometry']):
            for piece in clip_line([tuple(c[:2]) for c in line]):
                r=rnd(dp(piece, tol), nd)
                if len(r)>=2:
                    out.append({'c':r, **({'p':prop(f)} if prop else {})})
    return out

# ---------- land ----------
coast=load('coast.json')
land_feats=[f for f in coast['features'] if f['properties']['QCST_TAG'] in ('MAINLAND','ISLAND','USA_MNLAND')]
land=simp_polys(land_feats, 0.0006, 4, min_area_deg2=2e-6)
print('land polys', len(land), sum(len(r) for p in land for r in p), file=sys.stderr)

# ---------- lakes ----------
lakes=load('lakes.json')
lake_polys=[]
for f in lakes['features']:
    ps=simp_polys([f], 0.0004, 4, min_area_deg2=1e-7)
    for p in ps: lake_polys.append({'r':p,'n':f['properties']['GNIS_NAME_1']})
print('lakes', len(lake_polys), sum(len(r) for p in lake_polys for r in p['r']), file=sys.stderr)

# ---------- river polygons ----------
rp=load('rivers_poly.json')
river_polys=[]
for f in rp['features']:
    a=f['properties']['AREA_HA'] or 0
    if a<8: continue
    ps=simp_polys([f], 0.0003, 4, min_area_deg2=5e-8)
    for p in ps: river_polys.append({'r':p,'n':f['properties']['GNIS_NAME_1']})
print('river polys', len(river_polys), sum(len(r) for p in river_polys for r in p['r']), file=sys.stderr)

# ---------- roads ----------
roads=load('roads.json')
hw=simp_lines(roads['features'], 0.0004, 4, prop=lambda f:(f['properties']['HIGHWAY_ROUTE_NUMBER'] or '', 'f' if f['properties']['ROAD_CLASS']=='freeway' else 'h'))
print('highways', len(hw), sum(len(l['c']) for l in hw), file=sys.stderr)
roads2=load('roads2.json')
keep2={'Chilliwack Lake Rd','Vedder Rd','Keith Wilson Rd','No 3 Rd','Morris Valley Rd','Chehalis FSR','Squamish Valley Rd','Government Rd','Paradise Valley Rd','Dewdney Trunk Rd','Stave Lake St','Hayward St','Wilson Rd','232 St','240 St','Dixon Rd','Nicomen Island Trunk Rd','Capilano Rd','Lillooet Rd','Marine Dr','King George Blvd','Coast Meridian Rd','Shaughnessy St','Pipeline Rd','Field Rd','Brooks Rd','Stave Lake Rd','Vedder Mountain Rd','Sumas Prairie Rd','Mamquam Rd','Cedar Dr','Victoria Dr','Crown St','Horne St','Railway Ave','Riverside St','Fern Cres','Alouette Rd','Dollarton Hwy','Hurd St','Oyama St'}
sec=simp_lines([f for f in roads2['features'] if f['properties']['ROAD_NAME_FULL'] in keep2 and f['properties']['ROAD_CLASS'] not in ('freeway','highway')], 0.0003, 4, prop=lambda f:f['properties']['ROAD_NAME_FULL'])
br=load('bridges_roads.json')
keep3={'216 St','208 St','168 St','12 Ave','112 Ave','Stayte Rd','Kanaka Way','Lougheed Hwy'}
sec+=simp_lines([f for f in br['features'] if f['properties']['ROAD_NAME_FULL'] in keep3 and f['properties']['ROAD_CLASS'] not in ('freeway','highway')], 0.0003, 4, prop=lambda f:f['properties']['ROAD_NAME_FULL'])
print('secondary', len(sec), sum(len(l['c']) for l in sec), file=sys.stderr)

# ---------- rail ----------
rail=[]
try:
    rl=load('rail.json')
    rail=simp_lines(rl['features'], 0.0004, 4)
except Exception as e:
    print('rail skipped', e, file=sys.stderr)

# ---------- streams: build mainstems ----------
st=load('streams.json')
by=collections.defaultdict(list)
for f in st['features']:
    p=f['properties']
    for line in lines_of(f['geometry']):
        by[p['GNIS_NAME']].append((p['DOWNSTREAM_ROUTE_MEASURE'], p['LENGTH_METRE'], [tuple(c[:2]) for c in line]))
mainstem={}
for name, segs in by.items():
    segs.sort(key=lambda s:s[0])
    pts=[]; meas=[]  # cumulative measure per vertex (m)
    for m0, L, line in segs:
        # per-vertex measure: interpolate by geodesic-ish length
        def dist(a,b):
            kx=111320*math.cos(math.radians((a[1]+b[1])/2)); ky=110540
            return math.hypot((b[0]-a[0])*kx,(b[1]-a[1])*ky)
        tot=sum(dist(line[i],line[i+1]) for i in range(len(line)-1)) or 1
        acc=0
        for i,p in enumerate(line):
            if i>0: acc+=dist(line[i-1],p)
            m=m0+L*acc/tot
            if pts and pts[-1]==p: continue
            pts.append(p); meas.append(m)
    mainstem[name]={'pts':pts,'m':meas}
    print('stem',name,len(pts),round(meas[0]),round(meas[-1]), file=sys.stderr)

def dist_m(a,b):
    kx=111320*math.cos(math.radians((a[1]+b[1])/2)); ky=110540
    return math.hypot((b[0]-a[0])*kx,(b[1]-a[1])*ky)

def project(name, p):
    """nearest vertex-ish measure on mainstem to point p -> (measure, snapped point, dist)."""
    s=mainstem[name]; best=(1e18,None,None)
    pts=s['pts']; ms=s['m']
    for i in range(len(pts)-1):
        a=pts[i]; b=pts[i+1]
        dx,dy=b[0]-a[0],b[1]-a[1]
        if dx==0 and dy==0: continue
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)))
        q=(a[0]+t*dx,a[1]+t*dy)
        d=dist_m(p,q)
        if d<best[0]: best=(d,ms[i]+t*(ms[i+1]-ms[i]),q)
    return best[1], best[2], best[0]

def slice_stem(name, m0=None, m1=None, tol=0.00008, nd=5):
    s=mainstem[name]; pts=s['pts']; ms=s['m']
    lo=ms[0] if m0 is None else m0; hi=ms[-1] if m1 is None else m1
    out=[]
    def interp(i,m):
        t=(m-ms[i])/((ms[i+1]-ms[i]) or 1); a=pts[i]; b=pts[i+1]
        return (a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1]))
    for i,(p,m) in enumerate(zip(pts,ms)):
        if m<lo:
            if i+1<len(pts) and ms[i+1]>lo: out.append(interp(i,lo))
            continue
        if m>hi:
            if i>0 and ms[i-1]<hi: out.append(interp(i-1,hi))
            break
        out.append(p)
    return rnd(dp(out,tol),nd)

def seg_intersections(name, road_name, roadsets):
    """intersections of road polylines (by name) with the stem; returns list of (measure, point)."""
    s=mainstem[name]; pts=s['pts']; ms=s['m']
    res=[]
    for feat in roadsets:
        if feat['properties']['ROAD_NAME_FULL']!=road_name: continue
        for line in lines_of(feat['geometry']):
            L=[tuple(c[:2]) for c in line]
            for i in range(len(L)-1):
                a,b=L[i],L[i+1]
                for j in range(len(pts)-1):
                    c,d=pts[j],pts[j+1]
                    # segment intersection
                    r=(b[0]-a[0],b[1]-a[1]); q=(d[0]-c[0],d[1]-c[1])
                    den=r[0]*q[1]-r[1]*q[0]
                    if den==0: continue
                    w=(c[0]-a[0],c[1]-a[1])
                    t=(w[0]*q[1]-w[1]*q[0])/den; u=(w[0]*r[1]-w[1]*r[0])/den
                    if 0<=t<=1 and 0<=u<=1:
                        p=(a[0]+t*r[0],a[1]+t*r[1]); res.append((ms[j]+u*(ms[j+1]-ms[j]), p))
    res.sort()
    return res

allroads=br['features']+roads2['features']+roads['features']
def X(stem, road):
    r=seg_intersections(stem, road, allroads)
    print('X',stem,road,[(round(m),(round(p[0],4),round(p[1],4))) for m,p in r], file=sys.stderr)
    return r

# compute boundary measures
Bx={}
Bx['alouette_216']=X('Alouette River','216 St')
Bx['kanaka_112']=X('Kanaka Creek','112 Ave')
Bx['nicomekl_208']=X('Nicomekl River','208 St')
Bx['serpentine_168']=X('Serpentine River','168 St')
Bx['lcr_12']=X('Little Campbell River','12 Ave')
Bx['harrison_hwy7']=X('Harrison River','Lougheed Hwy')
Bx['chapman_101']=X('Chapman Creek','Sunshine Coast Hwy')+X('Chapman Creek','Hwy 101')
Bx['fraser_hwy11']=X('Fraser River','Hwy 11')
Bx['stave_lougheed']=X('Stave River','Lougheed Hwy')
Bx['sumas_hwy1']=X('Sumas River','Trans-Canada Hwy')
Bx['vedder_hwy1']=X('Vedder River','Trans-Canada Hwy')
Bx['coq_lougheed']=X('Coquitlam River','Lougheed Hwy')
Bx['stayte']=[]
# rail intersections
railfeats=[]
try:
    railfeats=load('rail.json')['features']
    for f in railfeats: f['properties']['ROAD_NAME_FULL']='RAIL'
    Bx['fraser_rail']=seg_intersections('Fraser River','RAIL',railfeats)
    Bx['stave_rail']=seg_intersections('Stave River','RAIL',railfeats)
    print('rail X fraser',[(round(m),(round(p[0],4),round(p[1],4))) for m,p in Bx['fraser_rail']], file=sys.stderr)
    print('rail X stave',[(round(m),(round(p[0],4),round(p[1],4))) for m,p in Bx['stave_rail']], file=sys.stderr)
except Exception as e:
    print('no rail',e, file=sys.stderr)

# Slesse confluence: downstream end of Slesse Creek
sl=mainstem['Slesse Creek']; slesse_mouth=sl['pts'][0]
m_slesse,_,dd=project('Chilliwack River', slesse_mouth)
print('slesse mouth',slesse_mouth,'-> chilliwack m',round(m_slesse),'d',round(dd), file=sys.stderr)
# Stayte Rd south end
for f in br['features']:
    if f['properties']['ROAD_NAME_FULL']=='Stayte Rd':
        for line in lines_of(f['geometry']):
            for c in line:
                Bx['stayte'].append(tuple(c[:2]))
stayte_s=min(Bx['stayte'], key=lambda p:p[1]) if Bx['stayte'] else None
print('stayte south end',stayte_s, file=sys.stderr)
if stayte_s:
    m_stayte,q,dd=project('Little Campbell River', stayte_s); print('stayte -> LCR m',round(m_stayte),'d',round(dd),q, file=sys.stderr)

# lake outlets / dams: report stem ends & measures at hand points
for name,p in [('Chehalis River',(-122.0192,49.4428)),('Alouette River',(-122.531,49.276)),('Capilano River',(-123.1105,49.3595)),('Coquitlam River',(-122.7835,49.3555)),('Stave River',(-122.4290,49.2020)),('Harrison River',(-121.79,49.30)),('Chapman Creek',(-123.70,49.455)),('Sumas River',(-122.114,49.1125)),('Nicomen Slough',(-122.07,49.185)),('Cheakamus River',(-123.03,49.98)),('Squamish River',(-123.45,49.95))]:
    m,q,dd=project(name,p); s=mainstem[name]
    print('PT',name,'m',round(m),'d',round(dd),'ends',round(s['m'][0]),round(s['m'][-1]),'start',s['pts'][0],'end',s['pts'][-1], file=sys.stderr)

json.dump({'land':land,'lakes':lake_polys,'rivers':river_polys,'hw':hw,'sec':sec,'rail':rail}, open(f'{OUT}/base.json','w'), separators=(',',':'))
import pickle
pickle.dump({'mainstem':mainstem,'Bx':{k:v for k,v in Bx.items()},'m_slesse':m_slesse,'m_stayte':m_stayte if stayte_s else None}, open(f'{OUT}/stems.pkl','wb'))
print('base.json bytes', len(open(f'{OUT}/base.json').read()), file=sys.stderr)
