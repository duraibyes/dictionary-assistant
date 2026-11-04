import { StyleSheet } from "react-native";

export const colors = {
  bg: "#F6F3EE",
  card: "#FFFFFF",
  ink: "#1F2328",
  muted: "#6B6F76",
  line: "#E6E1D8",
  primary: "#0F6B5C",
  primarySoft: "#E3F1EE",
  accent: "#C2571A",
  accentSoft: "#FBEDE3",
  offline: "#8A4B00",
  offlineBg: "#FFF1D6",
  danger: "#B42318",
};

export const common = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  chipText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
});
