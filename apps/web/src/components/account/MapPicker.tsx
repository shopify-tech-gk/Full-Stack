'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, LocateFixed, MapPin } from 'lucide-react';
import { INDIAN_STATES } from '@youmart/shared-client';
import { BTN_PRIMARY, BTN_SECONDARY, Dialog } from './ui';

// The location picker on the website: an OpenStreetMap (Leaflet) map with a fixed centre pin, the
// address under the pin looked up as the map moves, and "use my current location". Leaflet loads
// from the CDN only when the picker opens, so the rest of the site doesn't carry it.
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
const INDIA = { lat: 20.5937, lng: 78.9629, zoom: 5 };
const STREET_ZOOM = 17;

export interface PickedPlace {
  line1?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

interface LeafletMap {
  setView: (c: [number, number], z: number, o?: { animate?: boolean }) => void;
  getCenter: () => { lat: number; lng: number };
  on: (ev: string, fn: () => void) => void;
  remove: () => void;
  invalidateSize: () => void;
}
interface LeafletGlobal {
  map: (el: HTMLElement, o: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, o: Record<string, unknown>) => { addTo: (m: LeafletMap) => void };
}

let leafletLoading: Promise<LeafletGlobal> | null = null;
function loadLeaflet(): Promise<LeafletGlobal> {
  const w = window as unknown as { L?: LeafletGlobal };
  if (w.L) return Promise.resolve(w.L);
  leafletLoading ??= new Promise<LeafletGlobal>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${LEAFLET}/leaflet.css`;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = `${LEAFLET}/leaflet.js`;
    js.async = true;
    js.onload = () => (w.L ? resolve(w.L) : reject(new Error('Leaflet unavailable')));
    js.onerror = () => reject(new Error('The map could not load'));
    document.body.appendChild(js);
  }).catch((e: unknown) => {
    leafletLoading = null;
    throw e;
  });
  return leafletLoading;
}

const uniq = (parts: (string | undefined)[]) => parts.filter((p, i, a): p is string => Boolean(p) && a.indexOf(p) === i);

/** OpenStreetMap reverse geocoding (same as the app's backup geocoder). */
async function lookup(lat: number, lng: number): Promise<{ title: string; subtitle: string; fields: PickedPlace } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`,
    { headers: { 'Accept-Language': 'en-IN' } },
  );
  if (!res.ok) return null;
  const a = ((await res.json()) as { address?: Record<string, string> }).address;
  if (!a) return null;
  const line1 = uniq([a.house_number, a.building, a.road]).join(', ');
  const area = a.suburb ?? a.neighbourhood ?? a.quarter;
  const city = a.city ?? a.town ?? a.village ?? a.county;
  const state = INDIAN_STATES.find((s) => s.toLowerCase() === (a.state ?? '').toLowerCase());
  return {
    title: line1 || area || city || 'Selected location',
    subtitle: uniq([area, city, a.state, a.postcode]).join(', '),
    fields: {
      ...(line1 ? { line1 } : {}),
      ...(area ? { landmark: area } : {}),
      ...(city ? { city } : {}),
      ...(state ? { state } : {}),
      ...(a.postcode && /^\d{6}$/.test(a.postcode) ? { pincode: a.postcode } : {}),
    },
  };
}

type Card = { kind: 'idle' } | { kind: 'loading' } | { kind: 'ready'; title: string; subtitle: string; fields: PickedPlace } | { kind: 'error' };

export function MapPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (place: PickedPlace) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [card, setCard] = useState<Card>({ kind: 'idle' });
  const [moving, setMoving] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.current?.setView([pos.coords.latitude, pos.coords.longitude], STREET_ZOOM);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    loadLeaflet()
      .then((L) => {
        if (!alive || !el.current) return;
        const m = L.map(el.current, { zoomControl: true });
        map.current = m;
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(m);
        m.setView([INDIA.lat, INDIA.lng], INDIA.zoom);
        const update = () => {
          setMoving(false);
          clearTimeout(timer);
          timer = setTimeout(() => {
            const c = m.getCenter();
            const mine = ++seq.current;
            setCard({ kind: 'loading' });
            lookup(c.lat, c.lng)
              .then((place) => mine === seq.current && setCard(place ? { kind: 'ready', ...place } : { kind: 'error' }))
              .catch(() => mine === seq.current && setCard({ kind: 'error' }));
          }, 450);
        };
        m.on('movestart', () => setMoving(true));
        m.on('moveend', update);
        setTimeout(() => m.invalidateSize(), 50);
        locateMe();
      })
      .catch(() => alive && setMapError(true));
    return () => {
      alive = false;
      clearTimeout(timer);
      map.current?.remove();
      map.current = null;
      setCard({ kind: 'idle' });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const zoomedIn = card.kind === 'ready';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width={880}
      title="Pin your delivery location"
      description="Move the map so the pin sits on your door - we’ll fill in the address for you."
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button type="button" disabled={!zoomedIn} onClick={() => card.kind === 'ready' && onPick(card.fields)} className={BTN_PRIMARY}>
            <MapPin aria-hidden="true" className="size-[16px]" /> Confirm location
          </button>
        </>
      }
    >
      <div className="relative h-[420px] overflow-hidden rounded-[12px] border border-catalog-rule bg-[#e5edf5]">
        {mapError ? (
          <p className="flex h-full items-center justify-center text-[14px] text-ink-muted">The map couldn&rsquo;t load. Please type your address instead.</p>
        ) : (
          <div ref={el} className="size-full" />
        )}
        {/* The fixed centre pin: lifts while the map moves, drops when it stops. */}
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full">
          <MapPin
            className={`size-[40px] fill-brand text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] transition-transform duration-200 ${moving ? '-translate-y-[10px]' : ''}`}
            strokeWidth={1.5}
          />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-[499] h-[6px] w-[14px] -translate-x-1/2 rounded-full bg-black/25 blur-[1px]" />
        <button
          type="button"
          onClick={locateMe}
          className="absolute bottom-[14px] right-[14px] z-[500] inline-flex h-[38px] items-center gap-[8px] rounded-full bg-white px-[14px] text-[13.5px] font-semibold text-brand shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:bg-[#eef3fc]"
        >
          {locating ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : <LocateFixed aria-hidden="true" className="size-[16px]" />}
          Use my current location
        </button>
      </div>
      <div className="mt-[14px] flex min-h-[52px] items-center gap-[12px] rounded-[12px] bg-[#f6f8fb] px-[14px] py-[10px]">
        <Crosshair aria-hidden="true" className="size-[18px] shrink-0 text-brand" />
        {card.kind === 'ready' ? (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-heading">{card.title}</p>
            <p className="truncate text-[13px] text-ink-muted">{card.subtitle}</p>
          </div>
        ) : card.kind === 'loading' ? (
          <p className="text-[14px] text-ink-muted">Finding the address…</p>
        ) : card.kind === 'error' ? (
          <p className="text-[14px] text-ink-muted">Couldn&rsquo;t read this spot - move the pin a little.</p>
        ) : (
          <p className="text-[14px] text-ink-muted">Zoom in and drag the map to your location.</p>
        )}
      </div>
    </Dialog>
  );
}
