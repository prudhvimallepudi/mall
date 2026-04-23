import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../lib/api";
import { theme } from "../../constants/theme";
import { BranchPicker, inr } from "../../components/BranchPicker";
import { useAiContext } from "../../lib/aiContext";

export default function Menu() {
  const { setKey } = useAiContext();
  useEffect(() => { setKey("menu"); }, [setKey]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (bid = branchId) => {
    const [b, r] = await Promise.all([
      branches.length ? Promise.resolve({ data: branches }) : api.get("/branches"),
      api.get("/menu/analytics", { params: { branch_id: bid } }),
    ]);
    if (!branches.length) setBranches(b.data);
    setItems(r.data.items);
    setLoading(false);
  }, [branchId, branches]);

  useEffect(() => { load(branchId); }, [branchId]);

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View></SafeAreaView>;
  }

  const totalRevenue = items.reduce((s, i) => s + i.revenue, 0);
  const totalProfit = items.reduce((s, i) => s + i.profit, 0);
  const maxRev = Math.max(...items.map((i) => i.revenue), 1);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu Analytics</Text>
        <Text style={styles.sub}>{items.length} items · {inr(totalRevenue)} revenue · {inr(totalProfit)} profit</Text>
      </View>

      <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
        <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
      </View>

      <ScrollView contentContainerStyle={styles.list}
                  refreshControl={<RefreshControl tintColor="#fff" refreshing={false} onRefresh={() => load()} />}>
        {items.map((it, i) => {
          const marginTone = it.margin_pct >= 55 ? "success" : it.margin_pct >= 35 ? "warning" : "danger";
          const tc = marginTone === "success" ? theme.colors.semantic.success
            : marginTone === "warning" ? theme.colors.semantic.warning : theme.colors.semantic.danger;
          const pct = (it.revenue / maxRev) * 100;
          return (
            <View key={i} style={styles.card} testID={`menu-item-${i}`}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemCat}>{it.category} · Sold {it.units_sold}</Text>
                </View>
                <View style={[styles.marginPill, { backgroundColor: tc + "25", borderColor: tc }]}>
                  <Text style={[styles.marginText, { color: tc }]}>{it.margin_pct}% margin</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <Metric label="COST" value={inr(it.cost)} />
                <Metric label="PRICE" value={inr(it.price)} />
                <Metric label="PROFIT" value={inr(it.profit)} />
                <Metric label="WASTE" value={`${it.waste_units}`} />
              </View>

              <View style={styles.revBar}>
                <View style={[styles.revFill, { width: `${pct}%` }]} />
              </View>
              <Text style={styles.revText}>{inr(it.revenue)} revenue</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  title: { color: theme.colors.text.primary, fontSize: 24, fontWeight: "800" },
  sub: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 4 },
  list: { padding: 24, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  itemName: { color: theme.colors.text.primary, fontSize: 15, fontWeight: "700" },
  itemCat: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 2 },
  marginPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  marginText: { fontSize: 11, fontWeight: "700" },
  metricsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, backgroundColor: theme.colors.surfaceHighlight, padding: 10, borderRadius: 8 },
  metric: { alignItems: "center" },
  metricLabel: { color: theme.colors.text.tertiary, fontSize: 9, letterSpacing: 1 },
  metricValue: { color: theme.colors.text.primary, fontSize: 13, fontWeight: "700", marginTop: 4 },
  revBar: { height: 6, backgroundColor: theme.colors.surfaceHighlight, borderRadius: 3, overflow: "hidden" },
  revFill: { height: "100%", backgroundColor: theme.colors.brand.primary, borderRadius: 3 },
  revText: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 6 },
});
