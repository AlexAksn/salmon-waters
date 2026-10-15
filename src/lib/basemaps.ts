export type Basemap = 'chart' | 'streets' | 'topo' | 'satellite';
export const BASEMAPS: { id: Basemap; label: string }[] = [
  { id: 'chart', label: 'Chart' }, { id: 'streets', label: 'Streets' }, { id: 'topo', label: 'Topo' }, { id: 'satellite', label: 'Satellite' },
];
