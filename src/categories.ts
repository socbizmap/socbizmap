import type { I18nKey } from '@/src/i18n';
import type { PinCategory, PinStatus } from '@/src/data/types';

export const CATEGORIES: { id: PinCategory; label: I18nKey }[] = [
  { id: 'workers', label: 'workers' },
  { id: 'construction', label: 'construction' },
  { id: 'home', label: 'homeCat' },
  { id: 'it', label: 'it' },
  { id: 'trade', label: 'trade' },
  { id: 'horeca', label: 'horeca' },
  { id: 'students', label: 'students' },
  { id: 'other', label: 'other' },
];

export const STATUS_LABEL: Record<PinStatus, I18nKey> = {
  pending: 'pending',
  revision: 'revision',
  rejected: 'rejected',
  live: 'live',
  closed: 'closed',
  hidden: 'hidden',
  archived: 'archived',
  deleted: 'deleted',
};
