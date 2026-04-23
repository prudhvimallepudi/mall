import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput,
  TouchableOpacity, RefreshControl, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import { theme } from "../../constants/theme";
import { BranchPicker, inr } from "../../components/BranchPicker";
import { useAiContext } from "../../lib/aiContext";

export default function Inventory() {
  const { setKey } = useAiContext();
  useEffect(() => { setKey("inventory"); }, [setKey]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", unit: "kg", stock: "", min_stock: "", cost_per_unit: "" });

  const load = useCallback(async (bid = branchId) => {
    try {
      const [b, r] = await Promise.all([
        branches.length ? Promise.resolve({ data: branches }) : api.get("/branches"),
        api.get("/inventory", { params: { branch_id: bid } }),
      ]);
      if (!branches.length) setBranches(b.data);
      setItems(r.data);
    } finally { setLoading(false); }
  }, [branchId, branches]);

  useEffect(() => { load(branchId); }, [branchId]);

  const submit = async () => {
    try {
      await api.post("/inventory", {
        name: form.name,
        unit: form.unit || "kg",
        stock: parseFloat(form.stock) || 0,
        min_stock: parseFloat(form.min_stock) || 0,
        cost_per_unit: parseFloat(form.cost_per_unit) || 0,
        branch_id: branchId !== "all" ? branchId : undefined,
      });
      setModal(false);
      setForm({ name: "", unit: "kg", stock: "", min_stock: "", cost_per_unit: "" });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Unable to add");
    }
  };

  const adjust = async (id: string, delta: number) => {
    try {
      await api.patch(`/inventory/${id}/stock`, { delta });
      load();
    } catch {}
  };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const lowCount = items.filter((i) => i.stock < i.min_stock).length;

  if (loading) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.sub}>{items.length} items · <Text style={{ color: theme.colors.semantic.warning }}>{lowCount} low</Text></Text>
      </View>

      <View style={{ paddingHorizontal: 24, marginBottom: 12 }}>
        <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={theme.colors.text.tertiary} />
        <TextInput
          testID="inventory-search"
          placeholder="Search items"
          placeholderTextColor={theme.colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl tintColor="#fff" refreshing={false} onRefresh={() => load()} />}
      >
        {filtered.map((it) => {
          const low = it.stock < it.min_stock;
          return (
            <View key={it.item_id} testID={`inventory-item-${it.item_id}`}
                  style={[styles.row, low && styles.rowLow]}>
              <View style={[styles.tag, { backgroundColor: low ? theme.colors.semantic.dangerBg : theme.colors.surfaceHighlight }]}>
                <Text style={[styles.tagText, { color: low ? theme.colors.semantic.danger : theme.colors.text.secondary }]}>
                  {it.unit}
                </Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.rowTitle}>{it.name}</Text>
                <Text style={styles.rowSub}>
                  Stock {it.stock} / min {it.min_stock} · {inr(it.cost_per_unit)}/{it.unit}
                </Text>
              </View>
              <TouchableOpacity testID={`inv-dec-${it.item_id}`} onPress={() => adjust(it.item_id, -1)} style={styles.stepBtn}>
                <Ionicons name="remove" size={16} color={theme.colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity testID={`inv-inc-${it.item_id}`} onPress={() => adjust(it.item_id, 1)} style={styles.stepBtn}>
                <Ionicons name="add" size={16} color={theme.colors.text.primary} />
              </TouchableOpacity>
            </View>
          );
        })}
        {filtered.length === 0 && <Text style={styles.empty}>No items found.</Text>}
      </ScrollView>

      <TouchableOpacity testID="add-inventory-fab" onPress={() => setModal(true)} style={styles.fab}>
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Inventory Item</Text>
            <FormInput testID="inv-form-name" placeholder="Name (e.g. Chicken)" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />
            <FormInput testID="inv-form-unit" placeholder="Unit (kg, L, pcs)" value={form.unit} onChangeText={(v) => setForm({ ...form, unit: v })} />
            <FormInput testID="inv-form-stock" placeholder="Stock quantity" value={form.stock} onChangeText={(v) => setForm({ ...form, stock: v })} keyboardType="numeric" />
            <FormInput testID="inv-form-min" placeholder="Min stock threshold" value={form.min_stock} onChangeText={(v) => setForm({ ...form, min_stock: v })} keyboardType="numeric" />
            <FormInput testID="inv-form-cost" placeholder="Cost per unit (₹)" value={form.cost_per_unit} onChangeText={(v) => setForm({ ...form, cost_per_unit: v })} keyboardType="numeric" />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.btnGhost]} onPress={() => setModal(false)}>
                <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="inv-form-submit" style={[styles.modalBtn, styles.btnPrimary]} onPress={submit}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormInput(props: any) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.colors.text.tertiary}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  title: { color: theme.colors.text.primary, fontSize: 24, fontWeight: "800" },
  sub: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 4 },
  searchWrap: {
    marginHorizontal: 24, flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12,
    backgroundColor: theme.colors.surface, height: 42, marginBottom: 8,
  },
  searchInput: { flex: 1, color: theme.colors.text.primary, marginLeft: 8, fontSize: 14 },
  list: { paddingHorizontal: 24, paddingVertical: 8, paddingBottom: 120 },
  row: {
    flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10,
    backgroundColor: theme.colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    borderLeftWidth: 3, borderLeftColor: theme.colors.border,
  },
  rowLow: { borderLeftColor: theme.colors.semantic.danger },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  rowTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "600" },
  rowSub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 2 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.surfaceHighlight,
    alignItems: "center", justifyContent: "center", marginLeft: 6,
  },
  empty: { color: theme.colors.text.tertiary, textAlign: "center", marginTop: 40 },
  fab: {
    position: "absolute", right: 24, bottom: 24,
    width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.brand.primary,
    alignItems: "center", justifyContent: "center", elevation: 4,
  },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: theme.colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: theme.colors.border,
  },
  modalTitle: { color: theme.colors.text.primary, fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: {
    backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
    color: theme.colors.text.primary, padding: 12, borderRadius: 10, marginBottom: 10, fontSize: 14,
  },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnGhost: { backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border },
  btnPrimary: { backgroundColor: theme.colors.brand.primary },
});
