import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing, Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useSegments } from "expo-router";
import api from "../lib/api";
import { theme } from "../constants/theme";
import { useAiContext, AiContextKey } from "../lib/aiContext";

type Msg = { role: "user" | "assistant"; text: string };

const CTX_LABEL: Record<AiContextKey, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  expenses: "Expenses",
  staff: "Staff",
  menu: "Menu",
  profile: "Profile",
};

type QuickAction = {
  id: string;
  icon: any;
  label: string;
  sub: string;
  color?: string;
  /** relative target — e.g. "/(tabs)/expenses?add=1" */
  href: string;
};

/** Per-tab quick action menus */
const QUICK_ACTIONS: Record<string, { title: string; actions: QuickAction[] }> = {
  dashboard: {
    title: "Dashboard actions",
    actions: [
      { id: "csv",  icon: "document-text",  label: "Import CSV",    sub: "Bulk import data",        href: "/(tabs)/integrations?preset=csv" },
      { id: "xlsx", icon: "grid",            label: "Upload Excel",  sub: "Spreadsheet import",      href: "/(tabs)/integrations?preset=xlsx" },
      { id: "pdf",  icon: "document-attach", label: "Upload PDF",    sub: "Extract from documents",  href: "/(tabs)/integrations?preset=pdf" },
      { id: "exp",  icon: "wallet",          label: "Add Expense",   sub: "Log a new expense",       href: "/(tabs)/expenses?add=1" },
    ],
  },
  inventory: {
    title: "Inventory actions",
    actions: [
      { id: "add", icon: "add-circle",       label: "Add Item",        sub: "New ingredient or stock",    href: "/(tabs)/inventory?add=1" },
      { id: "buy", icon: "bag-add",          label: "Purchase Stock",  sub: "Record a new purchase",      href: "/(tabs)/inventory?add=1&preset=purchase" },
      { id: "upd", icon: "sync",             label: "Update Quantity", sub: "Adjust current stock",       href: "/(tabs)/inventory?add=1&preset=update" },
      { id: "xfr", icon: "swap-horizontal",  label: "Transfer Stock",  sub: "Move between branches",      href: "/(tabs)/inventory?add=1&preset=transfer" },
    ],
  },
  expenses: {
    title: "Expense actions",
    actions: [
      { id: "add", icon: "wallet",          label: "Add Expense",    sub: "Log a new expense",  href: "/(tabs)/expenses?add=1" },
      { id: "csv", icon: "document-text",   label: "Import CSV",     sub: "Bulk import",        href: "/(tabs)/integrations?preset=csv" },
    ],
  },
  employees: {
    title: "Staff actions",
    actions: [
      { id: "add", icon: "person-add",       label: "Add Staff",         sub: "New employee",          href: "/(tabs)/employees?add=1" },
      { id: "att", icon: "checkmark-done",   label: "Mark Attendance",   sub: "Tap chips to cycle",    href: "/(tabs)/employees?scroll=list" },
      { id: "sft", icon: "time",             label: "Assign Shift",      sub: "Coming soon",           href: "/(tabs)/employees?add=1&preset=shift" },
    ],
  },
  menu: {
    title: "Menu actions",
    actions: [
      { id: "add", icon: "restaurant",       label: "Add Menu Item",   sub: "New dish or drink",     href: "/(tabs)/menu?add=1" },
      { id: "imp", icon: "document-text",    label: "Import Menu CSV", sub: "Bulk upload",           href: "/(tabs)/integrations?preset=csv" },
    ],
  },
  insights: {
    title: "Reports actions",
    actions: [
      { id: "pdf",   icon: "document-attach", label: "Export PDF",    sub: "Today's EOD report",        href: "/(tabs)/settings?action=download_pdf" },
      { id: "share", icon: "share-social",    label: "Share Report",  sub: "Send to recipients",        href: "/(tabs)/settings?action=send_eod" },
    ],
  },
};

const BUTTON_SIZE = 56;
const STACK_GAP = 14;

function detectTab(segments: string[]): string {
  // segments like ["(tabs)", "inventory"] or ["(tabs)", "dashboard", "index"]
  const idx = segments.findIndex((s) => s === "(tabs)");
  if (idx < 0) return "dashboard";
  return segments[idx + 1] || "dashboard";
}

