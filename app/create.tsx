import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORIES } from '@/src/categories';
import { Chip, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { DataError } from '@/src/data';
import type { GeoPoint, PinCategory, PinKind, Vertical } from '@/src/data/types';
import {
  formatGeoPoint,
  inPilotOblast,
  isKharkivPoint,
  isValidGeoPoint,
  isValidUaPhone,
  KHARKIV,
  normalizeUaPhone,
  projectToPilot,
  uaPhoneNationalDigits,
  unprojectFromPilot,
} from '@/src/geo';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function CreatePinScreen() {
  const { session, profile, api } = useData();
  const params = useLocalSearchParams<{ vertical?: string; kind?: string; id?: string }>();
  const editing = Boolean(params.id);
  const [kind, setKind] = useState<PinKind>(params.kind === 'offer' ? 'offer' : 'seek');
  const [vertical, setVertical] = useState<Vertical>(params.vertical === 'service' ? 'service' : 'work');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [pay, setPay] = useState('');
  const [phone, setPhone] = useState(() => uaPhoneNationalDigits(profile?.phone));
  const [category, setCategory] = useState<PinCategory>('other');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [geog, setGeog] = useState<GeoPoint | null>(null);
  const [city, setCity] = useState('');
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<'pending' | 'gps' | 'map' | 'kharkiv' | 'saved'>('pending');
  const [picking, setPicking] = useState(false);
  const [plotSize, setPlotSize] = useState({ w: 1, h: 1 });
  const userPickedLocation = useRef(false);
  const didInitLocation = useRef(false);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void api.getQuota().then((q) => setQuota({ used: q.used, limit: q.limit }));
  }, [api, session]);

  useEffect(() => {
    if (!params.id) return;
    void api.getPin(params.id).then((pin) => {
      if (!pin) return;
      setKind(pin.kind);
      setVertical(pin.vertical);
      setTitle(pin.title);
      setDescription(pin.description);
      setSchedule(pin.schedule);
      setPay(pin.payAmount != null ? String(Math.round(pin.payAmount)) : '');
      setPhone(uaPhoneNationalDigits(pin.contactPhone));
      setCategory(pin.category);
      setAutoRenew(pin.autoRenew !== false);
      if (isValidGeoPoint(pin.geog)) {
        setGeog(pin.geog);
        setCity(pin.city);
        if (isKharkivPoint(pin.geog) || pin.city === 'Харків') {
          setLocationSource('kharkiv');
          setLocationNote(t('pinNearKharkiv'));
        } else {
          setLocationSource('saved');
          setLocationNote(null);
        }
      }
    });
  }, [api, params.id]);

  const applyKharkivFallback = useCallback((note: string) => {
    setGeog(KHARKIV);
    setCity('Харків');
    setLocationSource('kharkiv');
    setLocationNote(note);
  }, []);

  const locateMe = useCallback(async (fromUser = false) => {
    if (fromUser) userPickedLocation.current = true;
    setPicking(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!fromUser && userPickedLocation.current) return;
        applyKharkivFallback(t('gpsDeniedPin'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!fromUser && userPickedLocation.current) return;
      if (!isValidGeoPoint(next) || !inPilotOblast(next.lat, next.lng)) {
        applyKharkivFallback(t('gpsOutsidePilotPin'));
        return;
      }
      setGeog(next);
      setCity('');
      setLocationSource('gps');
      setLocationNote(null);
    } catch {
      if (!fromUser && userPickedLocation.current) return;
      applyKharkivFallback(t('gpsDeniedPin'));
    }
  }, [applyKharkivFallback]);

  useEffect(() => {
    if (editing || userPickedLocation.current) return;
    if (profile?.lastGeog && isValidGeoPoint(profile.lastGeog)) {
      setGeog(profile.lastGeog);
      if (isKharkivPoint(profile.lastGeog)) {
        setCity('Харків');
        setLocationSource('kharkiv');
        setLocationNote(t('pinNearKharkiv'));
      } else {
        setCity('');
        setLocationSource('saved');
        setLocationNote(null);
      }
      didInitLocation.current = true;
      return;
    }
    if (didInitLocation.current) return;
    didInitLocation.current = true;
    void locateMe(false);
  }, [editing, locateMe, profile?.lastGeog]);

  function onPlotPress(locationX: number, locationY: number) {
    const next = unprojectFromPilot(locationX / plotSize.w, locationY / plotSize.h);
    if (!isValidGeoPoint(next)) return;
    userPickedLocation.current = true;
    setGeog(next);
    setCity('');
    setLocationSource('map');
    setLocationNote(null);
    setPicking(false);
  }

  async function save() {
    setError(null);
    const contactPhone = normalizeUaPhone(phone);
    if (!title.trim()) {
      setError('Назва обовʼязкова');
      return;
    }
    if (!isValidUaPhone(contactPhone)) {
      setError('Телефон мітки: +380 і 9 цифр');
      return;
    }
    const payAmount = pay.trim() === '' ? null : Number(pay.replace(/\s/g, ''));
    if (payAmount != null && Number.isNaN(payAmount)) {
      setError('Оплата — лише цифри');
      return;
    }
    if (!isValidGeoPoint(geog)) {
      setError(t('locationMissing'));
      return;
    }
    setBusy(true);
    try {
      if (editing && params.id) {
        await api.updatePin(params.id, {
          kind,
          title: title.trim(),
          category,
          description: description.trim(),
          schedule: schedule.trim(),
          payAmount,
          contactPhone,
          geog,
          city,
          autoRenew,
        });
        try {
          await api.updateProfile({ lastGeog: geog });
        } catch {
          // pin already saved
        }
        router.replace(`/pin/${params.id}`);
      } else {
        const created = await api.createPin({
          kind,
          vertical,
          title: title.trim(),
          category,
          description: description.trim(),
          schedule: schedule.trim(),
          payAmount,
          contactPhone,
          geog,
          city,
          autoRenew,
        });
        try {
          await api.updateProfile({ lastGeog: geog });
        } catch {
          // pin already saved
        }
        router.replace(`/pin/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Не збережено');
    } finally {
      setBusy(false);
    }
  }

  const marker = geog ? projectToPilot(geog.lat, geog.lng) : null;
  const locationSummary =
    locationSource === 'pending' && !isValidGeoPoint(geog)
      ? ''
      : !isValidGeoPoint(geog)
        ? t('locationMissing')
        : locationSource === 'kharkiv' || isKharkivPoint(geog)
          ? `${t('pinNearKharkiv')} (${formatGeoPoint(geog)})`
          : locationSource === 'map'
            ? `${t('fromMap')} · ${formatGeoPoint(geog)}`
            : locationSource === 'gps'
              ? `${t('fromHere')} · ${formatGeoPoint(geog)}`
              : formatGeoPoint(geog);

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Title>{editing ? t('edit') : t('createPin')}</Title>
        {quota && !editing ? (
          <Muted style={styles.quota}>
            {t('quota')}: {quota.used} з {quota.limit}
          </Muted>
        ) : (
          <Muted style={styles.quota}>{editing ? 'Олівець не зʼїдає квоту' : ''}</Muted>
        )}
        <View style={styles.row}>
          <Chip label={t('seek')} selected={kind === 'seek'} onPress={() => setKind('seek')} />
          <Chip label={t('offer')} selected={kind === 'offer'} onPress={() => setKind('offer')} />
        </View>
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              label={t(c.label)}
              selected={category === c.id}
              onPress={() => setCategory(c.id)}
            />
          ))}
        </View>
        <Field label={t('title')} value={title} onChange={setTitle} />
        <Field label={t('description')} value={description} onChange={setDescription} multiline />
        <Field label={t('schedule')} value={schedule} onChange={setSchedule} />
        <View>
          <Text style={styles.label}>{t('pay')}</Text>
          <View style={styles.payRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              keyboardType="numeric"
              value={pay}
              onChangeText={setPay}
              placeholder="12000"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.uah}>{t('uah')}</Text>
          </View>
        </View>
        <View>
          <Text style={styles.label}>{t('phone')}</Text>
          <View style={styles.payRow}>
            <Text style={styles.uah}>+380</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              keyboardType="phone-pad"
              value={phone.replace(/^\+380/, '')}
              onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 9))}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t('location')}</Text>
          <View style={styles.row}>
            <Chip label={t('pickOnMap')} selected={picking || locationSource === 'map'} onPress={() => setPicking(true)} />
            <Chip label={t('nearMe')} selected={locationSource === 'gps'} onPress={() => void locateMe(true)} />
          </View>
          {locationNote ? <Muted style={styles.hint}>{locationNote}</Muted> : null}
          <Muted style={styles.hint}>{locationSummary}</Muted>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('pickOnMap')}
            style={styles.plot}
            onPress={(e) => {
              onPlotPress(e.nativeEvent.locationX, e.nativeEvent.locationY);
            }}
            onLayout={(e) => {
              setPlotSize({
                w: e.nativeEvent.layout.width || 1,
                h: e.nativeEvent.layout.height || 1,
              });
            }}
          >
            {marker ? (
              <View style={[styles.dot, { left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }]} />
            ) : null}
            <Muted style={styles.plotHint}>{t('locationPlotHint')}</Muted>
          </Pressable>
        </View>
        <View style={styles.row}>
          <Chip
            label={autoRenew ? t('autoRenewOn') : t('autoRenewOff')}
            selected={autoRenew}
            onPress={() => setAutoRenew((v) => !v)}
          />
        </View>
        <Muted style={styles.hint}>{autoRenew ? t('renewNotice') : t('silentArchive')}</Muted>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <PrimaryButton label={t('save')} disabled={busy} onPress={() => void save()} />
      </ScrollView>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline ? styles.multi : null]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  quota: { marginVertical: 12 },
  hint: { marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  field: { marginBottom: 12 },
  label: { fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  uah: { fontSize: 20, fontWeight: '700', color: colors.primaryDark },
  err: { color: colors.danger, marginBottom: 12 },
  plot: {
    backgroundColor: colors.map,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 180,
    marginBottom: 8,
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
});
