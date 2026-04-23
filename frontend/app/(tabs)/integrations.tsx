import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, Modal, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import api from "../../lib/api";
import { theme } from "../../constants/theme";

type Category = "sales" | "expenses" | "inventory" | "attendance";

const CATEGORIES: { id: Category; label: string; icon: any; color: string; desc: string }[] = [
  { id: "sales", label: "Sales", icon: "trending-up", color: "#10B981", desc: "Daily sales / POS reports" },
  { id: "expenses", label: "Expenses", icon: "wallet", color: "#F59E0B", desc: "Bills, rent, utility expenses" },
  { id: "inventory", label: "Inventory", icon: "cube", color: "#3B82F6", desc: "Stock & raw materials" },
  { id: "attendance", label: "Attendance", icon: "people", color: "#8B5CF6", desc: "Staff attendance sheets" },
];

const FUTURE_APIS = [
  { name: "Petpooja POS", status: "coming" },
  { name: "Zomato", status: "coming" },
  { name: "Swiggy", status: "coming" },
  { name: "POSist", status: "coming" },
  { name: "Restroworks", status: "coming" },
];

type ParseResp = {
  upload_id: string;
  filename: string;
  kind: string;
  category: Category;
  headers: string[];
  preview_rows: any[];
  total_rows: number;
  ai_mapping: Record<string, string>;
  target_fields: string[];
  required_fields: string[];
  errors: string[];
  dup_count: number;
};

