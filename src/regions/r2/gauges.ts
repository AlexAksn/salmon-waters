// Environment and Climate Change Canada real-time hydrometric stations matched to each water.
// Station list: https://api.weather.gc.ca/collections/hydrometric-stations (status Active, REAL_TIME).
import type { Gauge } from '../model';

export const GAUGES: Record<string, Gauge> = {
  chilliwack: { stn: '08MH001', name: 'Chilliwack River at Vedder Crossing' },
  capilano: { stn: '08GA031', name: 'Capilano River at Canyon' },
  coquitlam: { stn: '08MH002', name: 'Coquitlam River at Port Coquitlam' },
  'alouette-upper': { stn: '08MH005', name: 'Alouette River near Haney' },
  'alouette-lower': { stn: '08MH005', name: 'Alouette River near Haney', note: 'Gauge sits upstream of this stretch.' },
  'north-alouette': { stn: '08MH006', name: 'North Alouette River at 232 St' },
  'harrison-upper': { stn: '08MG013', name: 'Harrison River near Harrison Hot Springs' },
  'harrison-lower': { stn: '08MG014', name: 'Harrison River at Harrison Mills' },
  chehalis: { stn: '08MG001', name: 'Chehalis River near Harrison Mills' },
  squamish: { stn: '08GA022', name: 'Squamish River near Brackendale' },
  cheakamus: { stn: '08GA043', name: 'Cheakamus River near Brackendale' },
  mamquam: { stn: '08GA075', name: 'Mamquam River above Ring Creek', note: 'Gauge sits upstream of the lower river.' },
  'fraser-upper': { stn: '08MF005', name: 'Fraser River at Hope' },
  'fraser-tidal': { stn: '08MH024', name: 'Fraser River at Mission' },
  nicomekl: { stn: '08MH155', name: 'Nicomekl River at 203 St, Langley' },
  kanaka: { stn: '08MH076', name: 'Kanaka Creek near Webster Corners' },
  'u-pitt': { stn: '08MH035', name: 'Pitt River near Port Coquitlam' },
  'u-seymour': { stn: '08GA030', name: 'Seymour River near North Vancouver' },
  'u-lillooet': { stn: '08MG005', name: 'Lillooet River near Pemberton' },
  'u-coquihalla': { stn: '08MF068', name: 'Coquihalla River above Alexander Creek' },
  'u-salmon': { stn: '08MH090', name: 'Salmon River at 72 Ave, Langley' },
  'u-elaho': { stn: '08GA071', name: 'Elaho River near the mouth' },
  'u-slesse': { stn: '08MH056', name: 'Slesse Creek near Vedder Crossing' },
};
