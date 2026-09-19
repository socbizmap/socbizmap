import { useEffect, useState, type ComponentType } from 'react';
import { Platform } from 'react-native';

import { PilotMapSchematic } from '@/src/components/PilotMapSchematic';

import type { PilotMapProps } from './pilotMapTypes';

export type { PilotMapProps } from './pilotMapTypes';

/**
 * Web always takes the Leaflet/OSM path via `Platform.OS` (not only `.web.tsx`,
 * which some Expo web previews skip). Native keeps the schematic plot.
 */
export function PilotMap(props: PilotMapProps) {
  if (Platform.OS === 'web') {
    return <PilotMapWebGate {...props} />;
  }
  return <PilotMapSchematic {...props} />;
}

function PilotMapWebGate(props: PilotMapProps) {
  const [WebMap, setWebMap] = useState<ComponentType<PilotMapProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import('./PilotMapLeaflet').then((mod) => {
      if (!cancelled) setWebMap(() => mod.PilotMapLeaflet);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!WebMap) {
    return <PilotMapSchematic {...props} />;
  }
  return <WebMap {...props} />;
}
