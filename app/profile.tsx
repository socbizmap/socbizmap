import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PinRow } from '@/src/components/PinRow';
import { Chip, GhostButton, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { daysUntilExpiry, isCabinetActive, pinNeedsContinue } from '@/src/data/renewal';
import type { ChatThread, Pin, Quota } from '@/src/data/types';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function ProfileScreen() {
  const { api, session, profile, backend } = useData();
  const [pins, setPins] = useState<Pin[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!session) return;
    const [mine, q, chats] = await Promise.all([
      api.listMyPins(),
      api.getQuota(),
      api.listThreads(),
    ]);
    setPins(mine);
    setQuota(q);
    setThreads(chats);
  }, [api, session]);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    void reload();
  }, [reload, session]);

  async function logout() {
    await api.unregisterDevice();
    await api.signOut();
    router.replace('/');
  }

  async function onContinue(id: string) {
    setBusyId(id);
    try {
      await api.continuePin(id);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  async function onToggleRenew(pin: Pin) {
    setBusyId(pin.id);
    try {
      await api.updatePin(pin.id, { autoRenew: !pin.autoRenew });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (!profile) {
    return (
      <Screen>
        <Muted>…</Muted>
      </Screen>
    );
  }

  const active = pins.filter(isCabinetActive);
  const archived = pins.filter((p) => p.status === 'archived');
  const expiring = active.filter((p) => pinNeedsContinue(p));

  return (
    <Screen>
      <ScrollView>
        <Title>{profile.displayName}</Title>
        <Muted>{t('cabinet')}</Muted>
        <Muted>{profile.phone ?? profile.email ?? session?.email}</Muted>
        <Muted>
          ★ {profile.ratingAvg.toFixed(1)} ({profile.ratingCount}) · радіус {profile.radiusKm} км
        </Muted>
        <Muted style={styles.backend}>
          {backend === 'supabase' ? t('backendLive') : t('backendMock')}
        </Muted>
        {quota ? (
          <Text style={styles.quota}>
            {t('quota')}: {quota.used} з {quota.limit} ({quota.plan === 'pro' ? 'PRO' : 'free'})
          </Text>
        ) : null}
        <View style={styles.row}>
          <Chip label={`${t('pro')} · ${t('soon')}`} />
        </View>
        <Muted>{t('language')}</Muted>
        <Chip label={t('englishSoon')} />
        {profile.role === 'admin' ? (
          <PrimaryButton label={t('adminQueue')} onPress={() => router.push('/admin')} />
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={styles.h}>{t('myChats')}</Text>
          <Pressable onPress={() => router.push('/chats')}>
            <Text style={styles.link}>{t('chat')}</Text>
          </Pressable>
        </View>
        {threads.length === 0 ? <Muted>{t('chatEmpty')}</Muted> : null}
        {threads.slice(0, 5).map((th) => (
          <Pressable
            key={`${th.pinId}:${th.peerId}`}
            style={styles.thread}
            onPress={() => router.push(`/chat/${th.pinId}?peer=${th.peerId}`)}
          >
            <Text style={styles.threadTitle} numberOfLines={1}>
              {th.peerName} · {th.pinTitle}
            </Text>
            <Muted numberOfLines={1}>{th.lastBody ?? t('noChatYet')}</Muted>
          </Pressable>
        ))}

        {expiring.length > 0 ? (
          <>
            <Text style={styles.h}>{t('renewNoticeShort')}</Text>
            <Muted style={styles.notice}>{t('renewNotice')}</Muted>
            {expiring.map((p) => (
              <CabinetPin
                key={`exp-${p.id}`}
                pin={p}
                busy={busyId === p.id}
                onContinue={() => void onContinue(p.id)}
                onToggleRenew={() => void onToggleRenew(p)}
              />
            ))}
          </>
        ) : null}

        <Text style={styles.h}>{t('activePins')}</Text>
        {active.filter((p) => !pinNeedsContinue(p)).length === 0 ? <Muted>—</Muted> : null}
        {active
          .filter((p) => !pinNeedsContinue(p))
          .map((p) => (
            <CabinetPin
              key={p.id}
              pin={p}
              busy={busyId === p.id}
              onToggleRenew={() => void onToggleRenew(p)}
            />
          ))}

        {archived.length > 0 ? (
          <>
            <Text style={styles.h}>{t('archivedPins')}</Text>
            {archived.map((p) => (
              <View key={p.id}>
                <PinRow pin={p} showStatus onPress={() => router.push(`/pin/${p.id}`)} />
              </View>
            ))}
          </>
        ) : null}

        <GhostButton label={t('logout')} onPress={() => void logout()} />
        <Muted style={styles.tm}>{t('tm')}</Muted>
      </ScrollView>
    </Screen>
  );
}

function CabinetPin({
  pin,
  busy,
  onContinue,
  onToggleRenew,
}: {
  pin: Pin;
  busy: boolean;
  onContinue?: () => void;
  onToggleRenew: () => void;
}) {
  const days = daysUntilExpiry(pin);
  return (
    <View>
      <PinRow pin={pin} showStatus onPress={() => router.push(`/pin/${pin.id}`)} />
      {days != null && pin.status === 'live' ? (
        <Muted style={styles.expiry}>
          {t('expiresIn')}: {days} {t('daysShort')}
          {pin.autoRenew ? '' : ` · ${t('silentArchive')}`}
        </Muted>
      ) : null}
      <View style={styles.pinActions}>
        <Pressable onPress={() => router.push(`/create?id=${pin.id}`)}>
          <Text style={styles.link}>✎ {t('edit')}</Text>
        </Pressable>
        <Pressable onPress={onToggleRenew} disabled={busy}>
          <Text style={styles.link}>{pin.autoRenew ? t('autoRenewOn') : t('autoRenewOff')}</Text>
        </Pressable>
      </View>
      {onContinue ? (
        <View style={styles.continueWrap}>
          <PrimaryButton label={t('continuePin')} disabled={busy} onPress={onContinue} />
        </View>
      ) : null}
      {pin.status === 'live' && !onContinue ? (
        <Text style={styles.soon}>{t('highlight')} · {t('soon')}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backend: { marginTop: 8 },
  quota: { marginVertical: 12, fontWeight: '700', color: colors.text },
  row: { marginBottom: 12 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  h: { fontSize: 18, fontWeight: '700', color: colors.text, marginVertical: 12 },
  notice: { marginBottom: 8 },
  thread: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  threadTitle: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  pinActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  link: { color: colors.primaryDark, fontWeight: '700' },
  expiry: { marginBottom: 6, paddingHorizontal: 4 },
  continueWrap: { marginBottom: 12 },
  soon: { color: colors.muted, marginBottom: 12, paddingHorizontal: 4 },
  tm: { marginTop: 24, marginBottom: 12 },
});
