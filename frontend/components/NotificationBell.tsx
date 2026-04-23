import React, { useCallback, useEffect, useState } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import api from "../lib/api";
import { theme } from "../constants/theme";

/** Bell icon with unread-count badge — taps to /notifications */
export function NotificationBell({ testID = "notification-bell" }: { testID?: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await api.get("/notifications/unread-count");
      setCount(r.data.unread_count || 0);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <TouchableOpacity
      testID={testID}
      onPress={() => router.push("/(tabs)/notifications")}
      style={styles.btn}
      activeOpacity={0.8}
    >
      <Ionicons name="notifications-outline" size={22} color={theme.colors.text.primary} />
      {count > 0 && (
        <View style={styles.badge} testID="notification-badge">
          <Text style={styles.badgeText}>{count > 99 ? "99+" : String(count)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: theme.colors.semantic.danger,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
