import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import api from "../../lib/api";
import { theme } from "../../constants/theme";
import { BranchPicker } from "../../components/BranchPicker";

type Insight = { type: string; title: string; message: string; impact?: string };

const TYPE_META: Record<string, { icon: any; colors: [string, string, string]; label: string }> = {
  prediction: {
    icon: "trending-up",
    colors: ["#EC4899", "#8B5CF6", "#3B82F6"],
    label: "FORECAST",
  },
  recommendation: {
    icon: "bulb",
    colors: ["#FACC15", "#F97316", "#EF4444"],
    label: "SUGGESTION",
  },
  alert: {
    icon: "warning",
    colors: ["#EF4444", "#DC2626", "#991B1B"],
    label: "ALERT",
  },
  opportunity: {
    icon: "rocket",
    colors: ["#10B981", "#06B6D4", "#3B82F6"],
    label: "OPPORTUNITY",
  },
};

export default function Insights() {
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string>("");

  const load = useCallback(async (bid = branchId) => {
    setLoading(true);
    try {
      const [b, r] = await Promise.all([
        branches.length ? Promise.resolve({ data: branches }) : api.get("/branches"),
        api.get("/ai/insights", { params: { branch_id: bid } }),
      ]);
      if (!branches.length) setBranches(b.data);
      setInsights(r.data.insights || []);
      setGeneratedAt(r.data.generated_at);
    } finally { setLoading(false); }
  }, [branchId, branches]);

  useEffect(() => { load(branchId); }, [branchId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero with bright gradient */}
        <LinearGradient
          colors={["#EC4899", "#8B5CF6", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.sparkleBadge}>
                <Ionicons name="sparkles" size={12} color="#FFF" />
                <Text style={styles.sparkleText}>POWERED BY CLAUDE SONNET 4.5</Text>
              </View>
              <TouchableOpacity testID="refresh-insights" onPress={() => load()} style={styles.refreshBtn}>
                <Ionicons name="refresh" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.heroTitle}>Your restaurant,{"\n"}explained.</Text>
            <Text style={styles.heroSub}>
              Real-time AI analysis of 30 days of sales, menu & expense data
            </Text>
          </View>
        </LinearGradient>

        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color="#EC4899" />
              <Text style={styles.loadingText}>Analysing your data…</Text>
            </View>
          ) : (
            insights.map((ins, i) => {
              const meta = TYPE_META[ins.type] || TYPE_META.recommendation;
              return (
                <View key={i} style={styles.cardWrap} testID={`insight-card-${i}`}>
                  <LinearGradient
                    colors={[meta.colors[0] + "30", meta.colors[1] + "10", "transparent"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                  >
                    <View style={[styles.cardAccent, { backgroundColor: meta.colors[0] }]} />
                    <View style={styles.cardHead}>
                      <LinearGradient
                        colors={meta.colors}
                        style={styles.iconBadge}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <Ionicons name={meta.icon} size={18} color="#FFF" />
                      </LinearGradient>
                      <Text style={[styles.insightType, { color: meta.colors[0] }]}>{meta.label}</Text>
                      {ins.impact && (
                        <View style={[styles.impactTag, { backgroundColor: meta.colors[0] + "25", borderColor: meta.colors[0] }]}>
                          <Text style={[styles.impactText, { color: meta.colors[0] }]}>{ins.impact} impact</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.insightTitle}>{ins.title}</Text>
                    <Text style={styles.insightMsg}>{ins.message}</Text>
                  </LinearGradient>
                </View>
              );
            })
          )}
        </View>

        {!loading && generatedAt && (
          <Text style={styles.genNote}>
            ✨ Generated {new Date(generatedAt).toLocaleTimeString()} · tap refresh for fresh insights
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 40 },
  hero: {
    marginHorizontal: 16, marginTop: 16, paddingHorizontal: 24, paddingVertical: 28,
    borderRadius: 20, overflow: "hidden",
  },
  heroContent: {},
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  sparkleBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  sparkleText: { color: "#FFF", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: { color: "#FFF", fontSize: 28, fontWeight: "800", letterSpacing: -0.8, lineHeight: 34 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 10, lineHeight: 19 },
  loadingCard: {
    backgroundColor: theme.colors.surface, borderRadius: 14, padding: 40,
    borderWidth: 1, borderColor: theme.colors.border, alignItems: "center",
  },
  loadingText: { color: theme.colors.text.secondary, marginTop: 14, fontSize: 13 },
  cardWrap: { marginBottom: 14 },
  card: {
    borderRadius: 14, padding: 18, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  cardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  cardHead: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  iconBadge: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  insightType: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, flex: 1 },
  impactTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  impactText: { fontSize: 10, fontWeight: "700" },
  insightTitle: { color: theme.colors.text.primary, fontSize: 17, fontWeight: "800", marginBottom: 8, letterSpacing: -0.3 },
  insightMsg: { color: theme.colors.text.secondary, fontSize: 13, lineHeight: 20 },
  genNote: { color: theme.colors.text.tertiary, fontSize: 11, textAlign: "center", marginTop: 16, paddingHorizontal: 24 },
});
