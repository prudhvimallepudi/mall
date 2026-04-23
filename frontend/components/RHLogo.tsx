import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  size?: number;
  showWordmark?: boolean;
  wordmarkColor?: string;
  style?: ViewStyle;
  testID?: string;
};

/**
 * RestroHub "RH" monogram logo.
 * Modern minimalist rounded square with orange gradient + white RH.
 */
export function RHLogo({
  size = 40,
  showWordmark = false,
  wordmarkColor = "#FFFFFF",
  style,
  testID = "rh-logo",
}: Props) {
  const radius = Math.round(size * 0.24);
  const fontSize = Math.round(size * 0.48);

  return (
    <View style={[styles.row, style]} testID={testID}>
      <LinearGradient
        colors={["#FB923C", "#F97316", "#EA580C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: radius,
          },
        ]}
      >
        <Text
          style={[
            styles.markText,
            { fontSize, lineHeight: fontSize * 1.05 },
          ]}
        >
          RH
        </Text>
      </LinearGradient>
      {showWordmark && (
        <Text style={[styles.wordmark, { color: wordmarkColor, fontSize: Math.round(size * 0.5) }]}>
          RestroHub
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F97316",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  markText: {
    color: "#FFFFFF",
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  wordmark: {
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
