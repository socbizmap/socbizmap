import * as Location from 'expo-location';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PinPreviewCard } from '@/src/components/PinPreviewCard';
import { PilotMap } from '@/src/components/PilotMap';
import { PinRow } from '@/src/components/PinRow';
import { Chip, Muted, PrimaryButton, Screen } from '@/src/components/ui';
import type { Pin, PinKind, Vertical } from '@/src/data/types';
import { inPilotOblast, KHARKIV } from '@/src/geo';
import { t } from '@/src/i18n';
import { readRadiusAlertsEnabled, writeRadiusAlertsEnabled } from '@/src/radius-alerts';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function MapScreen() {
  const { api, session, profile } = useData();
  const params = useLocalSearchParams<{ vertical?: string; kind?: string }>();
  const navigation = useNavigation();
  const vertical: Vertical = params.vertical === 'service' ? 'service' : 'work';
  const [kind, setKind] = useState<PinKind>(params.kind === 'offer' ? 'offer' : 'seek');
  const [view, setView] = useState<'map' | 'list'>('map');
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lng: number }>(KHARKIV);
  const [originMode, setOriginMode] = useState<'gps' | 'map'>('gps');
  const [picking, setPicking] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [alertsOn, setAlertsOn] = useState(false);
  const [alertsKnown, setAlertsKnown] = useState(false);
  const [alertNote, setAlertNote] = useState<string | null>(null);
  const [gpsTick, setGpsTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const radiusKm = profile?.radiusKm ?? 10;
  const selected = selectedId ? pins.find((p) => p.id === selectedId) ?? null : null;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => {
            setSelectedId(null);
            setView((v) => (v === 'map' ? 'list' : 'map'));
          }}
          style={styles.headerBtn}
        >
          <Text style={styles.headerBtnText}>{view === 'map' ? '☰' : '⌖'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, view]);

  const locateMe = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setOrigin(KHARKIV);
        setGpsNote(t('gpsDenied'));
        return { ok: false as const, reason: 'denied' as const, origin: KHARKIV };
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (inPilotOblast(next.lat, next.lng)) {
        setOrigin(next);
        setGpsNote(null);
        return { ok: true as const, origin: next };
      }
      setOrigin(KHARKIV);
      setGpsNote(t('gpsOutsidePilot'));
      return { ok: false as const, reason: 'outside' as const, origin: KHARKIV };
    } catch {
      setOrigin(KHARKIV);
      setGpsNote(t('gpsDenied'));
      return { ok: false as const, reason: 'error' as const, origin: KHARKIV };
    }
  }, []);

  useEffect(() => {
    setAlertsOn(readRadiusAlertsEnabled());
    setAlertsKnown(true);
  }, []);

  useEffect(() => {
    if (originMode !== 'gps') return;
    void locateMe();
  }, [originMode, gpsTick, locateMe]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await api.listLivePins({ origin, radiusKm, kind, vertical, search });
      if (!cancelled) setPins(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [api, origin, radiusKm, kind, vertical, search]);

  const kindLabels = useMemo(() => {
    if (vertical === 'work') {
      return [
        { id: 'seek' as const, label: t('seekingWork') },
        { id: 'offer' as const, label: t('offeringWork') },
      ];
    }
    return [
      { id: 'seek' as const, label: t('seekingService') },
      { id: 'offer' as const, label: t('offeringService') },
    ];
  }, [vertical]);

  function onPlotPress(lat: number, lng: number) {
    if (!picking) return;
    setOrigin({ lat, lng });
    setOriginMode('map');
    setPicking(false);
    setGpsNote(null);
  }

  function nearMe() {
    setPicking(false);
    setOriginMode('gps');
    setGpsTick((n) => n + 1);
  }

  async function enableAlerts() {
    setAlertNote(null);
    const result = await locateMe();
    setOriginMode('gps');
    if (!result.ok && result.reason === 'denied') {
      setAlertNote(t('alertsNeedLocation'));
      return;
    }
    if (session) {
      try {
        await api.updateProfile({ lastGeog: result.origin });
      } catch {
        // location still used as map origin
      }
    }
    const webNotify = (globalThis as { Notification?: { requestPermission?: () => Promise<string> } })
      .Notification;
    if (webNotify?.requestPermission) {
      try {
        await webNotify.requestPermission();
      } catch {
        // native Expo push tokens are week 2
      }
    }
    writeRadiusAlertsEnabled(true);
    setAlertsOn(true);
    setAlertNote(null);
  }

  const emptyCta = !alertsKnown ? null : alertsOn ? (
    <View style={styles.emptyBox}>
      <Text style={styles.bellGlyph}>✅</Text>
      <Text style={styles.emptyText}>{t('alertsOn')}</Text>
    </View>
  ) : (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{t('noPinsNearby')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('enableAlerts')}
        onPress={() => void enableAlerts()}
        style={styles.bell}
      >
        <Text style={styles.bellGlyph}>🔔</Text>
        <Text style={styles.bellLabel}>{t('enableAlerts')}</Text>
      </Pressable>
      {alertNote ? <Muted style={styles.alertNote}>{alertNote}</Muted> : null}
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <View style={styles.filters}>
        {kindLabels.map((k) => (
          <Chip
            key={k.id}
            label={k.label}
            selected={kind === k.id}
            onPress={() => {
              setSelectedId(null);
              setKind(k.id);
            }}
          />
        ))}
      </View>
      <TextInput
        style={styles.search}
        placeholder="Пошук"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={(text) => {
          setSelectedId(null);
          setSearch(text);
        }}
      />
      <View style={styles.chipRow}>
        <Pressable accessibilityRole="button" onPress={nearMe} style={styles.nearMe}>
          <Text style={styles.nearMeText}>{t('nearMe')}</Text>
        </Pressable>
        <Chip
          label={originMode === 'gps' ? t('fromHere') : t('fromMap')}
          selected
          onPress={nearMe}
        />
        <Chip label={t('pickOnMap')} selected={picking} onPress={() => setPicking(true)} />
      </View>
      {gpsNote ? <Muted style={styles.gpsNote}>{gpsNote}</Muted> : null}
      {view === 'map' ? (
        <View style={styles.mapWrap}>
          <PilotMap
            origin={origin}
            pins={pins}
            picking={picking}
            selectedPinId={selectedId}
            onSelectPin={(pin) => setSelectedId(pin.id)}
            onMapPress={(point) => {
              if (picking) {
                onPlotPress(point.lat, point.lng);
                return;
              }
              setSelectedId(null);
            }}
            emptyOverlay={pins.length === 0 && emptyCta ? <View style={styles.mapEmpty}>{emptyCta}</View> : null}
          />
          {selected ? (
            <PinPreviewCard pin={selected} onDetails={() => router.push(`/pin/${selected.id}`)} />
          ) : null}
        </View>
      ) : (
        <ScrollView style={styles.list}>
          {pins.length === 0 ? emptyCta : pins.map((p) => (
            <PinRow key={p.id} pin={p} onPress={() => router.push(`/pin/${p.id}`)} />
          ))}
        </ScrollView>
      )}
      <View style={styles.footer}>
        {session ? (
          <>
            <PrimaryButton
              label={t('createPin')}
              onPress={() => router.push(`/create?vertical=${vertical}&kind=${kind}`)}
            />
            <Pressable onPress={() => router.push('/chats')} style={styles.profileLink}>
              <Text style={styles.profileText}>{t('myChats')}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/profile')} style={styles.profileLink}>
              <Text style={styles.profileText}>{t('cabinet')}</Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton label={t('login')} onPress={() => router.push('/login')} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 12 },
  headerBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  headerBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap' },
  search: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' },
  nearMe: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
    marginBottom: 8,
  },
  nearMeText: { color: '#fff', fontWeight: '700' },
  gpsNote: { marginBottom: 8 },
  mapWrap: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  mapEmpty: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    alignItems: 'center',
    zIndex: 8,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  bell: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 180,
  },
  bellGlyph: { fontSize: 28, marginBottom: 4 },
  bellLabel: { color: colors.primaryDark, fontWeight: '700' },
  alertNote: { textAlign: 'center' },
  list: { flex: 1, minHeight: 0 },
  footer: { marginTop: 12, gap: 8, flexShrink: 0 },
  profileLink: { alignItems: 'center', padding: 8 },
  profileText: { color: colors.primaryDark, fontWeight: '700' },
});
