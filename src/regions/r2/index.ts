import { makeRegion } from '../../lib/region';
import { GAUGES } from './gauges';
import meta from './region.json';
import stations from './stations.json';
import { CITIES, GLOBAL_RULES, NOTICES, WATERS } from './regs';

export const region = makeRegion(meta, { waters: WATERS, cities: CITIES, globalRules: GLOBAL_RULES, notices: NOTICES, gauges: GAUGES, stations });
