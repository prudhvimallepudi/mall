import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Switch, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import api from "../../lib/api";
import { theme } from "../../constants/theme";

type Settings = {
  low_stock_enabled: boolean;
  out_of_stock_enabled: boolean;
  staff_absent_enabled: boolean;
  high_sales_milestone_enabled: boolean;
  low_sales_warning_enabled: boolean;
  expense_limit_enabled: boolean;
  expense_limit_monthly: number;
  sound_enabled: boolean;
  eod_time: string;
  eod_timezone: string;
  eod_recipient_emails: string[];
  eod_daily_enabled: boolean;
  eod_weekly_enabled: boolean;
  eod_monthly_enabled: boolean;
  branch_rules: Record<string, boolean>;
};

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London",
  "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC",
];

export default function SettingsScreen() {
  const router = useRouter();
  const [s, setS] = useState<Settings | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [limitText, setLimitText] = useState("");

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api.get("/settings/notifications"),
        api.get("/branches"),
      ]);
      setS(a.data);
      setBranches(b.data || []);
      setLimitText(String(a.data.expense_limit_monthly || 0));
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch: Partial<Settings>) => {
    if (!s) return;
    setSaving(true);
    const next = { ...s, ...patch };
    setS(next);
    try {
      const r = await api.patch("/settings/notifications", patch);
      setS(r.data);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not save setting");
      setS(s); // revert
    } finally {
      setSaving(false);
    }
  };

  const addEmail = () => {
    if (!s) return;
    const v = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (s.eod_recipient_emails.includes(v)) {
      setNewEmail(""); return;
    }
    save({ eod_recipient_emails: [...s.eod_recipient_emails, v] });
    setNewEmail("");
  };

  const removeEmail = (e: string) => {
    if (!s) return;
    save({ eod_recipient_emails: s.eod_recipient_emails.filter((x) => x !== e) });
  };

  const setEodTime = (hh: number, mm: number) => {
    const t = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    save({ eod_time: t });
  };

  const downloadPdf = async () => {
    const base = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    if (!base) {
      Alert.alert("Unavailable", "Backend URL missing.");
      return;
    }
    const url = `${base}/api/reports/eod/pdf`;
    if (Platform.OS === "web") {
      // Open in new tab (browser will download with session cookie)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window?.open(url, "_blank");
    } else {
      const { Linking: L } = await import("react-native");
      L.openURL(url);
    }
  };

  const sendEod = async () => {
    try {
      const r = await api.post("/reports/eod/send", {});
      if (r.data.ok) {
        Alert.alert("Sent", "Daily report emailed to recipients.");
      } else {
        Alert.alert("Email not configured",
          r.data.message || "Add SendGrid credentials to enable email sending. Use 'Download PDF' for now.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Could not send");
    }
  };

  if (loading || !s) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator color={theme.colors.brand.primary} /></View>
      </SafeAreaView>
    );
  }

  const [eodH, eodM] = s.eod_time.split(":").map((n) => parseInt(n, 10));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          testID="settings-back"
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Notification Settings</Text>
          <Text style={styles.sub}>{saving ? "Saving…" : "Auto-saved on change"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Alert toggles */}
        <Section title="Alert types">
          <Row
            testID="toggle-low-stock"
            icon="alert-circle" color={theme.colors.semantic.warning}
            title="Low inventory alerts"
            sub="Ping me when an item drops below its minimum."
            value={s.low_stock_enabled}
            onChange={(v) => save({ low_stock_enabled: v })}
          />
          <Row
            testID="toggle-out-of-stock"
            icon="close-circle" color={theme.colors.semantic.danger}
            title="Out-of-stock alerts"
            sub="Immediate alert when an item hits zero."
            value={s.out_of_stock_enabled}
            onChange={(v) => save({ out_of_stock_enabled: v })}
          />
          <Row
            testID="toggle-staff-absent"
            icon="person-remove" color={theme.colors.semantic.danger}
            title="Staff absence alerts"
            sub="Notify when anyone is marked absent today."
            value={s.staff_absent_enabled}
            onChange={(v) => save({ staff_absent_enabled: v })}
          />
          <Row
            testID="toggle-high-sales"
            icon="trending-up" color={theme.colors.semantic.success}
            title="High sales milestone"
            sub="Celebrate days that beat your 7-day average by 50%."
            value={s.high_sales_milestone_enabled}
            onChange={(v) => save({ high_sales_milestone_enabled: v })}
          />
          <Row
            testID="toggle-low-sales"
            icon="trending-down" color={theme.colors.semantic.warning}
            title="Low sales warning"
            sub="Alert when today is below 50% of your 7-day average."
            value={s.low_sales_warning_enabled}
            onChange={(v) => save({ low_sales_warning_enabled: v })}
          />
          <Row
            testID="toggle-sound"
            icon="volume-high" color={theme.colors.brand.primary}
            title="Sound & vibration"
            sub="Audible alert when a notification arrives (mobile only)."
            value={s.sound_enabled}
            onChange={(v) => save({ sound_enabled: v })}
          />
        </Section>

        {/* Expense limit */}
        <Section title="Monthly expense limit">
          <Row
            testID="toggle-expense-limit"
            icon="cash-outline" color={theme.colors.semantic.danger}
            title="Warn when over budget"
            sub="We alert you at 85% and again at 100% of the cap."
            value={s.expense_limit_enabled}
            onChange={(v) => save({ expense_limit_enabled: v })}
          />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Monthly cap</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                testID="expense-limit-input"
                value={limitText}
                onChangeText={setLimitText}
                onBlur={() => {
                  const n = parseFloat(limitText.replace(/[^0-9.]/g, "")) || 0;
                  save({ expense_limit_monthly: n });
                  setLimitText(String(n));
                }}
                keyboardType="numeric"
                style={styles.input}
                placeholder="500000"
                placeholderTextColor={theme.colors.text.tertiary}
              />
            </View>
          </View>
        </Section>

        {/* EOD Report */}
        <Section title="Daily email report">
          <Row
            testID="toggle-eod-daily"
            icon="calendar-outline" color={theme.colors.brand.primary}
            title="Daily EOD report"
            sub={`Sends at ${s.eod_time} · ${s.eod_timezone}`}
            value={s.eod_daily_enabled}
            onChange={(v) => save({ eod_daily_enabled: v })}
          />
          <Row
            testID="toggle-eod-weekly"
            icon="calendar" color={theme.colors.brand.primary}
            title="Weekly summary (Mondays)"
            sub="Every Monday morning for the previous week."
            value={s.eod_weekly_enabled}
            onChange={(v) => save({ eod_weekly_enabled: v })}
          />
          <Row
            testID="toggle-eod-monthly"
            icon="calendar-number" color={theme.colors.brand.primary}
            title="Monthly roll-up (1st)"
            sub="On the 1st of each month for the previous month."
            value={s.eod_monthly_enabled}
            onChange={(v) => save({ eod_monthly_enabled: v })}
          />

          {/* Time picker */}
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Send time</Text>
            <View style={styles.timeWrap}>
              <Stepper
                testID="eod-hour"
                value={eodH}
                min={0} max={23} pad
                onChange={(v) => setEodTime(v, eodM)}
                label="Hour"
              />
              <Text style={styles.timeColon}>:</Text>
              <Stepper
                testID="eod-minute"
                value={eodM}
                min={0} max={55} step={5} pad
                onChange={(v) => setEodTime(eodH, v)}
                label="Minute"
              />
            </View>
          </View>

          {/* Timezone picker */}
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Timezone</Text>
            <View style={styles.tzRow}>
              {TIMEZONES.map((tz) => (
                <TouchableOpacity
                  key={tz}
                  testID={`tz-${tz}`}
                  onPress={() => save({ eod_timezone: tz })}
                  style={[styles.chip, s.eod_timezone === tz && styles.chipActive]}
                >
                  <Text style={[styles.chipText, s.eod_timezone === tz && styles.chipTextActive]}>
                    {tz.replace("_", " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recipients */}
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Recipient emails ({s.eod_recipient_emails.length})</Text>
            {s.eod_recipient_emails.length === 0 && (
              <Text style={styles.hint}>No recipients yet — add at least one owner email.</Text>
            )}
            {s.eod_recipient_emails.map((e) => (
              <View key={e} style={styles.emailRow}>
                <Ionicons name="mail" size={14} color={theme.colors.text.secondary} />
                <Text style={styles.emailText}>{e}</Text>
                <TouchableOpacity testID={`remove-email-${e}`} onPress={() => removeEmail(e)}>
                  <Ionicons name="close" size={18} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={16} color={theme.colors.text.tertiary} style={{ marginLeft: 10 }} />
              <TextInput
                testID="new-email-input"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="owner@yourrestaurant.com"
                placeholderTextColor={theme.colors.text.tertiary}
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, { paddingLeft: 8 }]}
                onSubmitEditing={addEmail}
              />
              <TouchableOpacity testID="add-email-btn" onPress={addEmail} style={styles.addBtn}>
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity testID="download-pdf-btn" onPress={downloadPdf} style={[styles.cta, styles.ctaGhost]}>
              <Ionicons name="download-outline" size={16} color={theme.colors.text.primary} />
              <Text style={styles.ctaGhostText}>Download today's PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="send-eod-btn" onPress={sendEod} style={[styles.cta, styles.ctaPrimary]}>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.ctaPrimaryText}>Send now</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            Email delivery requires SendGrid. Until it's configured, use Download PDF to get the report instantly.
          </Text>
        </Section>

        {/* Branches */}
        {branches.length > 0 && (
          <Section title="Branch rules">
            <Text style={styles.hint}>Toggle off to silence alerts from a specific branch.</Text>
            {branches.map((b) => {
              const on = s.branch_rules?.[b.branch_id] !== false;
              return (
                <Row
                  key={b.branch_id}
                  testID={`branch-rule-${b.branch_id}`}
                  icon="storefront-outline" color={theme.colors.brand.primary}
                  title={b.name}
                  sub={b.location}
                  value={on}
                  onChange={(v) =>
                    save({ branch_rules: { ...(s.branch_rules || {}), [b.branch_id]: v } })
                  }
                />
              );
            })}
          </Section>
        )}

        <Text style={styles.footNote}>
          Changes apply immediately. Open the bell on the dashboard to see live notifications.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// -------- Subcomponents --------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  testID, icon, color, title, sub, value, onChange,
}: {
  testID: string; icon: any; color: string; title: string; sub: string;
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.brand.primary, false: theme.colors.surfaceHighlight }}
        thumbColor={value ? "#fff" : "#f4f4f4"}
      />
    </View>
  );
}

function Stepper({
  testID, value, min, max, step = 1, pad = false, label, onChange,
}: {
  testID: string; value: number; min: number; max: number; step?: number;
  pad?: boolean; label: string; onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const display = pad ? String(value).padStart(2, "0") : String(value);
  return (
    <View style={styles.stepperWrap}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity
          testID={`${testID}-down`}
          onPress={() => onChange(clamp(value - step))}
          style={styles.stepBtn}
        >
          <Ionicons name="remove" size={18} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{display}</Text>
        <TouchableOpacity
          testID={`${testID}-up`}
          onPress={() => onChange(clamp(value + step))}
          style={styles.stepBtn}
        >
          <Ionicons name="add" size={18} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 60 },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 10,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: theme.colors.text.primary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 2 },

  section: { marginBottom: 20 },
  sectionTitle: {
    color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1,
    textTransform: "uppercase", fontWeight: "700", marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, overflow: "hidden",
  },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700" },
  rowSub: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 2, lineHeight: 15 },

  fieldRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  fieldCol: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  fieldLabel: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600" },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10,
    minWidth: 170,
  },
  rupee: { color: theme.colors.text.secondary, fontSize: 14, fontWeight: "700", marginLeft: 12 },
  input: {
    flex: 1, color: theme.colors.text.primary,
    paddingVertical: 10, paddingHorizontal: 10, fontSize: 14,
  },
  addBtn: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: theme.colors.brand.primary,
    alignItems: "center", justifyContent: "center", margin: 4,
  },

  timeWrap: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 4 },
  timeColon: { color: theme.colors.text.primary, fontSize: 22, fontWeight: "800", marginBottom: 10 },
  stepperWrap: { alignItems: "center" },
  stepperLabel: { color: theme.colors.text.tertiary, fontSize: 10, letterSpacing: 1, marginBottom: 4 },
  stepper: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: theme.colors.surfaceHighlight, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  stepBtn: { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
  stepValue: {
    color: theme.colors.text.primary, fontSize: 18, fontWeight: "800",
    minWidth: 38, textAlign: "center",
  },

  tzRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.brand.primaryMuted, borderColor: theme.colors.brand.primary },
  chipText: { color: theme.colors.text.secondary, fontSize: 11, fontWeight: "600" },
  chipTextActive: { color: theme.colors.brand.primary },

  emailRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.surfaceHighlight, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 6,
  },
  emailText: { color: theme.colors.text.primary, fontSize: 13, flex: 1 },

  ctaRow: { flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingTop: 4, paddingBottom: 10 },
  cta: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 12, borderRadius: 10,
  },
  ctaGhost: { backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border },
  ctaGhostText: { color: theme.colors.text.primary, fontSize: 13, fontWeight: "700" },
  ctaPrimary: { backgroundColor: theme.colors.brand.primary },
  ctaPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  hint: { color: theme.colors.text.tertiary, fontSize: 11, paddingHorizontal: 14, lineHeight: 15 },
  footNote: { color: theme.colors.text.tertiary, fontSize: 11, textAlign: "center", marginTop: 14, fontStyle: "italic" },
});
