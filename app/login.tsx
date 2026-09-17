import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, TextInput, View } from 'react-native';

import { DataError } from '@/src/data';
import { isValidUaPhone, normalizeUaPhone } from '@/src/geo';
import { t } from '@/src/i18n';
import { Body, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function LoginScreen() {
  const { api, backend } = useData();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [phoneTail, setPhoneTail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const phone = normalizeUaPhone(phoneTail.startsWith('+') ? phoneTail : `+380${phoneTail}`);

  async function send() {
    setError(null);
    const normalized = normalizeUaPhone(phone);
    if (!isValidUaPhone(normalized)) {
      setError('Формат: +380 і 9 цифр');
      return;
    }
    setBusy(true);
    try {
      await api.sendOtp(normalized);
      setSent(true);
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Помилка OTP');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      await api.verifyOtp(normalizeUaPhone(phone), code.trim());
      router.replace('/start');
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Помилка коду');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{params.mode === 'register' ? t('register') : t('login')}</Title>
      <Muted style={styles.hint}>
        {backend === 'supabase' ? t('liveHint') : t('mockHint')}
      </Muted>
      <Body style={styles.label}>{t('phone')}</Body>
      <View style={styles.phoneRow}>
        <Body style={styles.prefix}>+380</Body>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="501234567"
          placeholderTextColor={colors.muted}
          value={phoneTail.replace(/^\+380/, '')}
          onChangeText={(v) => setPhoneTail(v.replace(/\D/g, '').slice(0, 9))}
          maxLength={9}
        />
      </View>
      {!sent ? (
        <PrimaryButton label={t('sendOtp')} disabled={busy} onPress={() => void send()} />
      ) : (
        <View style={styles.gap}>
          <Body style={styles.label}>{t('otp')}</Body>
          <TextInput
            style={styles.inputFull}
            keyboardType="number-pad"
            placeholder="123456"
            placeholderTextColor={colors.muted}
            value={code}
            onChangeText={setCode}
            maxLength={8}
          />
          <PrimaryButton label={t('verifyOtp')} disabled={busy} onPress={() => void verify()} />
        </View>
      )}
      {error ? <Body style={styles.err}>{error}</Body> : null}
      <View style={styles.links}>
        <Muted onPress={() => void Linking.openURL('https://socbizmap.com')}>
          {t('privacy')} · {t('offerLink')}
        </Muted>
        <Muted>{t('tm')}</Muted>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: 8, marginBottom: 24 },
  label: { marginBottom: 6, fontWeight: '600' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  prefix: { fontWeight: '700' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    color: colors.text,
  },
  inputFull: {
    backgroundColor: colors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    color: colors.text,
    marginBottom: 12,
  },
  gap: { marginTop: 8 },
  err: { color: colors.danger, marginTop: 12 },
  links: { marginTop: 32, gap: 8 },
});