export default function Integrations() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [catModal, setCatModal] = useState(false);
  const [preview, setPreview] = useState<ParseResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api.get("/integrations/history");
      setHistory(r.data.items || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const pickAndUpload = async (category: Category) => {
    setCatModal(false);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/plain", "application/vnd.ms-excel",
               "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
               "application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const file = res.assets[0];
      setBusy(true);

      // Read file as base64
      let b64 = "";
      if (Platform.OS === "web") {
        const resp = await fetch(file.uri);
        const blob = await resp.blob();
        b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const s = reader.result as string;
            resolve(s.split(",")[1] || "");
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const FS = await import("expo-file-system/legacy").catch(() => null as any);
        if (FS?.readAsStringAsync) {
          b64 = await FS.readAsStringAsync(file.uri, { encoding: "base64" });
        } else {
          const resp = await fetch(file.uri);
          const blob = await resp.blob();
          b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      }

      const r = await api.post("/integrations/parse", {
        filename: file.name,
        content_base64: b64,
        mime_type: file.mimeType || "",
        category,
      });
      setPreview(r.data);
      loadHistory();
    } catch (e: any) {
      Alert.alert("Upload failed", e?.response?.data?.detail || e?.message || "Unable to parse file");
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!preview) return;
    try {
      setImporting(true);
      const r = await api.post("/integrations/import", {
        upload_id: preview.upload_id,
        category: preview.category,
        mapping: preview.ai_mapping,
        rows: (preview as any).rows || preview.preview_rows,
      });
      Alert.alert(
        "Imported",
        `${r.data.inserted} rows saved${r.data.failed ? ` (${r.data.failed} failed)` : ""}.`,
      );
      setPreview(null);
      loadHistory();
    } catch (e: any) {
      Alert.alert("Import failed", e?.response?.data?.detail || "Unable to import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <LinearGradient colors={["#06B6D4", "#3B82F6", "#8B5CF6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="cloud-upload" size={12} color="#FFF" />
            <Text style={styles.heroBadgeText}>DATA IMPORT CENTER</Text>
          </View>
          <Text style={styles.heroTitle}>Bring your business{"\n"}data together.</Text>
          <Text style={styles.heroSub}>
            Upload CSV, Excel, PDF or photos of bills. AI auto-maps columns & imports in seconds.
          </Text>
        </LinearGradient>

        {/* Upload CTA */}
        <TouchableOpacity
          testID="upload-cta"
          onPress={() => setCatModal(true)}
          activeOpacity={0.85}
          style={styles.uploadBtn}
        >
          <View style={styles.uploadIcon}>
            <Ionicons name="add" size={28} color="#FFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.uploadTitle}>Upload a file</Text>
            <Text style={styles.uploadSub}>CSV · XLSX · PDF · Image (bills)</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.text.tertiary} />
        </TouchableOpacity>

        {/* Categories Grid */}
        <Text style={styles.sectionTitle}>Supported Categories</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              testID={`cat-${c.id}`}
              onPress={() => pickAndUpload(c.id)}
              style={styles.catCard}
              activeOpacity={0.8}
            >
              <View style={[styles.catIcon, { backgroundColor: c.color + "25" }]}>
                <Ionicons name={c.icon} size={20} color={c.color} />
              </View>
              <Text style={styles.catLabel}>{c.label}</Text>
              <Text style={styles.catDesc}>{c.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upload History */}
        <Text style={styles.sectionTitle}>Upload History</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.brand.primary} style={{ marginTop: 20 }} />
        ) : history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color={theme.colors.text.tertiary} />
            <Text style={styles.emptyText}>No uploads yet</Text>
          </View>
        ) : (
          history.map((h) => {
            const statusColor = h.status === "imported" ? theme.colors.semantic.success
              : h.status === "failed" ? theme.colors.semantic.danger
              : theme.colors.semantic.warning;
            return (
              <View key={h.upload_id} style={styles.hRow} testID={`upload-${h.upload_id}`}>
                <View style={[styles.hIcon, { backgroundColor: statusColor + "20" }]}>
                  <Ionicons name="document-text" size={18} color={statusColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.hName} numberOfLines={1}>{h.filename}</Text>
                  <Text style={styles.hMeta}>
                    {h.category} · {h.kind} · {h.total_rows} rows
                  </Text>
                </View>
                <View style={[styles.hStatus, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.hStatusText, { color: statusColor }]}>
                    {h.status === "imported" ? `✓ ${h.imported_count}` : h.status}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* Future Live APIs */}
        <Text style={styles.sectionTitle}>Live API Connections</Text>
        <Text style={styles.sectionSub}>Coming soon — real-time sync from popular POS systems</Text>
        <View style={{ marginTop: 12 }}>
          {FUTURE_APIS.map((api) => (
            <View key={api.name} style={styles.futRow}>
              <View style={styles.futDot} />
              <Text style={styles.futName}>{api.name}</Text>
              <View style={styles.futBadge}>
                <Text style={styles.futBadgeText}>COMING SOON</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Busy overlay */}
      {busy && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color="#06B6D4" />
            <Text style={styles.overlayText}>AI is reading your file…</Text>
            <Text style={styles.overlaySub}>Detecting columns, extracting rows</Text>
          </View>
        </View>
      )}

      {/* Category picker modal */}
      <Modal visible={catModal} animationType="slide" transparent onRequestClose={() => setCatModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pick data category</Text>
            <Text style={styles.modalSub}>Tell us what kind of data this file contains</Text>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.id}
                testID={`modal-cat-${c.id}`}
                onPress={() => pickAndUpload(c.id)}
                style={styles.catPicker}
                activeOpacity={0.8}
              >
                <View style={[styles.catIcon, { backgroundColor: c.color + "25" }]}>
                  <Ionicons name={c.icon} size={20} color={c.color} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.catLabel}>{c.label}</Text>
                  <Text style={styles.catDesc}>{c.desc}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setCatModal(false)} style={styles.modalCancel}>
              <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Preview modal */}
      <Modal visible={!!preview} animationType="slide" transparent onRequestClose={() => setPreview(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { maxHeight: "88%" }]}>
            <ScrollView>
              <Text style={styles.modalTitle}>Preview & Import</Text>
              {preview && (
                <>
                  <Text style={styles.modalSub}>{preview.filename} · {preview.kind.toUpperCase()}</Text>

                  <View style={styles.previewStats}>
                    <Stat label="ROWS" value={String(preview.total_rows)} color={theme.colors.semantic.success} />
                    <Stat label="DUPLICATES" value={String(preview.dup_count)} color={preview.dup_count > 0 ? theme.colors.semantic.warning : theme.colors.text.tertiary} />
                    <Stat label="ERRORS" value={String(preview.errors.length)} color={preview.errors.length > 0 ? theme.colors.semantic.danger : theme.colors.text.tertiary} />
                  </View>

                  {preview.errors.length > 0 && (
                    <View style={styles.errBox}>
                      {preview.errors.map((e, i) => (
                        <Text key={i} style={styles.errText}>• {e}</Text>
                      ))}
                    </View>
                  )}

                  <Text style={styles.mapTitle}>AI Column Mapping</Text>
                  <Text style={styles.mapSub}>Target field ← Your column</Text>
                  <View style={styles.mapBox}>
                    {preview.target_fields.map((f) => {
                      const src = preview.ai_mapping[f];
                      const required = preview.required_fields.includes(f);
                      return (
                        <View key={f} style={styles.mapRow}>
                          <Text style={styles.mapField}>
                            {f}{required ? <Text style={{ color: theme.colors.semantic.danger }}> *</Text> : null}
                          </Text>
                          <Ionicons name="arrow-back" size={14} color={theme.colors.text.tertiary} />
                          <Text style={[styles.mapSource, !src && styles.mapMissing]}>
                            {src || "— not matched"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <Text style={styles.mapTitle}>First Rows</Text>
                  <ScrollView horizontal style={styles.rowsBox}>
                    <View>
                      <View style={styles.tableHead}>
                        {preview.headers.map((h) => <Text key={h} style={styles.cellH}>{h}</Text>)}
                      </View>
                      {preview.preview_rows.slice(0, 5).map((r, i) => (
                        <View key={i} style={styles.tableRow}>
                          {preview.headers.map((h) => (
                            <Text key={h} style={styles.cell} numberOfLines={1}>{String(r[h] ?? "")}</Text>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>

                  <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
                    <TouchableOpacity style={[styles.modalBtn, styles.btnGhost]} onPress={() => setPreview(null)}>
                      <Text style={{ color: theme.colors.text.primary, fontWeight: "600" }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="preview-import-btn"
                      style={[styles.modalBtn, styles.btnPrimary,
                        (preview.errors.length > 0 || importing) && { opacity: 0.5 }]}
                      disabled={preview.errors.length > 0 || importing}
                      onPress={doImport}
                    >
                      <Text style={{ color: "#fff", fontWeight: "700" }}>
                        {importing ? "Importing…" : `Import ${preview.total_rows} rows`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: 40 },
  hero: {
    marginHorizontal: 16, marginTop: 16, paddingHorizontal: 22, paddingVertical: 26,
    borderRadius: 20, overflow: "hidden",
  },
  heroBadge: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, marginBottom: 14,
  },
  heroBadgeText: { color: "#FFF", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: "#FFF", fontSize: 26, fontWeight: "800", letterSpacing: -0.8, lineHeight: 32 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 10, lineHeight: 19 },

  uploadBtn: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 18,
    padding: 16, borderRadius: 14, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.borderStrong,
  },
  uploadIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.brand.primary,
    alignItems: "center", justifyContent: "center",
  },
  uploadTitle: { color: theme.colors.text.primary, fontSize: 16, fontWeight: "700" },
  uploadSub: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 2 },

  sectionTitle: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700", marginTop: 24, marginHorizontal: 24 },
  sectionSub: { color: theme.colors.text.tertiary, fontSize: 12, marginTop: 4, marginHorizontal: 24 },

  catGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingHorizontal: 16, marginTop: 12 },
  catCard: {
    width: "48.5%", backgroundColor: theme.colors.surface, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10,
  },
  catIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catLabel: { color: theme.colors.text.primary, fontSize: 14, fontWeight: "700", marginTop: 10 },
  catDesc: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 3 },

  emptyState: { alignItems: "center", padding: 30 },
  emptyText: { color: theme.colors.text.tertiary, marginTop: 8, fontSize: 13 },

  hRow: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 24, marginTop: 10,
    padding: 12, backgroundColor: theme.colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  hIcon: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  hName: { color: theme.colors.text.primary, fontSize: 13, fontWeight: "600" },
  hMeta: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  hStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  hStatusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  futRow: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 24, marginTop: 8,
    padding: 12, backgroundColor: theme.colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  futDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.text.tertiary },
  futName: { flex: 1, color: theme.colors.text.primary, fontSize: 13, fontWeight: "600", marginLeft: 10 },
  futBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.colors.surfaceHighlight },
  futBadgeText: { color: theme.colors.text.tertiary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },

  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center", justifyContent: "center",
  },
  overlayCard: {
    backgroundColor: theme.colors.surface, padding: 28, borderRadius: 16,
    alignItems: "center", borderWidth: 1, borderColor: theme.colors.borderStrong,
    minWidth: 260,
  },
  overlayText: { color: theme.colors.text.primary, marginTop: 14, fontSize: 14, fontWeight: "700" },
  overlaySub: { color: theme.colors.text.tertiary, marginTop: 4, fontSize: 11 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: theme.colors.surface, padding: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  modalTitle: { color: theme.colors.text.primary, fontSize: 18, fontWeight: "800" },
  modalSub: { color: theme.colors.text.secondary, fontSize: 12, marginTop: 4, marginBottom: 12 },
  catPicker: {
    flexDirection: "row", alignItems: "center", padding: 12, marginTop: 8,
    backgroundColor: theme.colors.surfaceHighlight, borderRadius: 10,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  modalCancel: {
    marginTop: 16, paddingVertical: 14, borderRadius: 10, alignItems: "center",
    backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border,
  },

  previewStats: { flexDirection: "row", gap: 10, marginTop: 6 },
  stat: {
    flex: 1, backgroundColor: theme.colors.surfaceHighlight, padding: 12,
    borderRadius: 10, alignItems: "center",
    borderWidth: 1, borderColor: theme.colors.border,
  },
  statValue: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { color: theme.colors.text.tertiary, fontSize: 9, letterSpacing: 1, marginTop: 4, fontWeight: "700" },

  errBox: {
    marginTop: 12, padding: 12, borderRadius: 10,
    backgroundColor: theme.colors.semantic.dangerBg,
    borderWidth: 1, borderColor: theme.colors.semantic.danger,
  },
  errText: { color: theme.colors.semantic.danger, fontSize: 12, lineHeight: 18 },

  mapTitle: { color: theme.colors.text.primary, fontSize: 13, fontWeight: "700", marginTop: 18 },
  mapSub: { color: theme.colors.text.tertiary, fontSize: 11, marginTop: 2, marginBottom: 8 },
  mapBox: { backgroundColor: theme.colors.surfaceHighlight, borderRadius: 10, padding: 4, borderWidth: 1, borderColor: theme.colors.border },
  mapRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, gap: 10 },
  mapField: { color: theme.colors.brand.primary, fontSize: 12, fontWeight: "700", width: 100 },
  mapSource: { flex: 1, color: theme.colors.text.primary, fontSize: 12, fontWeight: "600" },
  mapMissing: { color: theme.colors.text.tertiary, fontStyle: "italic" },

  rowsBox: { marginTop: 6, maxHeight: 160, backgroundColor: theme.colors.surfaceHighlight, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border },
  tableHead: { flexDirection: "row", padding: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.surface },
  tableRow: { flexDirection: "row", padding: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  cellH: { color: theme.colors.text.tertiary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, width: 100, paddingHorizontal: 6 },
  cell: { color: theme.colors.text.secondary, fontSize: 11, width: 100, paddingHorizontal: 6 },

  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  btnGhost: { backgroundColor: theme.colors.surfaceHighlight, borderWidth: 1, borderColor: theme.colors.border },
  btnPrimary: { backgroundColor: theme.colors.brand.primary },
});
