// 12 preset avatars (colorful, playful, on-brand for a restaurant app)
export const AVATARS: { id: string; emoji: string; bg: string; fg: string }[] = [
  { id: "chef", emoji: "👨‍🍳", bg: "#F97316", fg: "#FFF" },
  { id: "burger", emoji: "🍔", bg: "#FACC15", fg: "#111" },
  { id: "pizza", emoji: "🍕", bg: "#EF4444", fg: "#FFF" },
  { id: "ramen", emoji: "🍜", bg: "#F59E0B", fg: "#111" },
  { id: "taco", emoji: "🌮", bg: "#10B981", fg: "#FFF" },
  { id: "curry", emoji: "🍛", bg: "#D97706", fg: "#FFF" },
  { id: "sushi", emoji: "🍣", bg: "#EC4899", fg: "#FFF" },
  { id: "cocktail", emoji: "🍹", bg: "#8B5CF6", fg: "#FFF" },
  { id: "coffee", emoji: "☕", bg: "#78350F", fg: "#FFF" },
  { id: "cake", emoji: "🎂", bg: "#F472B6", fg: "#FFF" },
  { id: "star", emoji: "⭐", bg: "#3B82F6", fg: "#FFF" },
  { id: "flame", emoji: "🔥", bg: "#DC2626", fg: "#FFF" },
];

export function getAvatar(id?: string | null) {
  if (!id) return AVATARS[0];
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

// Initials fallback
export function initialsOf(name?: string) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}
