import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { checkConnection } from "../api";
import { clearHistory } from "../dictionary";
import type { Settings } from "../settings";
import { colors, common } from "../theme";

interface Props {
  visible: boolean;
  settings: Settings;
  onClose: () => void;
  onSave: (s: Settings) => void;
  onHistoryCleared: () => void;
}

export function SettingsSheet({ visible, settings, onClose, onSave, onHistoryCleared }: Props) {
  const [draft, setDraft] = useState(settings);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (visible) {
      setDraft(settings);
      setStatus("");
    }
  }, [visible, settings]);

  async function test() {
    setStatus("Checking…");
    try {
      setStatus(await checkConnection({ ...draft, apiUrl: draft.apiUrl.trim().replace(/\/+$/, "") }));
    } catch (e) {
      setStatus("✗ " + (e as Error).message);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>

        <View style={common.card}>
          <Text style={common.label}>Server address</Text>
          <TextInput
            style={styles.input}
            value={draft.apiUrl}
            onChangeText={(apiUrl) => setDraft({ ...draft, apiUrl })}
            placeholder="https://your-app.vercel.app"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[common.label, { marginTop: 14 }]}>App secret</Text>
          <TextInput
            style={styles.input}
            value={draft.appSecret}
            onChangeText={(appSecret) => setDraft({ ...draft, appSecret })}
            placeholder="Same as APP_SECRET on Vercel"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Pressable style={styles.secondary} onPress={test}>
            <Text style={styles.secondaryText}>Test connection</Text>
          </Pressable>
          {!!status && <Text style={styles.status}>{status}</Text>}
        </View>

        <View style={[common.card, styles.switchRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Auto AI help</Text>
            <Text style={styles.switchHint}>
              Dictionary-ல் தமிழ் அர்த்தம் அல்லது 3 உதாரணங்கள் இல்லாதபோது மட்டும் AI-யிடம் தானாகக் கேட்கும். Off செய்தால் நீங்கள்
              பட்டனை அழுத்தும்போது மட்டும்.
            </Text>
          </View>
          <Switch value={draft.autoAi} onValueChange={(autoAi) => setDraft({ ...draft, autoAi })} />
        </View>

        <Pressable style={styles.primary} onPress={() => onSave(draft)}>
          <Text style={styles.primaryText}>Save</Text>
        </Pressable>

        <Pressable
          style={styles.link}
          onPress={async () => {
            await clearHistory();
            onHistoryCleared();
            setStatus("History cleared");
          }}
        >
          <Text style={styles.linkText}>Clear search history</Text>
        </Pressable>

        <Text style={styles.credits}>
          Offline data: English–Tamil dictionary (eng2tamildictionary, GPL-3.0), WordNet 3.1 (Princeton), CMU Pronouncing
          Dictionary.
        </Text>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink },
  close: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  secondary: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryText: { color: colors.primary, fontWeight: "700" },
  status: { marginTop: 10, color: colors.ink, fontSize: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  switchTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 19 },
  primary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { alignItems: "center", paddingVertical: 16 },
  linkText: { color: colors.danger, fontWeight: "600" },
  credits: { fontSize: 12, color: colors.muted, textAlign: "center", lineHeight: 18 },
});
