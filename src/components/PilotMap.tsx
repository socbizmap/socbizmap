import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Muted } from '@/src/components/ui';
import type { Pin } from '@/src/data/types';
import { type GeoPoint, projectToPilot, unprojectFromPilot } from '@/src/geo';
import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

export type PilotMapProps = {
  origin?: GeoPoint | null;
  pins?: Pin[];
  pickMarker?: GeoPoint | null;
  picking?: boolean;
  selectedPinId?: string | null;
  onSelectPin?: (pin: Pin) => void;
  onMapPress: (point: GeoPoint) => void;
  emptyOverlay?: ReactNode;
  compact?: boolean;
};

/** Native schematic plot. Web uses `PilotMap.web.tsx` (Leaflet + OSM). */
export function PilotMap({
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
  const plotSize = useRef({ w: 1, h: 1 });
  const me = origin ? projectToPilot(origin.lat, origin.lng) : null;
  const picked = pickMarker ? projectToPilot(pickMarker.lat, pickMarker.lng) : null;

  function pressAt(locationX: number, locationY: number) {
    const w = plotSize.current.w || 1;
    const h = plotSize.current.h || 1;
    if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return;
    onMapPress(unprojectFromPilot(locationX / w, locationY / h));
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('pickOnMap')}
      accessibilityState={{ selected: picking }}
      style={[styles.plot, compact ? styles.plotCompact : null]}
      onPress={(e) => {
        pressAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
      }}
      onLayout={(e) => {
        plotSize.current = {
          w: e.nativeEvent.layout.width || 1,
          h: e.nativeEvent.layout.height || 1,
        };
      }}
    >
      {me ? (
        <View pointerEvents="none" style={[styles.me, { left: `${me.x * 100}%`, top: `${me.y * 100}%` }]} />
      ) : null}
      {picked ? (
        <View
          pointerEvents="none"
          style={[styles.dot, styles.dotOn, { left: `${picked.x * 100}%`, top: `${picked.y * 100}%` }]}
        />
      ) : null}
      {pins.map((p) => {
        const { x, y } = projectToPilot(p.geog.lat, p.geog.lng);
        const selected = p.id === selectedPinId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={p.title}
            style={[styles.dot, selected ? styles.dotOn : null, { left: `${x * 100}%`, top: `${y * 100}%` }]}
            onPress={(e) => {
              e.stopPropagation?.();
              onSelectPin?.(p);
            }}
          />
        );
      })}
      <Muted style={styles.plotHint}>{picking ? t('pickOnMap') : t('locationPlotHint')}</Muted>
      {emptyOverlay}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  plot: {
    flex: 1,
    backgroundColor: colors.map,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 280,
  },
  plotCompact: {
    flex: 0,
    minHeight: 220,
    height: 220,
  },
  plotHint: { position: 'absolute', left: 12, bottom: 12, pointerEvents: 'none' },
  dot: {
    position: 'absolute',
    zIndex: 2,
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dotOn: {
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -9,
    borderRadius: 9,
    zIndex: 3,
    backgroundColor: colors.primaryDark,
  },
  me: {
    position: 'absolute',
    zIndex: 1,
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
