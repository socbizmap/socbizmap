import { createElement, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Muted } from '@/src/components/ui';
import { type GeoPoint, projectToPilot, unprojectFromPilot } from '@/src/geo';
import { t } from '@/src/i18n';
import { colors } from '@/src/theme';

import type { PilotMapProps } from './pilotMapTypes';

function pointFromBox(clientX: number, clientY: number, box: { w: number; h: number; left: number; top: number }): GeoPoint | null {
  if (box.w < 2 || box.h < 2) return null;
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  return unprojectFromPilot((clientX - box.left) / box.w, (clientY - box.top) / box.h);
}

/** Schematic plot for native, and a web fallback with DOM clicks (ScrollView-safe). */
export function PilotMapSchematic({
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
  const plotSize = useRef({ w: 1, h: 1, left: 0, top: 0 });
  const me = origin ? projectToPilot(origin.lat, origin.lng) : null;
  const picked = pickMarker ? projectToPilot(pickMarker.lat, pickMarker.lng) : null;

  function rememberLayout(width: number, height: number, x: number, y: number) {
    plotSize.current = { w: width || 1, h: height || 1, left: x, top: y };
  }

  function pressAt(locationX: number, locationY: number) {
    const w = plotSize.current.w || 1;
    const h = plotSize.current.h || 1;
    if (!Number.isFinite(locationX) || !Number.isFinite(locationY)) return;
    onMapPress(unprojectFromPilot(locationX / w, locationY / h));
  }

  const markers = (
    <>
      {me ? (
        <View style={[styles.me, { left: `${me.x * 100}%`, top: `${me.y * 100}%` }]} />
      ) : null}
      {picked ? (
        <View style={[styles.dot, styles.dotOn, styles.inert, { left: `${picked.x * 100}%`, top: `${picked.y * 100}%` }]} />
      ) : null}
      {pins.map((p) => {
        const { x, y } = projectToPilot(p.geog.lat, p.geog.lng);
        const selected = p.id === selectedPinId;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={p.title}
            {...(Platform.OS === 'web' ? { dataSet: { sbmPin: '1' } } : {})}
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
    </>
  );

  if (Platform.OS === 'web') {
    return createElement(
      'div',
      {
        role: 'button',
        onClick: (ev: MouseEvent) => {
          const target = ev.target as HTMLElement | null;
          if (target?.closest?.('[data-sbm-pin="1"]')) return;
          const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
          rememberLayout(rect.width, rect.height, rect.left, rect.top);
          const next = pointFromBox(ev.clientX, ev.clientY, {
            w: rect.width,
            h: rect.height,
            left: rect.left,
            top: rect.top,
          });
          if (next) onMapPress(next);
        },
        style: {
          position: 'relative',
          flexGrow: compact ? 0 : 1,
          flexShrink: compact ? 0 : 1,
          height: compact ? 220 : '100%',
          minHeight: compact ? 220 : 0,
          background: colors.map,
          borderRadius: 16,
          overflow: 'hidden',
          cursor: picking ? 'crosshair' : 'pointer',
        },
      },
      markers,
    );
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
        const { width, height, x, y } = e.nativeEvent.layout;
        rememberLayout(width, height, x, y);
      }}
    >
      {markers}
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
    minHeight: 0,
  },
  plotCompact: {
    flex: 0,
    minHeight: 220,
    height: 220,
  },
  plotHint: { position: 'absolute', left: 12, bottom: 12, pointerEvents: 'none' },
  inert: { pointerEvents: 'none' },
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
    pointerEvents: 'none',
  },
});
