import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useOtpAutoFill, getAppHashAsync } from 'expo-otp-autofill';

const OTP_TIMEOUT = 30_000;

export default function App() {
  const [appHash, setAppHash] = useState<string>('');
  const [otpCountdown, setOtpCountdown] = useState<number>(0);

  // ─── OTP Zero-Permission Auto-detection ────────────────────────────────────
  const { otp, message: rawMessage, clear: clearOtp } = useOtpAutoFill({
    length: 6,
    timeout: OTP_TIMEOUT,
  });

  // Load app hash for Google Retriever formatting
  useEffect(() => {
    if (Platform.OS === 'android') {
      getAppHashAsync().then(setAppHash).catch(console.warn);
    }
  }, []);

  // Timer logic for OTP
  useEffect(() => {
    if (otp) {
      setOtpCountdown(OTP_TIMEOUT / 1000);
      const timer = setInterval(() => {
        setOtpCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setOtpCountdown(0);
    }
  }, [otp]);

  // ─── Render Helpers ────────────────────────────────────────────────────────
  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    console.log(`Copied ${label} to clipboard: ${text}`);
  };

  // iOS / Web fallback
  if (Platform.OS !== 'android') {
    return (
      <View style={styles.center}>
        <Text style={styles.unsupported}>
          Google SMS Retriever is only supported on Android.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>OTP Autofill</Text>
            <Text style={styles.subtitle}>Zero Permissions • SMS Retriever API</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        
        {/* ── Status Card ── */}
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Plugin Status</Text>
            <View style={[styles.badge, styles.badgeOn]}>
              <Text style={[styles.badgeText, styles.badgeTextOn]}>● Listening</Text>
            </View>
          </View>
        </View>

        {/* ── OTP Card ── */}
        <View style={[styles.card, otp ? styles.otpCard : null]}>
          {otp ? (
            <View>
              <View style={styles.otpHeader}>
                <View style={styles.otpBadge}>
                  <Text style={styles.otpBadgeText}>🔑 DETECTED</Text>
                </View>
                <Text style={styles.otpCountdown}>Expires in {otpCountdown}s</Text>
              </View>

              <View style={styles.digitsRow}>
                {otp.split('').map((digit, i) => (
                  <View key={i} style={styles.digitBox}>
                    <Text style={styles.digitText}>{digit}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.otpActions}>
                <TouchableOpacity
                  style={[styles.otpBtn, styles.otpBtnPrimary]}
                  onPress={() => copyToClipboard(otp, 'OTP')}
                >
                  <Text style={styles.otpBtnText}>Copy OTP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.otpBtn, styles.otpBtnDismiss]}
                  onPress={clearOtp}
                >
                  <Text style={[styles.otpBtnText, styles.otpBtnDismissText]}>
                    Dismiss
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.otpWaiting}>
              <Text style={styles.otpWaitingIcon}>⏳</Text>
              <View>
                <Text style={styles.otpWaitingTitle}>Listening for OTP...</Text>
                <Text style={styles.otpWaitingHint}>
                  Waiting for SMS containing the App Hash.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Captured SMS Message Card ── */}
        {rawMessage && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Raw SMS Intercepted</Text>
            <Text style={styles.sectionSubtitle}>Message sent to app without permissions</Text>
            <View style={styles.hashRow}>
              <Text style={styles.body}>{rawMessage}</Text>
            </View>
          </View>
        )}

        {/* ── App Hash Guide ── */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>App Hash Configuration</Text>
          <Text style={styles.sectionSubtitle}>
            To automatically route OTP SMS messages to your app without requesting
            permissions, your server must append this 11-character hash to the end
            of the SMS text.
          </Text>

          <View style={styles.hashRow}>
            <Text style={styles.hashValue} selectable>
              {appHash || 'Loading...'}
            </Text>
            {appHash ? (
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => copyToClipboard(appHash, 'App Hash')}
              >
                <Text style={styles.copyBtnText}>Copy</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.hashExample}>
            Example SMS format:{'\n'}
            "Your verification code is 123456. {appHash}"
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_RADIUS = 16;
const CARD_BG = '#fff';
const ACCENT = '#4F46E5';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  unsupported: { fontSize: 16, color: '#64748B', textAlign: 'center' },

  // Header
  header: { backgroundColor: '#1E293B', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: '#F8FAFC' },
  subtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  // Layout
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 40 },

  // Generic card
  card: { backgroundColor: CARD_BG, borderRadius: CARD_RADIUS, padding: 16, elevation: 1 },

  // Status
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  statusLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeOn: { backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgeTextOn: { color: '#16A34A' },

  // OTP detected card
  otpCard: { borderWidth: 2, borderColor: ACCENT },
  otpHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  otpBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  otpBadgeText: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  otpCountdown: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  digitsRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 20 },
  digitBox: {
    width: 44, height: 54, borderRadius: 10,
    backgroundColor: '#F8FAFF', borderWidth: 1.5, borderColor: ACCENT,
    justifyContent: 'center', alignItems: 'center', elevation: 1,
  },
  digitText: { fontSize: 26, fontWeight: '800', color: '#1E293B' },

  otpActions: { flexDirection: 'row', gap: 10 },
  otpBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  otpBtnPrimary: { backgroundColor: ACCENT },
  otpBtnDismiss: { backgroundColor: '#F1F5F9' },
  otpBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  otpBtnDismissText: { color: '#64748B' },

  // OTP waiting card
  otpWaiting: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  otpWaitingIcon: { fontSize: 32 },
  otpWaitingTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 3 },
  otpWaitingHint: { fontSize: 12, color: '#94A3B8', lineHeight: 18 },

  // App hash card
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 4 },
  sectionSubtitle: { fontSize: 12, color: '#94A3B8', marginBottom: 10, lineHeight: 17 },
  hashRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, gap: 10 },
  hashValue: { flex: 1, fontSize: 16, fontWeight: '800', color: '#1E293B', letterSpacing: 1 },
  copyBtn: { backgroundColor: ACCENT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  copyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hashExample: { marginTop: 8, fontSize: 11, color: '#94A3B8', fontStyle: 'italic', lineHeight: 17 },
  body: { fontSize: 13, color: '#475569', lineHeight: 19 },
});
