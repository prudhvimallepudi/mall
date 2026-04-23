import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { AVATARS, getAvatar, initialsOf } from "../constants/avatars";
import { theme } from "../constants/theme";

export function Avatar({
  avatarId,
  name,
  size = 40,
}: {
  avatarId?: string | null;
  name?: string;
  size?: number;
}) {
  if (avatarId) {
    const a = getAvatar(avatarId);
    return (
      <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: a.bg }]}>
        <Text style={{ fontSize: size * 0.55 }}>{a.emoji}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.colors.brand.primaryMuted }]}>
      <Text style={{ color: theme.colors.brand.primary, fontSize: size * 0.38, fontWeight: "800" }}>{initialsOf(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});

export { AVATARS };
