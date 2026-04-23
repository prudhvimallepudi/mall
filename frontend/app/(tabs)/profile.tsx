import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { theme } from "../../constants/theme";
import { AVATARS } from "../../constants/avatars";
import { Avatar } from "../../components/Avatar";
import { useAiContext } from "../../lib/aiContext";

export default function Profile() {
  const { setKey } = useAiContext();
  useEffect(() => { setKey("profile"); }, [setKey]);
  const { user, updateUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [avatarId, setAvatarId] = useState<string | null>(user?.avatar_id || null);
  const [businessName, setBusinessName] = useState(user?.business_name || "");
  const [gst, setGst] = useState(user?.gst_number || "");
  const [logoUrl, setLogoUrl] = useState(user?.logo_url || "");
  const [saving, setSaving] = useState(false);

  if (!user) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View></SafeAreaView>;
  }

  const save = async () => {
    try {
      setSaving(true);
      const r = await api.patch("/profile", {
        name: name.trim() || user.name,
        avatar_id: avatarId,
        business_name: businessName.trim(),
        gst_number: gst.trim(),
        logo_url: logoUrl.trim(),
      });
      updateUser(r.data);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header with avatar + gradient */}
        <LinearGradient
          colors={["rgba(236, 72, 153, 0.15)", "rgba(139, 92, 246, 0.08)", "transparent"]}
          style={styles.heroGradient}
        >
          <View style={styles.heroInner}>
            <Avatar avatarId={avatarId} name={name} size={96} />
            <Text style={styles.heroName}>{name || user.name}</Text>
            <Text style={styles.heroEmail}>{user.email}</Text>
            {businessName ? <Text style={styles.heroBusiness}>{businessName}</Text> : null}
          </View>
        </LinearGradient>

        {/* Avatar selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Choose Avatar</Text>
          <Text style={styles.cardSub}>Pick a vibe for your dashboard</Text>
          <View style={styles.avatarGrid}>
            {AVATARS.map((a) => {
              const selected = avatarId === a.id;
              return (
                <TouchableOpacity
                  key={a.id}
                  testID={`avatar-${a.id}`}
                  onPress={() => setAvatarId(a.id)}
                  style={[
                    styles.avatarCell,
                    { backgroundColor: a.bg },
                    selected && styles.avatarSelected,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 28 }}>{a.emoji}</Text>
                  {selected && (
                    <View style={styles.checkDot}>
                      <Ionicons name="checkmark" size={12} color="#0A0A0A" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Personal info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Info</Text>
          <Field label="Display Name" testID="profile-name-input" value={name} onChangeText={setName} />
          <Field label="Email" value={user.email} editable={false} />
        </View>

        {/* Business info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Business Details</Text>
          <Text style={styles.cardSub}>Shown on AI-generated reports & invoices</Text>
          <Field label="Restaurant / Hotel Name" testID="profile-business-input" value={businessName} onChangeText={setBusinessName} placeholder="e.g. Spice Garden" />
          <Field label="GST Number" testID="profile-gst-input" value={gst} onChangeText={setGst} placeholder="22AAAAA0000A1Z5" autoCapitalize="characters" />
          <Field label="Logo URL (optional)" testID="profile-logo-input" value={logoUrl} onChangeText={setLogoUrl} placeholder="https://..." autoCapitalize="none" />
        </View>

        <TouchableOpacity
          testID="profile-save-button"
          onPress={save}
          disabled={saving}
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity testID="profile-logout" onPress={logout} style={styles.logoutBtn} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.semantic.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label, value, onChangeText, testID, editable = true, placeholder, autoCapitalize,
}: any) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.text.tertiary}
        autoCapitalize={autoCapitalize || "sentences"}
        style={[styles.input, !editable && styles.inputDisabled]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingBottom: 40 },
  heroGradient: { paddingTop: 24, paddingBottom: 32 },
  heroInner: { alignItems: "center" },
  heroName: { color: theme.colors.text.primary, fontSize: 22, fontWeight: "800", marginTop: 14, letterSpacing: -0.5 },
  heroEmail: { color: theme.colors.text.secondary, fontSize: 13, marginTop: 4 },
  heroBusiness: {
    color: theme.colors.brand.primary, fontSize: 12, fontWeight: "700", marginTop: 8,
    backgroundColor: theme.colors.brand.primaryMuted, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    overflow: "hidden",
  },
  card: {
    marginHorizontal: 24, marginTop: 16, backgroundColor: theme.colors.surface,
    borderRadius: 12, padding: 18, borderWidth: 1, borderColor: theme.colors.border,
  },
  cardTitle: { color: theme.colors.text.primary, fontSize: 16, fontWeight: "700" },
  cardSub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 4 },
  avatarGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, gap: 12 },
  avatarCell: {
    width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center",
    marginRight: 10, marginBottom: 10, borderWidth: 2, borderColor: "transparent",
  },
  avatarSelected: { borderColor: theme.colors.text.primary },
  checkDot: {
    position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: theme.colors.background,
  },
  fieldLabel: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" },
  input: {
    backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
    color: theme.colors.text.primary, padding: 12, borderRadius: 10, fontSize: 14,
  },
  inputDisabled: { color: theme.colors.text.tertiary },
  saveBtn: {
    marginHorizontal: 24, marginTop: 20, backgroundColor: theme.colors.brand.primary,
    paddingVertical: 15, borderRadius: 10, alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  logoutBtn: {
    marginHorizontal: 24, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 13, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.semantic.dangerBg,
    gap: 8,
  },
  logoutText: { color: theme.colors.semantic.danger, fontWeight: "700", fontSize: 14 },
});
