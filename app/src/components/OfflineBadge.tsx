import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

export function OfflineBadge() {
  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel="Offline mode">
      <View style={styles.dot} />
      <Text style={styles.text}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.offlineBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.offline },
  text: { color: colors.offline, fontWeight: "700", fontSize: 12 },
});
