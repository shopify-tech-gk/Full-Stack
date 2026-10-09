import type { MapStyleElement } from 'react-native-maps';

/**
 * YouMart map look (Android/Google renderer): soft brand-blue land, white roads, pale water, quiet
 * parks, and no POI/transit clutter — so the picker reads as part of YouMart, not a stock map.
 * iOS (Apple renderer) can't take a JSON style; it uses mutedStandard + a light brand tint instead.
 */
export const YOUMART_MAP_STYLE: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#eef6fc' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#40618c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0142aa' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }, { color: '#d9f0e3' }],
  },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#dbe8f5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d3e4f8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#b4cdee' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5a7395' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfdcf4' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5b86b8' }] },
];
