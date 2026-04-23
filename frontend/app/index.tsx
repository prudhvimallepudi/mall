import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ImageBackground, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";

const IS_WEB = Platform.OS === "web";
import { useRouter } from "expo-router";
import { theme } from "../constants/theme";
import { useAuth } from "../lib/auth";
import { LinearGradient } from "expo-linear-gradient";
import { RHLogo } from "../components/RHLogo";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const AUTH_BG =
  "https://images.unsplash.com/photo-1759922221495-78755ac90d70?crop=entropy&cs=srgb&fm=jpg&q=85";

export default function Login() {
  const router = useRouter();
  const { user, loading, loginWithSessionId, demoLogin } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");

  // Handle session_id in URL fragment after Google redirect (web only)
  useEffect(() => {
    if (!IS_WEB || typeof window === "undefined") return;
    const hash = window.location.hash || "";
    if (hash.includes("session_id=")) {
      const sid = hash.split("session_id=")[1].split("&")[0];
      (async () => {
        try {
          setBusy(true);
          await loginWithSessionId(sid);
          // Clear fragment
          window.history.replaceState(null, "", window.location.pathname);
          router.replace("/(tabs)/dashboard");
        } catch (e: any) {
          Alert.alert("Login failed", e?.message || "Unable to complete sign-in");
        } finally {
          setBusy(false);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, loading]);

  const handleGoogle = () => {
    if (!IS_WEB || typeof window === "undefined") {
      Alert.alert("Web only", "Google sign-in redirect works in the web preview. Use Demo access on Expo Go.");
      return;
    }
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleDemo = async () => {
    if (!email.includes("@")) {
      Alert.alert("Enter email", "Please enter a valid email to continue with demo access.");
      return;
    }
    try {
      setBusy(true);
      await demoLogin(email.trim().toLowerCase());
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  if (loading || busy) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.brand.primary} size="large" />
        <Text style={styles.loadingText}>Signing you in…</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={{ uri: AUTH_BG }} style={styles.bg} resizeMode="cover">
      <LinearGradient
        colors={["rgba(10,10,10,0.6)", "rgba(10,10,10,0.92)", "rgba(10,10,10,1)"]}
        locations={[0, 0.55, 1]}
        style={styles.overlay}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          <View style={styles.topBlock}>
            <View style={styles.logoRow}>
              <RHLogo size={48} showWordmark wordmarkColor={theme.colors.text.primary} testID="login-rh-logo" />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>RESTROHUB • RESTAURANT OS</Text>
            </View>
            <Text style={styles.title}>Run your restaurant{"\n"}like a Fortune 500.</Text>
            <Text style={styles.subtitle}>
              RestroHub — one dashboard for sales, inventory, expenses and AI insights.
            </Text>
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.formLabel}>Sign in with your Gmail</Text>
            <TextInput
              testID="login-email-input"
              placeholder="you@gmail.com"
              placeholderTextColor={theme.colors.text.tertiary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TouchableOpacity
              testID="login-demo-button"
              style={styles.primaryBtn}
              onPress={handleDemo}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Enter Dashboard →</Text>
            </TouchableOpacity>

            <Text style={styles.footNote}>
              New accounts are seeded with 3 branches, 90 days of sales, menu & expense data.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: theme.colors.background },
  overlay: { flex: 1, paddingHorizontal: 28, paddingVertical: 48, justifyContent: "space-between" },
  kav: { flex: 1, justifyContent: "space-between" },
  container: { flex: 1, backgroundColor: theme.colors.background, padding: 24 },
  center: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: theme.colors.text.secondary, marginTop: 12 },
  topBlock: { marginTop: 40 },
  logoRow: { marginBottom: 20 },
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 24,
  },
  badgeText: { color: theme.colors.text.primary, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  title: { color: theme.colors.text.primary, fontSize: 34, fontWeight: "800", lineHeight: 40, letterSpacing: -1 },
  subtitle: { color: theme.colors.text.secondary, fontSize: 15, marginTop: 14, lineHeight: 22, maxWidth: 340 },
  formBlock: { marginBottom: 20 },
  formLabel: {
    color: theme.colors.text.secondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 10,
  },
  googleBtn: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#EA4335" },
  googleText: { color: "#0A0A0A", fontSize: 15, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dividerText: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1 },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.brand.primary,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  footNote: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 14, textAlign: "center", lineHeight: 16 },
});
