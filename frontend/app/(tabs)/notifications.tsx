import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { theme } from "../../constants/theme";

type Notif = {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info" | "success";
  icon: string;
  title: string;
  message: string;
  branch_id?: string;
  branch_name?: string;
  employee_id?: string;
  phone?: string;
  link?: string;
  read: boolean;
  created_at: string;
};

const SEV_META: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: theme.colors.semantic.danger, bg: theme.colors.semantic.dangerBg, label: "Critical" },
  warning:  { color: theme.colors.semantic.warning, bg: theme.colors.semantic.warningBg, label: "Warning" },
  info:     { color: theme.colors.brand.primary, bg: theme.colors.brand.primaryMuted, label: "Info" },
  success:  { color: theme.colors.semantic.success, bg: theme.colors.semantic.successBg, label: "Good news" },
};

export default function Notifications() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    try {
      const r = await api.get("/notifications");
      setItems(r.data.notifications || []);
    } catch (e: any) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (n: Notif) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try { await api.post("/notifications/read", { notification_id: n.id }); } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch (e: any) {
      Alert.alert("Error", "Could not mark all as read");
    }
  };

  const openLink = (n: Notif) => {
    markRead(n);
    const map: Record<string, string> = {
      inventory: "/(tabs)/inventory",
      expenses: "/(tabs)/expenses",
      employees: "/(tabs)/employees",
      dashboard: "/(tabs)/dashboard",
      integrations: "/(tabs)/integrations",
    };
    const route = map[n.link || ""];
    if (route) router.push(route as any);
  };

  const callStaff = async (phone?: string) => {
    if (!phone) { Alert.alert("No phone", "This staff member has no phone number on file."); return; }
    const clean = phone.replace(/[^0-9+]/g, "");
    const url = `tel:${clean}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert("Unavailable", "Phone dialer is not available on this device.");
  };

  const filtered = items.filter((n) => (filter === "unread" ? !n.read : true));
  const unreadCount = items.filter((n) => !n.read).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="notif-back"
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.sub}>{unreadCount} unread · {items.length} total</Text>
        </View>
        <TouchableOpacity
          testID="notif-settings-btn"
          onPress={() => router.push("/(tabs)/settings")}
          style={styles.iconBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="settings-outline" size={20} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Filter + mark all */}
      <View style={styles.filterRow}>
        <View style={styles.tabs}>
          {(["all", "unread"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              testID={`notif-filter-${f}`}
              onPress={() => setFilter(f)}
              style={[styles.tab, filter === f && styles.tabActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, filter === f && styles.tabTextActive]}>
                {f === "all" ? "All" : `Unread · ${unreadCount}`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity testID="notif-mark-all-read" onPress={markAllRead}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl tintColor="#fff" refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }} />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={48} color={theme.colors.text.tertiary} />
            <Text style={styles.emptyTitle}>You're all caught up</Text>
            <Text style={styles.emptySub}>No {filter === "unread" ? "unread " : ""}notifications right now.</Text>
          </View>
        ) : filtered.map((n) => {
          const meta = SEV_META[n.severity] || SEV_META.info;
          return (
            <TouchableOpacity
              key={n.id}
              testID={`notif-item-${n.type}`}
              onPress={() => openLink(n)}
              activeOpacity={0.85}
              style={[styles.card, !n.read && styles.cardUnread]}
            >
              <View style={[styles.sevDot, { backgroundColor: meta.color }]} />
              <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                <Ionicons name={n.icon as any} size={20} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{n.title}</Text>
                  {!n.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.cardMsg} numberOfLines={3}>{n.message}</Text>
                {n.type === "staff_absent" && n.phone && (
                  <TouchableOpacity
                    testID={`notif-call-${n.employee_id}`}
                    onPress={() => callStaff(n.phone)}
                    style={styles.callBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="call" size={14} color="#fff" />
                    <Text style={styles.callBtnText}>Call {n.phone}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.footNote}>
          Notifications refresh every 30 seconds. Configure what you see in Settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: theme.colors.text.primary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 2 },
  filterRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 8,
  },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  tabActive: { backgroundColor: theme.colors.brand.primaryMuted, borderColor: theme.colors.brand.primary },
  tabText: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: theme.colors.brand.primary },
  markAll: { color: theme.colors.brand.primary, fontSize: 12, fontWeight: "700" },

  card: {
    flexDirection: "row", gap: 12, padding: 14, marginBottom: 10,
    backgroundColor: theme.colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden",
  },
  cardUnread: { borderColor: theme.colors.brand.primary + "55", backgroundColor: "rgba(249,115,22,0.04)" },
  sevDot: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700", flex: 1 },
  cardMsg: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.brand.primary },

  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    backgroundColor: theme.colors.semantic.success, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, marginTop: 10,
  },
  callBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { color: theme.colors.text.primary, fontSize: 15, fontWeight: "700", marginTop: 8 },
  emptySub: { color: theme.colors.text.tertiary, fontSize: 12 },
  footNote: { color: theme.colors.text.tertiary, fontSize: 11, textAlign: "center", marginTop: 14, fontStyle: "italic" },
});
