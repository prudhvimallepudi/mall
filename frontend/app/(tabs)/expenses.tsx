import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import { theme } from "../../constants/theme";
import { BranchPicker, inr } from "../../components/BranchPicker";
import { useAiContext } from "../../lib/aiContext";

const CATEGORY_COLORS: Record<string, string> = {
  Rent: "#3B82F6",
  Electricity: "#F59E0B",
  Gas: "#EF4444",
  Salaries: "#10B981",
  Vendors: "#A855F7",
  Misc: "#6B7280",
};
const CATS = ["Rent", "Electricity", "Gas", "Salaries", "Vendors", "Misc"];

export default function Expenses() {
  const { setKey } = useAiContext();
  useEffect(() => { setKey("expenses"); }, [setKey]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ category: "Rent", amount: "", note: "" });
  const [csvModal, setCsvModal] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async (bid = branchId) => {
    const [b, r] = await Promise.all([
      branches.length ? Promise.resolve({ data: branches }) : api.get("/branches"),
      api.get("/expenses", { params: { branch_id: bid, days: 30 } }),
    ]);
    if (!branches.length) setBranches(b.data);
    setData(r.data);
    setLoading(false);
  }, [branchId, branches]);

  useEffect(() => { load(branchId); }, [branchId]);

  const submit = async () => {
    try {
      await api.post("/expenses", {
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        note: form.note,
        branch_id: branchId !== "all" ? branchId : undefined,
      });
      setModal(false);
      setForm({ category: "Rent", amount: "", note: "" });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Unable to add");
    }
  };

  const importCsv = async () => {
    const lines = csvText.trim().split("\n").filter(Boolean);
    if (lines.length < 2) {
      Alert.alert("Invalid CSV", "Need header row + at least 1 data row.");
      return;
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const row: Record<string, any> = {};
      header.forEach((h, i) => { row[h] = cells[i]; });
      return row;
    });
    try {
      setImporting(true);
      const r = await api.post("/import/csv", {
        type: "expenses",
        rows,
        branch_id: branchId !== "all" ? branchId : undefined,
      });
      Alert.alert("Imported", `${r.data.inserted} expenses added`);
      setCsvModal(false);
      setCsvText("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Unable to import CSV");
    } finally {
      setImporting(false);
    }
  };

  if (loading || !data) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View></SafeAreaView>;
  }

  const total = data.total || 1;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}
                  refreshControl={<RefreshControl tintColor="#fff" refreshing={false} onRefresh={() => load()} />}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Expenses</Text>
            <Text style={styles.sub}>Last 30 days · {inr(data.total)}</Text>
          </View>
          <TouchableOpacity testID="csv-import-btn" onPress={() => setCsvModal(true)} style={styles.csvBtn}>
            <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.brand.primary} />
            <Text style={styles.csvBtnText}>Import CSV</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 20 }}>
          <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Breakdown</Text>
          <View style={styles.bar}>
            {data.categories.map((c: any) => (
              <View
                key={c.category}
                style={{
                  width: `${(c.amount / total) * 100}%`,
                  backgroundColor: CATEGORY_COLORS[c.category] || "#6B7280",
                }}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {data.categories.map((c: any) => (
              <View key={c.category} style={styles.legendItem} testID={`expense-cat-${c.category}`}>
                <View style={[styles.legendDot, { backgroundColor: CATEGORY_COLORS[c.category] || "#6B7280" }]} />
                <Text style={styles.legendLabel}>{c.category}</Text>
                <Text style={styles.legendVal}>{inr(c.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Entries</Text>
          {data.items.slice(0, 25).map((e: any) => (
            <View key={e.expense_id} style={styles.entry} testID={`expense-row-${e.expense_id}`}>
              <View style={[styles.catPill, { backgroundColor: (CATEGORY_COLORS[e.category] || "#6B7280") + "25" }]}>
                <Text style={[styles.catPillText, { color: CATEGORY_COLORS[e.category] || "#9CA3AF" }]}>{e.category}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.entryTitle}>{e.note || e.category}</Text>
                <Text style={styles.entrySub}>{e.date}</Text>
              </View>
              <Text style={styles.entryAmt}>{inr(e.amount)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity testID="add-expense-fab" style={styles.fab} onPress={() => setModal(true)}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Expense</Text>
            <Text style={styles.formLabel}>Category</Text>
            <View style={styles.catRow}>
              {CATS.map((c) => (
                <TouchableOpacity
                  key={c}
                  testID={`exp-cat-${c}`}
                  onPress={() => setForm({ ...form, category: c })}
                  style={[styles.catChip, form.category === c && { borderColor: theme.colors.brand.primary, backgroundColor: theme.colors.brand.primaryMuted }]}
                >
                  <Text style={{ color: form.category === c ? theme.colors.brand.primary : theme.colors.text.secondary, fontSize: 12, fontWeight: "600" }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput testID="exp-form-amount" placeholder="Amount (₹)" placeholderTextColor={theme.colors.text.tertiary}
                       keyboardType="numeric" value={form.amount}
                       onChangeText={(v) => setForm({ ...form, amount: v })} style={styles.input} />
            <TextInput testID="exp-form-note" placeholder="Note (optional)" placeholderTextColor={theme.colors.text.tertiary}
                       value={form.note} onChangeText={(v) => setForm({ ...form, note: v })} style={styles.input} />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.btnGhost]} onPress={() => setModal(false)}>
                <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="exp-form-submit" style={[styles.modalBtn, styles.btnPrimary]} onPress={submit}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={csvModal} animationType="slide" transparent onRequestClose={() => setCsvModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Import Expenses from CSV</Text>
            <Text style={styles.csvHint}>Paste CSV with columns: date,category,amount,note</Text>
            <Text style={styles.csvExample}>Example:{"\n"}date,category,amount,note{"\n"}2026-04-21,Gas,1200,Tank refill</Text>
            <TextInput
              testID="csv-textarea"
              placeholder="Paste CSV here…"
              placeholderTextColor={theme.colors.text.tertiary}
              value={csvText}
              onChangeText={setCsvText}
              multiline
              numberOfLines={8}
              style={[styles.input, { minHeight: 140, textAlignVertical: "top" }]}
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.btnGhost]} onPress={() => setCsvModal(false)}>
                <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="csv-submit" style={[styles.modalBtn, styles.btnPrimary]} onPress={importCsv} disabled={importing}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{importing ? "Importing…" : "Import"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 24, paddingBottom: 120 },
  header: { marginBottom: 16, flexDirection: "row", alignItems: "center" },
  csvBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: theme.colors.brand.primaryMuted, borderWidth: 1, borderColor: theme.colors.brand.primary,
  },
  csvBtnText: { color: theme.colors.brand.primary, fontSize: 12, fontWeight: "700" },
  csvHint: { color: theme.colors.text.secondary, fontSize: 12, marginBottom: 6 },
  csvExample: { color: theme.colors.text.tertiary, fontSize: 11, marginBottom: 12, fontFamily: "monospace", lineHeight: 16 },
  title: { color: theme.colors.text.primary, fontSize: 24, fontWeight: "800" },
  sub: { color: theme.colors.text.secondary, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: theme.colors.border, marginTop: 12,
  },
  cardTitle: { color: theme.colors.text.primary, fontSize: 15, fontWeight: "700", marginBottom: 14 },
  bar: { flexDirection: "row", height: 14, borderRadius: 8, overflow: "hidden", backgroundColor: theme.colors.surfaceHighlight },
  legend: { marginTop: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  legendLabel: { flex: 1, color: theme.colors.text.primary, fontSize: 13 },
  legendVal: { color: theme.colors.text.primary, fontWeight: "700", fontSize: 13 },
  entry: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  catPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  catPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  entryTitle: { color: theme.colors.text.primary, fontSize: 13, fontWeight: "600" },
  entrySub: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 2 },
  entryAmt: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700" },
  fab: {
    position: "absolute", right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.brand.primary, alignItems: "center", justifyContent: "center",
  },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { color: theme.colors.text.primary, fontSize: 18, fontWeight: "700", marginBottom: 16 },
  formLabel: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1, marginBottom: 8 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceHighlight, marginRight: 8, marginBottom: 8 },
  input: {
    backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
    color: theme.colors.text.primary, padding: 12, borderRadius: 10, marginBottom: 10, fontSize: 14,
  },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnGhost: { backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border },
  btnPrimary: { backgroundColor: theme.colors.brand.primary },
});
