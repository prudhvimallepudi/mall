import React from "react";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../constants/theme";
import { useAuth } from "../../lib/auth";
import { View, ActivityIndicator } from "react-native";
import { AiContextProvider } from "../../lib/aiContext";
import { FloatingActions } from "../../components/FloatingActions";

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={theme.colors.brand.primary} />
      </View>
    );
  }
  if (!user) return <Redirect href="/" />;

  return (
    <AiContextProvider>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: theme.colors.brand.primary,
            tabBarInactiveTintColor: theme.colors.text.tertiary,
            tabBarStyle: {
              backgroundColor: theme.colors.surface,
              borderTopColor: theme.colors.border,
              borderTopWidth: 1,
              height: 64,
              paddingTop: 6,
              paddingBottom: 10,
            },
            tabBarLabelStyle: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
          }}
        >
          <Tabs.Screen
            name="dashboard"
            options={{
              title: "Dashboard",
              tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size ?? 22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="inventory"
            options={{
              title: "Inventory",
              tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size ?? 22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="expenses"
            options={{
              title: "Expenses",
              tabBarIcon: ({ color, size }) => <Ionicons name="wallet-outline" size={size ?? 22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="employees"
            options={{
              title: "Staff",
              tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size ?? 22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="menu"
            options={{
              title: "Menu",
              tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" size={size ?? 22} color={color} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: "Profile",
              tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size ?? 22} color={color} />,
            }}
          />
          {/* Hidden routes — still reachable programmatically but not in tab bar */}
          <Tabs.Screen name="insights" options={{ href: null }} />
          <Tabs.Screen name="integrations" options={{ href: null }} />
          <Tabs.Screen name="notifications" options={{ href: null }} />
          <Tabs.Screen name="settings" options={{ href: null }} />
        </Tabs>
        <FloatingActions />
      </View>
    </AiContextProvider>
  );
}
