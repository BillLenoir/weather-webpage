import { LocationConfig } from '../../src/config/weather.config';

// Same order as the recorded response's entries in open-meteo.json, so each
// entry's location_id indexes into this array. Entry 0's location_id is absent,
// entries 1 and 2 carry 1 and 2, so a single-location test must use entry 0.
export const locations: LocationConfig[] = [
  {
    id: 'centreville',
    label: 'Centreville, VA',
    latitude: 38.84,
    longitude: -77.43,
  },
  { id: 'astoria', label: 'Astoria, NY', latitude: 40.77, longitude: -73.92 },
  {
    id: 'dongtan',
    label: 'Dongtan, Hwaseong',
    latitude: 37.19,
    longitude: 127.12,
  },
];
