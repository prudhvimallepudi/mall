import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { theme } from "../constants/theme";

type Branch = { branch_id: string; name: string; location: string };

export function BranchPicker({
  branches,
  value,
  onChange,
}: {
  branches: Branch[];
  value: string;
  onChange: (id: string) => void;
}) {
  const all = [{ branch_id: "all", name: "All Branches", location: "" }, ...branches];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {all.map((b) => {
        const active = value === b.branch_id;
        return (
          <TouchableOpacity
            key={b.branch_id}
            testID={`branch-chip-${b.branch_id}`}
            onPress={() => onChange(b.branch_id)}
            style={[styles.chip, active && styles.chipActive]}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: theme.colors.brand.primaryMuted,
    borderColor: theme.colors.brand.primary,
  },
  chipText: { color: theme.colors.text.secondary, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: theme.colors.brand.primary },
});

export function inr(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}
