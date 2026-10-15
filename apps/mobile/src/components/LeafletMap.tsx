import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { Region } from 'react-native-maps';

export interface LeafletMapHandle {
  animateToRegion: (region: Region, duration?: number) => void;
  setGps: (c: { latitude: number; longitude: number }) => void;
}

interface Props {
  initialRegion: Region;
  onMapReady?: () => void;
  onRegionChangeStart?: () => void;
  onRegionChangeComplete?: (region: Region) => void;
}

/** react-native-maps' latitude/longitude delta <-> a web-map zoom level. */
const zoomFor = (delta: number) => Math.max(3, Math.min(19, Math.log2(360 / delta)));

/**
 * The Android location-picker map: OpenStreetMap tiles in a WebView (Leaflet), toned to the brand. Google Maps on Android needs a paid Google Maps API key - without one it
 * renders an empty beige canvas - so Android uses this instead; iOS keeps Apple Maps.
 * Same contract the picker uses from react-native-maps: initialRegion, ready / move-start /
 * move-end events, animateToRegion, plus a GPS dot.
 */
export const LeafletMap = forwardRef<LeafletMapHandle, Props>(function LeafletMap(
  { initialRegion, onMapReady, onRegionChangeStart, onRegionChangeComplete },
  ref,
) {
  const web = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r, duration = 1000) => {
      web.current?.injectJavaScript(
        `window.flyTo(${r.latitude}, ${r.longitude}, ${zoomFor(r.longitudeDelta)}, ${duration / 1000}); true;`,
      );
    },
    setGps: (c) => {
      web.current?.injectJavaScript(`window.setGps(${c.latitude}, ${c.longitude}); true;`);
    },
  }));

  // Built once: the WebView keeps its own map state after the first load.
  const html = useMemo(
    () => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #map { margin: 0; height: 100%; width: 100%; background: #eef6fc; }
  .leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,0.7) !important; }
  /* Soften OSM's colours towards the YouMart palette (quieter, slightly cool). */
  .leaflet-tile-pane { filter: saturate(0.72) brightness(1.04) hue-rotate(-6deg); }
  .gps { width: 16px; height: 16px; border-radius: 50%; background: #208aef; border: 3px solid #fff;
         box-shadow: 0 0 0 8px rgba(32,138,239,0.22); box-sizing: border-box; }
</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const map = L.map('map', { zoomControl: false, attributionControl: true, zoomSnap: 0 })
    .setView([${initialRegion.latitude}, ${initialRegion.longitude}], ${zoomFor(initialRegion.longitudeDelta)});
  map.attributionControl.setPrefix('');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);
  let gps = null;
  window.setGps = (lat, lng) => {
    const icon = L.divIcon({ className: '', html: '<div class="gps"></div>', iconSize: [16, 16] });
    if (gps) gps.setLatLng([lat, lng]); else gps = L.marker([lat, lng], { icon, interactive: false }).addTo(map);
  };
  window.flyTo = (lat, lng, zoom, seconds) => map.flyTo([lat, lng], zoom, { duration: seconds });
  map.on('movestart', () => post({ type: 'movestart' }));
  map.on('moveend', () => {
    const c = map.getCenter(), b = map.getBounds();
    post({ type: 'moveend', latitude: c.lat, longitude: c.lng,
           latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() });
  });
  map.whenReady(() => { post({ type: 'ready' }); map.fire('moveend'); });
</script></body></html>`,
    [],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type: string } & Partial<Region>;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.type === 'ready') onMapReady?.();
    else if (m.type === 'movestart') onRegionChangeStart?.();
    else if (m.type === 'moveend' && m.latitude !== undefined && m.longitude !== undefined) {
      onRegionChangeComplete?.({
        latitude: m.latitude,
        longitude: m.longitude,
        latitudeDelta: m.latitudeDelta ?? 0,
        longitudeDelta: m.longitudeDelta ?? 0,
      });
    }
  };

  return (
    <WebView
      ref={web}
      style={StyleSheet.absoluteFill}
      source={{ html, baseUrl: 'https://youmart.in' }}
      originWhitelist={['*']}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      androidLayerType="hardware"
    />
  );
});
