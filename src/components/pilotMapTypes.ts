import type { ReactNode } from 'react';

import type { Pin } from '@/src/data/types';
import type { GeoPoint } from '@/src/geo';

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
