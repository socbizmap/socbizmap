import * as Location from 'expo-location';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PinRow } from '@/src/components/PinRow';
import { Chip, Muted, PrimaryButton, Screen } from '@/src/components/ui';
import type { Pin, PinKind, Vertical } from '@/src/data/types';
import { KHARKIV, projectToPilot } from '@/src/geo';
import { t } from '@/src/i18n';
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
  const radiusKm = profile?.radiusKm ?? 10;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => setView((v) => (v === 'map' ? 'list' : 'map'))} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>{view === 'map' ? '☰' : '⌖'}</Text>
        </Pressable>
      ),
    });
  }, [navigation, view]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (originMode !== 'gps') return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setOrigin(KHARKIV);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {
        if (!cancelled) setOrigin(KHARKIV);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [originMode]);

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
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.filters}>
        {kindLabels.map((k) => (
          <Chip key={k.id} label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
      </View>
      <TextInput
        style={styles.search}
        placeholder="Пошук"
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.chipRow}>
        <Chip
          label={originMode === 'gps' ? t('fromHere') : t('fromMap')}
          selected
          onPress={() => {
            setOriginMode('gps');
            setOrigin(KHARKIV);
          }}
        />
        <Chip label={t('pickOnMap')} selected={picking} onPress={() => setPicking(true)} />
      </View>
      {view === 'map' ? (
        <Pressable
          style={styles.plot}
          onPress={(e) => {
            const { locationX, locationY } = e.nativeEvent;
            // Approximate inverse of projectToPilot on a 1:1 plot; refined on layout below via percentages
            const w = plotSize.w || 1;
            const h = plotSize.h || 1;
            const x = locationX / w;
            const y = locationY / h;
            const lng = 34.85 + x * (38.1 - 34.85);
            const lat = 50.46 - y * (50.46 - 48.52);
            onPlotPress(lat, lng);
          }}
          onLayout={(e) => {
            plotSize.w = e.nativeEvent.layout.width;
            plotSize.h = e.nativeEvent.layout.height;
          }}
        >
          {pins.map((p) => {
            const { x, y } = projectToPilot(p.geog.lat, p.geog.lng);
            return (
              <Pressable
                key={p.id}
                style={[styles.dot, { left: `${x * 100}%`, top: `${y * 100}%` }]}
                onPress={() => router.push(`/pin/${p.id}`)}
              />
            );
          })}
          {(() => {
            const me = projectToPilot(origin.lat, origin.lng);
            return <View style={[styles.me, { left: `${me.x * 100}%`, top: `${me.y * 100}%` }]} />;
          })()}
          <Muted style={styles.plotHint}>Харківська область · пілот</Muted>
        </Pressable>
      ) : (
        <ScrollView style={styles.list}>
          {pins.length === 0 ? (
            <Muted style={styles.empty}>{t('noPinsNearby')}</Muted>
          ) : (
            pins.map((p) => (
              <PinRow key={p.id} pin={p} onPress={() => router.push(`/pin/${p.id}`)} />
            ))
          )}
        </ScrollView>
      )}
      <View style={styles.footer}>
        {session ? (
          <>
            <PrimaryButton
              label={t('createPin')}
              onPress={() => router.push(`/create?vertical=${vertical}&kind=${kind}`)}
            />
            <Pressable onPress={() => router.push('/profile')} style={styles.profileLink}>
              <Text style={styles.profileText}>{t('profile')}</Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton label={t('login')} onPress={() => router.push('/login')} />
        )}
      </View>
    </Screen>
  );
}

const plotSize = { w: 0, h: 0 };

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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  plot: {
    flex: 1,
    backgroundColor: colors.map,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 280,
  },
  plotHint: { position: 'absolute', left: 12, bottom: 12 },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    marginTop: -7,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  me: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: '#2563EB',
    borderWidth: 2,
    borderColor: '#fff',
  },
  list: { flex: 1 },
  empty: { marginTop: 24, textAlign: 'center' },
  footer: { marginTop: 12, gap: 8 },
  profileLink: { alignItems: 'center', padding: 8 },
  profileText: { color: colors.primaryDark, fontWeight: '700' },
});
