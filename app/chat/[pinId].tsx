import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Muted, Screen, Title } from '@/src/components/ui';
import { DataError } from '@/src/data';
import type { ChatMessage, Pin } from '@/src/data/types';
import { t } from '@/src/i18n';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function ChatScreen() {
  const { pinId } = useLocalSearchParams<{ pinId: string }>();
  const { peer } = useLocalSearchParams<{ peer?: string }>();
  const { api, session } = useData();
  const [pin, setPin] = useState<Pin | null>(null);
  const [peerId, setPeerId] = useState<string | null>(peer ?? null);
  const [peerName, setPeerName] = useState(t('chatPeer'));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!pinId) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const opened = await api.openPinThread(pinId, peer || undefined);
        if (cancelled) return;
        setPeerId(opened.peerId);
        const [p, profile] = await Promise.all([
          api.getPin(pinId),
          api.getProfile(opened.peerId),
        ]);
        if (cancelled) return;
        setPin(p);
        if (profile?.displayName) setPeerName(profile.displayName);
        unsub = api.subscribeMessages(pinId, opened.peerId, (rows) => {
          setMessages(rows);
          setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof DataError ? e.message : t('chatForbidden'));
        }
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [api, peer, pinId, session]);

  async function send() {
    if (!pinId || !peerId || busy) return;
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const sent = await api.sendMessage(pinId, peerId, text);
      setDraft('');
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      setError(e instanceof DataError ? e.message : t('chatForbidden'));
    } finally {
      setBusy(false);
    }
  }

  const me = session?.userId;

  return (
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable onPress={() => pin && router.push(`/pin/${pin.id}`)}>
          <Title style={styles.title}>{peerName}</Title>
          <Muted>
            {t('threadAbout')}: {pin?.title ?? '…'}
          </Muted>
        </Pressable>
        <ScrollView ref={scroll} style={styles.list} contentContainerStyle={styles.listContent}>
          {messages.length === 0 ? <Muted style={styles.empty}>{t('noChatYet')}</Muted> : null}
          {messages.map((m) => {
            const mine = m.senderId === me;
            return (
              <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.body, mine ? styles.mineText : styles.theirsText]}>{m.body}</Text>
              </View>
            );
          })}
        </ScrollView>
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chatPlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void send()}
            disabled={busy || !draft.trim()}
            style={[styles.send, busy || !draft.trim() ? styles.sendOff : null]}
          >
            <Text style={styles.sendLabel}>{t('send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 8 },
  flex: { flex: 1 },
  title: { fontSize: 22 },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingBottom: 16 },
  empty: { marginTop: 24 },
  bubble: {
    maxWidth: '86%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  body: { fontSize: 16, lineHeight: 22 },
  mineText: { color: '#fff' },
  theirsText: { color: colors.text },
  err: { color: colors.danger, marginBottom: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  send: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendOff: { opacity: 0.45 },
  sendLabel: { color: '#fff', fontWeight: '700' },
});
