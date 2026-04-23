export const theme = {
  colors: {
    background: "#0A0A0A",
    surface: "#141414",
    surfaceHighlight: "#1F1F1F",
    border: "rgba(255, 255, 255, 0.08)",
    borderStrong: "rgba(255, 255, 255, 0.15)",
    text: {
      primary: "#FFFFFF",
      secondary: "rgba(255, 255, 255, 0.65)",
      tertiary: "rgba(255, 255, 255, 0.4)",
      inverse: "#000000",
    },
    brand: {
      primary: "#F97316",
      primaryMuted: "rgba(249, 115, 22, 0.15)",
      primaryDark: "#EA580C",
      primaryLight: "#FB923C",
    },
    semantic: {
      success: "#10B981",
      successBg: "rgba(16, 185, 129, 0.15)",
      danger: "#EF4444",
      dangerBg: "rgba(239, 68, 68, 0.15)",
      warning: "#FACC15",
      warningBg: "rgba(250, 204, 21, 0.15)",
      ai: "#F59E0B",
      aiBg: "rgba(245, 158, 11, 0.12)",
    },
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radii: { card: 12, button: 10, pill: 9999 },
  font: {
    mono: "monospace",
  },
};

export const chartConfig = {
  backgroundGradientFrom: "#141414",
  backgroundGradientTo: "#141414",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(249, 115, 22, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity * 0.6})`,
  propsForBackgroundLines: { stroke: "rgba(255,255,255,0.06)", strokeDasharray: "" },
  propsForDots: { r: "3", strokeWidth: "1", stroke: "#F97316" },
  style: { borderRadius: 12 },
};
