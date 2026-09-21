import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Body, Muted, PrimaryButton, Screen, Title } from '@/src/components/ui';
import { DataError } from '@/src/data';
import { isValidUaPhone, normalizeUaPhone } from '@/src/geo';
import { t } from '@/src/i18n';
import { isEmailAuthFlagEnabled, isEmailOtpUiEnabled } from '@/src/lib/auth-flags';
import { isValidEmail, normalizeEmail } from '@/src/lib/email';
import { useData } from '@/src/session';
import { colors } from '@/src/theme';

export default function LoginScreen() {
  const { api, backend, session } = useData();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [phoneTail, setPhoneTail] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [channel, setChannel] = useState<'phone' | 'email'>(
    isEmailAuthFlagEnabled() ? 'email' : 'phone',
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [smsFailed, setSmsFailed] = useState(false);

  const phone = normalizeUaPhone(phoneTail.startsWith('+') ? phoneTail : `+380${phoneTail}`);
  const emailOtp = isEmailOtpUiEnabled(backend);

  useEffect(() => {
    if (session) router.replace('/start');
  }, [session]);

  async function sendPhone() {
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
      setChannel('phone');
    } catch (e) {
      const message = e instanceof DataError ? e.message : 'Помилка OTP';
      setSmsFailed(true);
      setChannel('email');
      setSent(false);
      setError(`${t('smsUnavailable')} ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setError(null);
    const normalized = normalizeEmail(email);
    if (!isValidEmail(normalized)) {
      setError('Некоректний email');
      return;
    }
    setBusy(true);
    try {
      await api.sendEmailOtp(normalized);
      setSent(true);
      setChannel('email');
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Помилка листа');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      if (channel === 'email') {
        await api.verifyEmailOtp(normalizeEmail(email), code.trim());
      } else {
        await api.verifyOtp(normalizeUaPhone(phone), code.trim());
      }
      router.replace('/start');
    } catch (e) {
      setError(e instanceof DataError ? e.message : 'Помилка коду');
    } finally {
      setBusy(false);
    }
  }

  const showEmail = channel === 'email' || isEmailAuthFlagEnabled() || smsFailed;
  const showPhone = channel === 'phone' || !showEmail || isEmailAuthFlagEnabled();

  return (
    <Screen>
      <ScrollView keyboardShouldPersistTaps="handled">
      <Title>{params.mode === 'register' ? t('register') : t('login')}</Title>
      <Muted style={styles.hint}>
        {backend === 'supabase' ? t('liveHint') : t('mockHint')}
      </Muted>
      {params.mode === 'register' ? <Muted style={styles.registerHint}>{t('registerNoPassword')}</Muted> : null}

      {showPhone && channel === 'phone' ? (
        <>
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
              editable={!sent}
            />
          </View>
        </>
      ) : null}

      {showEmail && channel === 'email' ? (
        <>
          {smsFailed ? <Body style={styles.warn}>{t('smsUnavailable')}</Body> : null}
          <Body style={styles.label}>{t('email')}</Body>
          <TextInput
            style={styles.inputFull}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="name@example.com"
            placeholderTextColor={colors.muted}
            value={email}
            onChangeText={setEmail}
            editable={!sent}
          />
        </>
      ) : null}

      {!sent ? (
        <PrimaryButton
          label={channel === 'email' ? (emailOtp ? t('sendEmailOtp') : t('sendEmailLink')) : t('sendOtp')}
          disabled={busy}
          onPress={() => void (channel === 'email' ? sendEmail() : sendPhone())}
        />
      ) : channel === 'email' && !emailOtp ? (
        <View style={styles.gap}>
          <Body style={styles.linkSent}>{t('emailLinkSent')}</Body>
          <Muted style={styles.sentHint}>{t('emailLinkWait')}</Muted>
        </View>
      ) : (
        <View style={styles.gap}>
          <Body style={styles.label}>{channel === 'email' ? t('otpEmail') : t('otp')}</Body>
          {channel === 'email' ? (
            <Muted style={styles.sentHint}>
              {backend === 'supabase' ? t('emailLinkSent') : t('emailSentHint')}
            </Muted>
          ) : null}
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

      {!sent ? (
        <Pressable
          onPress={() => {
            setError(null);
            setSent(false);
            setCode('');
            setChannel((c) => (c === 'email' ? 'phone' : 'email'));
          }}
          style={styles.switch}
        >
          <Muted>{channel === 'email' ? t('usePhone') : t('useEmail')}</Muted>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => {
            setSent(false);
            setCode('');
            setError(null);
          }}
          style={styles.switch}
        >
          <Muted>{t('resend')}</Muted>
        </Pressable>
      )}

      {error ? <Body style={styles.err}>{error}</Body> : null}
      <View style={styles.links}>
        <Muted onPress={() => void Linking.openURL('https://socbizmap.com')}>
          {t('privacy')} · {t('offerLink')}
        </Muted>
        <Muted>{t('tm')}</Muted>
      </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: 8, marginBottom: 12 },
  registerHint: { marginBottom: 20 },
  label: { marginBottom: 6, fontWeight: '700' },
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
  sentHint: { marginBottom: 8 },
  linkSent: { fontSize: 17, lineHeight: 24, marginBottom: 8 },
  err: { color: colors.danger, marginTop: 12 },
  warn: { color: colors.warn, marginBottom: 12 },
  switch: { marginTop: 16, paddingVertical: 8 },
  links: { marginTop: 32, gap: 8 },
});
