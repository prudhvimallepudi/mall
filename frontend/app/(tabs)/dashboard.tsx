import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions,
  RefreshControl, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LineChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { theme, chartConfig } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { BranchPicker, inr } from "../../components/BranchPicker";
import { Avatar } from "../../components/Avatar";
import { RHLogo } from "../../components/RHLogo";
import { NotificationBell } from "../../components/NotificationBell";
import { useAiContext } from "../../lib/aiContext";

const W = Dimensions.get("window").width;

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { setKey } = useAiContext();
  useEffect(() => { setKey("dashboard"); }, [setKey]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (bid = branchId) => {
    try {
      const [b, d] = await Promise.all([
        branches.length ? Promise.resolve({ data: branches }) : api.get("/branches"),
        api.get("/dashboard/summary", { params: { branch_id: bid } }),
      ]);
      if (!branches.length) setBranches(b.data);
      setData(d.data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branchId, branches]);

  useEffect(() => { load(branchId); }, [branchId]);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View>
      </SafeAreaView>
    );
  }

  const k = data.kpis;
  const salesLabels = (data.sales_7d || []).map((p: any) => p.date.slice(5));
  const salesValues = (data.sales_7d || []).map((p: any) => p.total);
  const pm = data.payment_modes || { cash: 0, upi: 0, card: 0 };
  const pmTotal = Math.max(pm.cash + pm.upi + pm.card, 1);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        refreshControl={
          <RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />
        }
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.brandBar}>
          <RHLogo size={32} showWordmark wordmarkColor={theme.colors.text.primary} testID="dashboard-rh-logo" />
          <View style={{ flex: 1 }} />
          <NotificationBell />
          <TouchableOpacity
            testID="dashboard-settings-btn"
            onPress={() => router.push("/(tabs)/settings")}
            style={styles.brandIconBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good day,</Text>
            <Text testID="dashboard-user-name" style={styles.name}>{user?.name?.split(" ")[0] || "Owner"}</Text>
            {user?.business_name ? <Text style={styles.business}>{user.business_name}</Text> : null}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
        </View>

        {/* KPI Grid */}
        <View style={styles.grid}>
          <Kpi testID="kpi-today-sales" label="Today's Sales" value={inr(k.today_sales)} delta={k.today_change_pct} />
          <Kpi testID="kpi-today-orders" label="Orders Today" value={String(k.today_orders)} />
          <Kpi testID="kpi-avg-ticket" label="Avg Ticket" value={inr(k.avg_ticket)} />
          <Kpi testID="kpi-profit-30d" label="30d Profit" value={inr(k.profit_30d)} tone={k.profit_30d >= 0 ? "success" : "danger"} />
        </View>

        {/* Quick Actions — Import Data */}
        <View style={styles.quickWrap}>
          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>Quick Actions</Text>
            <Text style={styles.quickSub}>Import from anywhere</Text>
          </View>
          <View style={styles.quickGrid}>
            <QuickAction testID="qa-csv" icon="document-text" color="#10B981" label="Import CSV"
              onPress={() => router.push("/(tabs)/integrations")} />
            <QuickAction testID="qa-excel" icon="grid" color="#059669" label="Upload Excel"
              onPress={() => router.push("/(tabs)/integrations")} />
            <QuickAction testID="qa-pdf" icon="document" color="#EF4444" label="Upload PDF"
              onPress={() => router.push("/(tabs)/integrations")} />
            <QuickAction testID="qa-sync" icon="sync" color="#3B82F6" label="Sync Data"
              onPress={() => load()} />
          </View>
        </View>

        {/* Sales Trend */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Sales — Last 7 Days</Text>
            <Text style={styles.cardSub}>{inr(salesValues.reduce((a: number, b: number) => a + b, 0))} total</Text>
          </View>
          {salesValues.length > 0 && (
            <LineChart
              data={{ labels: salesLabels, datasets: [{ data: salesValues }] }}
              width={W - 48 - 24}
              height={180}
              chartConfig={chartConfig}
              bezier
              withInnerLines
              withOuterLines={false}
              withHorizontalLabels
              withVerticalLabels
              style={{ marginLeft: -12 }}
            />
          )}
        </View>

        {/* Payment Modes (custom stacked bars) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Modes (7d)</Text>
          <PmRow label="UPI" val={pm.upi} total={pmTotal} color="#3B82F6" />
          <PmRow label="Card" val={pm.card} total={pmTotal} color="#10B981" />
          <PmRow label="Cash" val={pm.cash} total={pmTotal} color="#F59E0B" />
        </View>

        {/* Top items */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Top Selling Items</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/menu")}><Text style={styles.link}>See all →</Text></TouchableOpacity>
          </View>
          {(data.top_items || []).map((it: any, i: number) => (
            <View key={i} style={styles.listRow} testID={`top-item-${i}`}>
              <View style={styles.rankDot}><Text style={styles.rankText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{it.name}</Text>
                <Text style={styles.listSub}>{it.units_sold} units</Text>
              </View>
              <Text style={styles.listValue}>{inr(it.revenue)}</Text>
            </View>
          ))}
        </View>

        {/* Low stock quick link */}
        <TouchableOpacity
          testID="low-stock-card"
          style={[styles.card, styles.alertCard]}
          onPress={() => router.push("/(tabs)/inventory")}
        >
          <Ionicons name="alert-circle" size={22} color={theme.colors.semantic.warning} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.alertTitle}>{k.low_stock_count} items below minimum stock</Text>
            <Text style={styles.alertSub}>Tap to review and reorder</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({
  testID, label, value, delta, tone,
}: { testID: string; label: string; value: string; delta?: number; tone?: "success" | "danger" }) {
  const deltaColor = (delta ?? 0) >= 0 ? theme.colors.semantic.success : theme.colors.semantic.danger;
  return (
    <View style={styles.kpi} testID={testID}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, tone === "danger" && { color: theme.colors.semantic.danger }]}>{value}</Text>
      {typeof delta === "number" && (
        <Text style={[styles.kpiDelta, { color: deltaColor }]}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
        </Text>
      )}
    </View>
  );
}

function PmRow({ label, val, total, color }: { label: string; val: number; total: number; color: string }) {
  const pct = Math.round((val / total) * 100);
  return (
    <View style={styles.pmRow}>
      <View style={styles.pmLabel}><Text style={styles.pmLabelText}>{label}</Text></View>
      <View style={styles.pmBar}>
        <View style={[styles.pmFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.pmValue}>{inr(val)}</Text>
    </View>
  );
}

function QuickAction({
  testID, icon, color, label, onPress,
}: { testID: string; icon: any; color: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.qaCard} activeOpacity={0.8}>
      <View style={[styles.qaIcon, { backgroundColor: color + "25" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 24, paddingBottom: 40 },
  brandBar: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  brandIconBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  greeting: { color: theme.colors.text.tertiary, fontSize: 12, letterSpacing: 1 },
  name: { color: theme.colors.text.primary, fontSize: 24, fontWeight: "800", marginTop: 2 },
  business: { color: theme.colors.brand.primary, fontSize: 12, fontWeight: "600", marginTop: 4 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8 },
  quickWrap: { marginTop: 12 },
  quickHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
  quickTitle: { color: theme.colors.text.primary, fontSize: 15, fontWeight: "700" },
  quickSub: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 0.5 },
  quickGrid: { flexDirection: "row", gap: 10 },
  qaCard: {
    flex: 1, backgroundColor: theme.colors.surface, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: "center",
  },
  qaIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  qaLabel: { color: theme.colors.text.primary, fontSize: 11, fontWeight: "600", textAlign: "center" },
  kpi: {
    width: "48.5%", backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  kpiLabel: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  kpiValue: { color: theme.colors.text.primary, fontSize: 24, fontWeight: "800", marginTop: 8, letterSpacing: -0.5 },
  kpiDelta: { fontSize: 11, marginTop: 4, fontWeight: "600" },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: theme.colors.border, marginTop: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  cardTitle: { color: theme.colors.text.primary, fontSize: 15, fontWeight: "700" },
  cardSub: { color: theme.colors.text.tertiary, fontSize: 12 },
  link: { color: theme.colors.brand.primary, fontSize: 12, fontWeight: "600" },
  listRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  rankDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.brand.primaryMuted,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  rankText: { color: theme.colors.brand.primary, fontSize: 12, fontWeight: "700" },
  listTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "600" },
  listSub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 2 },
  listValue: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700" },
  pmRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  pmLabel: { width: 48 },
  pmLabelText: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600" },
  pmBar: { flex: 1, height: 10, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 6, overflow: "hidden" },
  pmFill: { height: "100%", borderRadius: 6 },
  pmValue: { width: 80, textAlign: "right", color: theme.colors.text.primary, fontSize: 12, fontWeight: "600" },
  alertCard: {
    flexDirection: "row", alignItems: "center",
    borderColor: theme.colors.semantic.warning,
    backgroundColor: theme.colors.semantic.warningBg,
  },
  alertTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700" },
  alertSub: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 2 },
});
