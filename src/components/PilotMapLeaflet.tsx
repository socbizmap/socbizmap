import { createElement, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Muted } from '@/src/components/ui';
import { KHARKIV, PILOT_BBOX } from '@/src/geo';
import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

import type { PilotMapProps } from './pilotMapTypes';

type LeafletNS = typeof import('leaflet');
type LeafletMap = import('leaflet').Map;
type LeafletMarker = import('leaflet').Marker;

const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = `<a href="https://www.openstreetmap.org/copyright">${t('osmAttribution')}</a>`;

const SKIN_CSS = `
.leaflet-container{width:100%;height:100%;background:#dbeafe;font:12px/1.3 system-ui,sans-serif;z-index:0;touch-action:none;}
.leaflet-control-attribution{font-size:10px;background:rgba(255,255,255,.85);}
.sbm-pin,.sbm-me{background:transparent!important;border:none!important;display:flex!important;align-items:center;justify-content:center;}
.sbm-me{pointer-events:none!important;}
.sbm-pin-dot,.sbm-me-dot{display:block;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.35);}
.sbm-pin-dot{width:14px;height:14px;background:${colors.primary};}
.sbm-pin-on .sbm-pin-dot{width:18px;height:18px;background:${colors.primaryDark};}
.sbm-me-dot{width:12px;height:12px;background:#2563EB;}
`;

function ensureLeafletSkin(): void {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
  if (!document.getElementById('sbm-leaflet-skin')) {
    const style = document.createElement('style');
    style.id = 'sbm-leaflet-skin';
    style.textContent = SKIN_CSS;
    document.head.appendChild(style);
  }
}

function leafletNs(mod: LeafletNS & { default?: LeafletNS }): LeafletNS {
  return mod.default ?? mod;
}