export function FloatingActions() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments() as unknown as string[];
  const tab = detectTab(segments);
  const ctxKey = useAiContext().key;
  const { key } = useAiContext();

  const [aiOpen, setAiOpen] = useState(false);
  const [qaOpen, setQaOpen] = useState(false);

  // Hide on screens that manage their own chrome heavily (keep on main tabs)
  const visibleTabs = ["dashboard", "inventory", "expenses", "employees", "menu", "insights"];
  const showFab = visibleTabs.includes(tab);

  // ---- + button rotate animation ----
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rotate, {
      toValue: qaOpen ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [qaOpen, rotate]);
  const plusRot = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });

  const qa = QUICK_ACTIONS[tab] || QUICK_ACTIONS.dashboard;

  const bottomBase = (insets.bottom || 0) + 64 /* tab bar */ + 16;

  const runAction = (a: QuickAction) => {
    setQaOpen(false);
    setTimeout(() => router.push(a.href as any), 100);
  };

  // ---- AI modal state (duplicated from old AiFab) ----
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!aiOpen) return;
    api.get(`/ai/suggestions`, { params: { context: key === "profile" ? "dashboard" : key } })
      .then((r) => setSuggestions(r.data.suggestions || []))
      .catch(() => setSuggestions([]));
  }, [aiOpen, key]);

  const send = useCallback(async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || busy) return;
    const userMsg: Msg = { role: "user", text: question };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const r = await api.post("/ai/ask", { context: key === "profile" ? "dashboard" : key, question });
      setMsgs((m) => [...m, { role: "assistant", text: r.data.answer || "No response" }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, key]);

  if (!showFab) return <>{renderAiModal()}</>;

  function renderAiModal() {
    return (
      <Modal visible={aiOpen} animationType="slide" transparent onRequestClose={() => setAiOpen(false)}>
        <View style={styles.sheetBg}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheet}
          >
            <LinearGradient
              colors={["rgba(236,72,153,0.18)", "rgba(139,92,246,0.10)", "transparent"]}
              style={styles.sheetHead}
            >
              <View style={styles.sheetHeadRow}>
                <View style={styles.aiChip}>
                  <Ionicons name="sparkles" size={12} color="#EC4899" />
                  <Text style={styles.aiChipText}>AI ASSISTANT</Text>
                </View>
                <TouchableOpacity onPress={() => setAiOpen(false)} style={styles.closeBtn} testID="ai-close">
                  <Ionicons name="close" size={18} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetTitle}>Ask anything about{"\n"}your {CTX_LABEL[ctxKey] || "business"}.</Text>
              <View style={styles.ctxPill}>
                <View style={styles.ctxDot} />
                <Text style={styles.ctxText}>Context: {CTX_LABEL[ctxKey]}</Text>
              </View>
            </LinearGradient>

            <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 10 }}>
              {msgs.length === 0 && (
                <View>
                  <Text style={styles.suggestTitle}>Try asking</Text>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      testID={`suggest-${s.slice(0, 10)}`}
                      onPress={() => send(s)}
                      style={styles.suggestCard}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="arrow-forward-circle" size={16} color={theme.colors.brand.primary} />
                      <Text style={styles.suggestText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {msgs.map((m, i) => (
                <View key={i} style={[styles.bubble, m.role === "user" ? styles.userB : styles.aiB]}>
                  <Text style={m.role === "user" ? styles.userT : styles.aiT}>{m.text}</Text>
                </View>
              ))}
              {busy && (
                <View style={[styles.bubble, styles.aiB]}>
                  <ActivityIndicator size="small" color="#EC4899" />
                </View>
              )}
            </ScrollView>

            <View style={styles.inputRow}>
              <TextInput
                testID="ai-input"
                value={input}
                onChangeText={setInput}
                placeholder={`Ask about ${CTX_LABEL[ctxKey].toLowerCase()}…`}
                placeholderTextColor={theme.colors.text.tertiary}
                style={styles.input}
                onSubmitEditing={() => send()}
                returnKeyType="send"
              />
              <TouchableOpacity
                testID="ai-send"
                onPress={() => send()}
                style={[styles.sendBtn, (!input.trim() || busy) && { opacity: 0.5 }]}
                disabled={!input.trim() || busy}
              >
                <Ionicons name="arrow-up" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  return (
    <>
      {/* Stacked FAB column — bottom-right */}
      <View pointerEvents="box-none" style={[styles.column, { bottom: bottomBase, right: 18 }]}>
        {/* AI button (TOP) */}
        <TouchableOpacity
          testID="ai-fab"
          onPress={() => setAiOpen(true)}
          activeOpacity={0.85}
          style={styles.fabWrap}
        >
          <LinearGradient
            colors={["#EC4899", "#8B5CF6", "#3B82F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aiFab}
          >
            <Ionicons name="sparkles" size={22} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.aiDot} />
        </TouchableOpacity>

        {/* + button (BOTTOM) */}
        <TouchableOpacity
          testID="quick-action-fab"
          onPress={() => setQaOpen((v) => !v)}
          activeOpacity={0.85}
          style={[styles.fabWrap, { marginTop: STACK_GAP }]}
        >
          <LinearGradient
            colors={["#FB923C", "#F97316", "#EA580C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.plusFab}
          >
            <Animated.View style={{ transform: [{ rotate: plusRot }] }}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </Animated.View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Quick Actions bottom sheet */}
      <Modal visible={qaOpen} animationType="fade" transparent onRequestClose={() => setQaOpen(false)}>
        <Pressable style={styles.qaBackdrop} onPress={() => setQaOpen(false)}>
          <Pressable style={[styles.qaSheet, { paddingBottom: (insets.bottom || 0) + 18 }]} onPress={() => {}}>
            <View style={styles.qaHandle} />
            <Text style={styles.qaTitle}>{qa.title}</Text>
            <Text style={styles.qaSub}>Quick actions for this screen</Text>

            <View style={styles.qaGrid}>
              {qa.actions.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  testID={`qa-${tab}-${a.id}`}
                  onPress={() => runAction(a)}
                  style={styles.qaCard}
                  activeOpacity={0.85}
                >
                  <View style={styles.qaIcon}>
                    <Ionicons name={a.icon} size={22} color="#F97316" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qaLabel}>{a.label}</Text>
                    <Text style={styles.qaDesc}>{a.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {renderAiModal()}
    </>
  );
}

const styles = StyleSheet.create({
  column: { position: "absolute", alignItems: "center", zIndex: 50 },

  fabWrap: {
    width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: BUTTON_SIZE / 2,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  aiFab: {
    flex: 1, borderRadius: BUTTON_SIZE / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  aiDot: {
    position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#EC4899",
    borderWidth: 2, borderColor: theme.colors.background,
  },
  plusFab: {
    flex: 1, borderRadius: BUTTON_SIZE / 2,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },

  // Quick Actions sheet
  qaBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  qaSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10,
    borderTopWidth: 1, borderColor: theme.colors.borderStrong,
  },
  qaHandle: {
    alignSelf: "center", width: 44, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border, marginBottom: 14,
  },
  qaTitle: { color: theme.colors.text.primary, fontSize: 18, fontWeight: "800", letterSpacing: -0.4 },
  qaSub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 2, marginBottom: 14 },
  qaGrid: { gap: 10 },
  qaCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  qaIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "rgba(249,115,22,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  qaLabel: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700" },
  qaDesc: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 2 },

  // AI modal (copied from AiFab)
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: {
    height: "85%", backgroundColor: theme.colors.background,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, borderColor: theme.colors.borderStrong, overflow: "hidden",
  },
  sheetHead: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 20 },
  sheetHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  aiChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(236,72,153,0.2)", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  aiChipText: { color: "#EC4899", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.border,
  },
  sheetTitle: { color: theme.colors.text.primary, fontSize: 22, fontWeight: "800", letterSpacing: -0.5, lineHeight: 28 },
  ctxPill: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    marginTop: 14, backgroundColor: theme.colors.surface, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border,
  },
  ctxDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.brand.primary },
  ctxText: { color: theme.colors.text.secondary, fontSize: 11, fontWeight: "700" },
  suggestTitle: { color: theme.colors.text.tertiary, fontSize: 11, letterSpacing: 1.2, fontWeight: "800", marginBottom: 10 },
  suggestCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.surface, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10,
  },
  suggestText: { color: theme.colors.text.primary, fontSize: 13, fontWeight: "500" },
  bubble: { padding: 12, borderRadius: 14, marginBottom: 10, maxWidth: "88%" },
  userB: { backgroundColor: theme.colors.brand.primary, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  aiB: {
    backgroundColor: theme.colors.surface, alignSelf: "flex-start", borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  userT: { color: "#FFF", fontSize: 13, lineHeight: 19 },
  aiT: { color: theme.colors.text.primary, fontSize: 13, lineHeight: 19 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1, backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
    color: theme.colors.text.primary, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, fontSize: 13,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.brand.primary,
    alignItems: "center", justifyContent: "center",
  },
});
