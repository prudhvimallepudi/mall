import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export function AiFab() {
  const insets = useSafeAreaInsets();
  const { key } = useAiContext();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!open) return;
    // fetch suggestions for current context
    api.get(`/ai/suggestions`, { params: { context: key === "profile" ? "dashboard" : key } })
      .then((r) => setSuggestions(r.data.suggestions || []))
      .catch(() => setSuggestions([]));
  }, [open, key]);

  const send = async (q?: string) => {
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
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", text: "Sorry, I couldn't process that. Please try again." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        testID="ai-fab"
        onPress={() => setOpen(true)}
        style={[styles.fab, { top: insets.top + 12 }]}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#EC4899", "#8B5CF6", "#3B82F6"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabInner}
        >
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
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
                <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn} testID="ai-close">
                  <Ionicons name="close" size={18} color={theme.colors.text.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetTitle}>Ask anything about{"\n"}your {CTX_LABEL[key] || "business"}.</Text>
              <View style={styles.ctxPill}>
                <View style={styles.ctxDot} />
                <Text style={styles.ctxText}>Context: {CTX_LABEL[key]}</Text>
              </View>
            </LinearGradient>

            <ScrollView
              ref={scrollRef}
              style={styles.msgs}
              contentContainerStyle={{ padding: 20, paddingBottom: 10 }}
            >
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
                placeholder={`Ask about ${CTX_LABEL[key].toLowerCase()}…`}
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
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute", right: 18, zIndex: 50,
    width: 40, height: 40, borderRadius: 20,
    shadowColor: "#EC4899", shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabInner: {
    flex: 1, borderRadius: 20, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
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
  msgs: { flex: 1 },
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