function pinIcon(L: LeafletNS, selected: boolean) {
  return L.divIcon({
    className: selected ? 'sbm-pin sbm-pin-on' : 'sbm-pin',
    html: '<span class="sbm-pin-dot"></span>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function meIcon(L: LeafletNS) {
  return L.divIcon({
    className: 'sbm-me',
    html: '<span class="sbm-me-dot"></span>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function LeafletHost({
  hostRef,
  minHeight,
}: {
  hostRef: MutableRefObject<HTMLDivElement | null>;
  minHeight: number;
}) {
  return createElement('div', {
    ref: (node: HTMLDivElement | null) => {
      hostRef.current = node;
    },
    style: { width: '100%', height: '100%', minHeight },
  });
}

/** Web: Leaflet + OSM tiles. Dynamic import so Expo static render never touches `window`. */
export function PilotMapLeaflet({
  origin,
  pins = [],
  pickMarker,
  picking = false,
  selectedPinId = null,
  onSelectPin,
  onMapPress,
  emptyOverlay,
  compact = false,
}: PilotMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const meRef = useRef<LeafletMarker | null>(null);
  const pickRef = useRef<LeafletMarker | null>(null);
  const pinRefs = useRef<Map<string, LeafletMarker>>(new Map());
  const onMapPressRef = useRef(onMapPress);
  const onSelectPinRef = useRef(onSelectPin);
  const startRef = useRef(pickMarker ?? origin ?? KHARKIV);
  const compactRef = useRef(compact);
  const [mapReady, setMapReady] = useState(false);
  onMapPressRef.current = onMapPress;
  onSelectPinRef.current = onSelectPin;
  startRef.current = pickMarker ?? origin ?? KHARKIV;
  compactRef.current = compact;

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;

    async function boot() {
      if (typeof window === 'undefined') return;
      const host = hostRef.current;
      if (!host) return;
      ensureLeafletSkin();
      const L = leafletNs(await import('leaflet'));
      if (cancelled || !hostRef.current) return;
      LRef.current = L;

      const bounds = L.latLngBounds(
        [PILOT_BBOX.minLat, PILOT_BBOX.minLng],
        [PILOT_BBOX.maxLat, PILOT_BBOX.maxLng],
      );
      const start = startRef.current;
      map = L.map(host, {
        center: [start.lat, start.lng],
        zoom: compactRef.current ? 13 : 12,
        minZoom: 8,
        maxZoom: 18,
        maxBounds: bounds.pad(0.06),
        maxBoundsViscosity: 0.85,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: !compactRef.current,
      });
      L.tileLayer(OSM_TILES, {
        attribution: OSM_ATTR,
        maxZoom: 19,
      }).addTo(map);
      L.DomEvent.disableScrollPropagation(host);
      map.on('click', (e) => {
        onMapPressRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.attributionControl.setPosition('topright');
      mapRef.current = map;
      requestAnimationFrame(() => {
        map?.invalidateSize();
        if (!cancelled) setMapReady(true);
      });
    }

    void boot();
    return () => {
      cancelled = true;
      setMapReady(false);
      pinRefs.current.forEach((m) => m.remove());
      pinRefs.current.clear();
      meRef.current?.remove();
      meRef.current = null;
      pickRef.current?.remove();
      pickRef.current = null;
      map?.remove();
      mapRef.current = null;
      LRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!mapReady || !map || !L) return;
    map.invalidateSize();
    if (!origin) {
      meRef.current?.remove();
      meRef.current = null;
      return;
    }
    map.panTo([origin.lat, origin.lng]);
    if (meRef.current) {
      meRef.current.setLatLng([origin.lat, origin.lng]);
      return;
    }
    meRef.current = L.marker([origin.lat, origin.lng], {
      icon: meIcon(L),
      interactive: false,
      keyboard: false,
      zIndexOffset: -500,
    }).addTo(map);
  }, [mapReady, origin]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!mapReady || !map || !L) return;
    if (!pickMarker) {
      pickRef.current?.remove();
      pickRef.current = null;
      return;
    }
    if (pickRef.current) {
      pickRef.current.setLatLng([pickMarker.lat, pickMarker.lng]);
      return;
    }
    pickRef.current = L.marker([pickMarker.lat, pickMarker.lng], {
      icon: pinIcon(L, true),
      interactive: false,
      keyboard: false,
      zIndexOffset: 600,
    }).addTo(map);
  }, [mapReady, pickMarker]);

  useEffect(() => {
    const el = mapRef.current?.getContainer();
    if (el) el.style.cursor = picking ? 'crosshair' : '';
  }, [mapReady, picking]);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!mapReady || !map || !L) return;

    const nextIds = new Set(pins.map((p) => p.id));
    pinRefs.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        pinRefs.current.delete(id);
      }
    });

    for (const pin of pins) {
      const selected = pin.id === selectedPinId;
      const existing = pinRefs.current.get(pin.id);
      if (existing) {
        existing.setLatLng([pin.geog.lat, pin.geog.lng]);
        existing.setIcon(pinIcon(L, selected));
        existing.setZIndexOffset(selected ? 800 : 400);
        continue;
      }
      const marker = L.marker([pin.geog.lat, pin.geog.lng], {
        icon: pinIcon(L, selected),
        keyboard: true,
        zIndexOffset: selected ? 800 : 400,
        title: pin.title,
      });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectPinRef.current?.(pin);
      });
      marker.addTo(map);
      pinRefs.current.set(pin.id, marker);
    }
  }, [mapReady, pins, selectedPinId]);

  return (
    <View
      style={[styles.plot, compact ? styles.plotCompact : null]}
      onLayout={() => {
        mapRef.current?.invalidateSize();
      }}
    >
      <LeafletHost hostRef={hostRef} minHeight={compact ? 220 : 0} />
      <Muted style={styles.plotHint}>{picking ? t('pickOnMap') : t('locationPlotHint')}</Muted>
      {emptyOverlay}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    flex: 1,
    backgroundColor: '#dbeafe',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 0,
  },
  plotCompact: {
    flex: 0,
    minHeight: 220,
    height: 220,
  },
  plotHint: {
    position: 'absolute',
    left: 12,
    bottom: 10,
    pointerEvents: 'none',
    zIndex: 4,
    backgroundColor: 'rgba(240, 253, 250, 0.88)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
