import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
  TextInput, Modal, Alert, RefreshControl, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../lib/api";
import { theme } from "../../constants/theme";
import { BranchPicker, inr } from "../../components/BranchPicker";
import { useAiContext } from "../../lib/aiContext";
import { useLocalSearchParams, useRouter } from "expo-router";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  present: { label: "Present", color: theme.colors.semantic.success, bg: theme.colors.semantic.successBg },
  absent: { label: "Absent", color: theme.colors.semantic.danger, bg: theme.colors.semantic.dangerBg },
  leave: { label: "Leave", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)" },
  half: { label: "Half Day", color: theme.colors.semantic.warning, bg: theme.colors.semantic.warningBg },
  unmarked: { label: "—", color: theme.colors.text.tertiary, bg: theme.colors.surfaceHighlight },
};

const SHIFTS = ["Morning", "Evening", "Night"];

export default function Employees() {
  const { setKey } = useAiContext();
  useEffect(() => { setKey("staff"); }, [setKey]);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", monthly_salary: "", phone: "", shift: "Morning" });
  const params = useLocalSearchParams<{ add?: string }>();
  const router = useRouter();
  useEffect(() => {
    if (params.add === "1") {
      setModal(true);
      router.setParams({ add: undefined } as any);
    }
  }, [params.add, router]);

  const load = useCallback(async (bid = branchId) => {
    try {
      const [b, r] = await Promise.all([
        branches.length ? Promise.resolve({ data: branches }) : api.get("/branches"),
        api.get("/employees", { params: { branch_id: bid } }),
      ]);
      if (!branches.length) setBranches(b.data);
      setData(r.data);
    } finally { setLoading(false); }
  }, [branchId, branches]);

  useEffect(() => { load(branchId); }, [branchId]);

  const cycleStatus = async (emp: any) => {
    const order = ["unmarked", "present", "half", "leave", "absent"];
    const curr = emp.today_status || "unmarked";
    const next = order[(order.indexOf(curr) + 1) % order.length];
    try {
      await api.post("/employees/attendance", { employee_id: emp.employee_id, status: next });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Unable to update");
    }
  };

  const openUrl = async (url: string, fallback: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) { Linking.openURL(url); return; }
    } catch {}
    Alert.alert("Unavailable", fallback);
  };

  const contactAction = (emp: any, kind: "call" | "whatsapp" | "sms" | "mail") => {
    const phone = (emp.phone || "").replace(/[^0-9+]/g, "");
    if ((kind === "call" || kind === "whatsapp" || kind === "sms") && !phone) {
      Alert.alert("No phone", `${emp.name} has no phone number on file.`);
      return;
    }
    const msg = `Hi ${emp.name.split(" ")[0]}, this is a quick reminder about your ${emp.shift.toLowerCase()} shift today at RestroHub. Please confirm.`;
    if (kind === "call") {
      openUrl(`tel:${phone}`, "Phone dialer not available.");
    } else if (kind === "whatsapp") {
      const waNum = phone.startsWith("+") ? phone.slice(1) : phone;
      openUrl(
        `whatsapp://send?phone=${encodeURIComponent(waNum)}&text=${encodeURIComponent(msg)}`,
        "WhatsApp not installed. Install WhatsApp and try again.",
      );
    } else if (kind === "sms") {
      openUrl(`sms:${phone}?body=${encodeURIComponent(msg)}`, "SMS not available on this device.");
    } else if (kind === "mail") {
      openUrl(
        `mailto:?subject=${encodeURIComponent("Shift reminder")}&body=${encodeURIComponent(msg)}`,
        "Email client not available.",
      );
    }
  };

  const submit = async () => {
    try {
      await api.post("/employees", {
        name: form.name,
        role: form.role,
        monthly_salary: parseFloat(form.monthly_salary) || 0,
        phone: form.phone,
        shift: form.shift,
        branch_id: branchId !== "all" ? branchId : undefined,
      });
      setModal(false);
      setForm({ name: "", role: "", monthly_salary: "", phone: "", shift: "Morning" });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Unable to add");
    }
  };

  if (loading || !data) {
    return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View></SafeAreaView>;
  }

  const employees = data.employees || [];
  const attendancePct = data.total_employees ? Math.round((data.present_today / data.total_employees) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}
                  refreshControl={<RefreshControl tintColor="#fff" refreshing={false} onRefresh={() => load()} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Employees</Text>
          <Text style={styles.sub}>{data.total_employees} staff · {inr(data.total_monthly_salary)} monthly payroll</Text>
        </View>

        <View style={{ marginBottom: 16 }}>
          <BranchPicker branches={branches} value={branchId} onChange={setBranchId} />
        </View>

        {/* Attendance KPI */}
        <View style={styles.kpiCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiLabel}>TODAY'S ATTENDANCE</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <Text style={styles.kpiBig}>{data.present_today}</Text>
              <Text style={styles.kpiTotal}>/ {data.total_employees}</Text>
              <View style={[styles.pctPill, { backgroundColor: theme.colors.semantic.successBg }]}>
                <Text style={[styles.pctText, { color: theme.colors.semantic.success }]}>{attendancePct}%</Text>
              </View>
            </View>
          </View>
          <View style={styles.trackWrap}>
            <View style={[styles.trackFill, { width: `${attendancePct}%` }]} />
          </View>
        </View>

        {/* Employees list */}
        {employees.map((e: any) => {
          const meta = STATUS_META[e.today_status] || STATUS_META.unmarked;
          const initials = e.name.split(" ").slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();
          return (
            <View key={e.employee_id} style={styles.empCard} testID={`employee-row-${e.employee_id}`}>
              <View style={styles.empTop}>
                <View style={styles.avatarRing}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.empName}>{e.name}</Text>
                  <Text style={styles.empRole}>{e.role} · {e.shift} shift</Text>
                  <Text style={styles.empPay}>{inr(e.monthly_salary)} / month{e.phone ? ` · ${e.phone}` : ""}</Text>
                </View>
                <TouchableOpacity
                  testID={`attendance-toggle-${e.employee_id}`}
                  onPress={() => cycleStatus(e)}
                  style={[styles.statusChip, { backgroundColor: meta.bg, borderColor: meta.color }]}
                  activeOpacity={0.8}
                >
                  <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.contactRow}>
                <ContactBtn
                  testID={`call-${e.employee_id}`}
                  icon="call" color="#10B981" label="Call"
                  onPress={() => contactAction(e, "call")}
                />
                <ContactBtn
                  testID={`whatsapp-${e.employee_id}`}
                  icon="logo-whatsapp" color="#25D366" label="WhatsApp"
                  onPress={() => contactAction(e, "whatsapp")}
                />
                <ContactBtn
                  testID={`sms-${e.employee_id}`}
                  icon="chatbubble-ellipses" color="#3B82F6" label="SMS"
                  onPress={() => contactAction(e, "sms")}
                />
                <ContactBtn
                  testID={`mail-${e.employee_id}`}
                  icon="mail" color="#F97316" label="Email"
                  onPress={() => contactAction(e, "mail")}
                />
              </View>
            </View>
          );
        })}

        <Text style={styles.hint}>Tap the status chip to cycle: Unmarked → Present → Half → Leave → Absent</Text>
      </ScrollView>

      <TouchableOpacity testID="add-employee-fab" style={[styles.fab, { display: "none" }]} onPress={() => setModal(true)}>
        <Ionicons name="person-add" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Employee</Text>
            <TextInput testID="emp-form-name" placeholder="Full name" placeholderTextColor={theme.colors.text.tertiary}
                       value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} style={styles.input} />
            <TextInput testID="emp-form-role" placeholder="Role (e.g. Waiter)" placeholderTextColor={theme.colors.text.tertiary}
                       value={form.role} onChangeText={(v) => setForm({ ...form, role: v })} style={styles.input} />
            <TextInput testID="emp-form-salary" placeholder="Monthly salary (₹)" placeholderTextColor={theme.colors.text.tertiary}
                       keyboardType="numeric" value={form.monthly_salary}
                       onChangeText={(v) => setForm({ ...form, monthly_salary: v })} style={styles.input} />
            <TextInput testID="emp-form-phone" placeholder="Phone (optional)" placeholderTextColor={theme.colors.text.tertiary}
                       value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} style={styles.input} />
            <Text style={styles.formLabel}>Shift</Text>
            <View style={styles.chipRow}>
              {SHIFTS.map((s) => (
                <TouchableOpacity
                  key={s}
                  testID={`shift-${s}`}
                  onPress={() => setForm({ ...form, shift: s })}
                  style={[styles.chip, form.shift === s && styles.chipActive]}
                >
                  <Text style={[styles.chipText, form.shift === s && { color: theme.colors.brand.primary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.btnGhost]} onPress={() => setModal(false)}>
                <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="emp-form-submit" style={[styles.modalBtn, styles.btnPrimary]} onPress={submit}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ContactBtn({
  testID, icon, color, label, onPress,
}: { testID: string; icon: any; color: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.contactBtn, { borderColor: color + "44", backgroundColor: color + "14" }]}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.contactBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 24, paddingBottom: 120 },
  header: { marginBottom: 16 },
  title: { color: theme.colors.text.primary, fontSize: 24, fontWeight: "800" },
  sub: { color: theme.colors.text.secondary, fontSize: 13, marginTop: 4 },
  kpiCard: {
    backgroundColor: theme.colors.surface, borderRadius: 12, padding: 18,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 14,
  },
  kpiLabel: { color: theme.colors.text.tertiary, fontSize: 10, letterSpacing: 1.2, fontWeight: "700" },
  kpiBig: { color: theme.colors.text.primary, fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  kpiTotal: { color: theme.colors.text.tertiary, fontSize: 15, fontWeight: "600" },
  pctPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginLeft: "auto" },
  pctText: { fontSize: 11, fontWeight: "800" },
  trackWrap: { height: 6, backgroundColor: theme.colors.surfaceHighlight, borderRadius: 3, marginTop: 14, overflow: "hidden" },
  trackFill: { height: "100%", backgroundColor: theme.colors.semantic.success },
  empCard: {
    padding: 14, marginBottom: 10,
    backgroundColor: theme.colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  empTop: { flexDirection: "row", alignItems: "center" },
  contactRow: {
    flexDirection: "row", gap: 6, marginTop: 12, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border,
  },
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 9, borderRadius: 8, borderWidth: 1,
  },
  contactBtnText: { fontSize: 11, fontWeight: "700" },
  avatarRing: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brand.primaryMuted,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: theme.colors.brand.primary, fontWeight: "800", fontSize: 14 },
  empName: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700" },
  empRole: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 2 },
  empPay: { color: theme.colors.semantic.success, fontSize: 12, fontWeight: "600", marginTop: 2 },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  hint: { color: theme.colors.text.tertiary, fontSize: 11, textAlign: "center", marginTop: 12, fontStyle: "italic" },
  fab: {
    position: "absolute", right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.brand.primary, alignItems: "center", justifyContent: "center",
  },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { color: theme.colors.text.primary, fontSize: 18, fontWeight: "700", marginBottom: 16 },
  formLabel: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
    color: theme.colors.text.primary, padding: 12, borderRadius: 10, marginBottom: 10, fontSize: 14,
  },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
    marginRight: 8,
  },
  chipActive: { borderColor: theme.colors.brand.primary, backgroundColor: theme.colors.brand.primaryMuted },
  chipText: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600" },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnGhost: { backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border },
  btnPrimary: { backgroundColor: theme.colors.brand.primary },
});
